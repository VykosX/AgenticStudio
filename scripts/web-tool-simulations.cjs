const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { z } = require("zod");

const root = path.resolve(__dirname, "..");
const { configSchematics } = require(path.join(root, "dist", "config.js"));
const { registerWebTools } = require(path.join(root, "dist", "tools", "web.js"));
const commands = require(path.join(root, "dist", "shared", "providerCommands.js"));
const filesystem = require(path.join(root, "dist", "shared", "providerFilesystem.js"));
const utils = require(path.join(root, "dist", "shared", "providerUtils.js"));

function resolveInsideWorkspace(workspaceRoot, requestedPath) {
  return path.resolve(workspaceRoot, String(requestedPath || "."));
}

function stripHtmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function safeUrl(value, base) {
  try {
    return new URL(String(value || ""), base);
  } catch {
    return null;
  }
}

async function fallbackWebSearch(query, limit) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0 Safari/537.36" },
    signal: AbortSignal.timeout(30000),
  });
  const html = await response.text();
  const matches = [...html.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const results = [];
  for (const match of matches.slice(0, limit)) {
    const rawHref = (match[1] || "").replace(/&amp;/g, "&");
    let finalUrl = rawHref;
    try {
      const parsed = new URL(rawHref, "https://duckduckgo.com");
      const uddg = parsed.searchParams.get("uddg");
      if (uddg) finalUrl = decodeURIComponent(uddg);
    } catch {
      // keep raw href
    }
    results.push({
      title: stripHtmlToText(match[2] || ""),
      url: finalUrl,
    });
  }
  return results;
}

async function fallbackImageSearch(query, limit) {
  return [{ title: query, imageUrl: `about:blank#${encodeURIComponent(query)}` }].slice(0, limit);
}

async function extractPageImages(url, limit) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const html = await response.text();
  const matches = [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi)];
  return matches.slice(0, limit).map((match) => ({
    imageUrl: safeUrl(match[1] || "", response.url || url)?.toString() || "",
    alt: match[2] || "",
  })).filter((entry) => entry.imageUrl);
}

function createCtl(configValues) {
  return {
    getPluginConfig: () => ({
      get: (key) => Object.prototype.hasOwnProperty.call(configValues, key) ? configValues[key] : undefined,
    }),
  };
}

function buildContext(configValues) {
  const ctl = createCtl(configValues);
  return {
    tool: (spec) => spec,
    z,
    safeTool: (_name, fn) => fn,
    requireCommandExecution: () => {
      if (((configValues.allowAutoExecution ?? true) === false)) {
        throw new Error("Automatic execution is disabled for this simulation context.");
      }
    },
    workspaceRoot: root,
    resolveInsideWorkspace,
    batchFileSelectionParameters: filesystem.batchFileSelectionParameters,
    resolveBatchFileTargets: filesystem.resolveBatchFileTargets,
    fileExists: filesystem.fileExists,
    quote: utils.quote,
    buildCommandResponse: commands.buildCommandResponse,
    buildCommandResponsePayload: commands.buildCommandResponsePayload,
    executeManagedCommand: commands.executeManagedCommand,
    executeInlineNodeScript: commands.executeInlineNodeScript,
    resolveExecutablePath: commands.resolveExecutablePath,
    getNodeExecutablePath: commands.getNodeExecutablePath,
    getDenoExecutablePath: commands.getDenoExecutablePath,
    parseJsonArrayOfStrings: utils.parseJsonArrayOfStrings,
    parseJsonObject: utils.parseJsonObject,
    mergeDefined: utils.mergeDefined,
    firecrawlApiRequest: async () => {
      throw new Error("Firecrawl is not configured for the simulation harness.");
    },
    firecrawlPollUntilDone: async () => {
      throw new Error("Firecrawl is not configured for the simulation harness.");
    },
    getFirecrawlApiKey: commands.getFirecrawlApiKey,
    stripHtmlToText,
    fallbackWebSearch,
    fallbackImageSearch,
    extractPageImages,
    maybeWriteToolOutputToFile: (workspaceRootValue, requestedPath, payload) =>
      filesystem.maybeWriteToolOutputToFile(workspaceRootValue, requestedPath, payload, resolveInsideWorkspace),
    ctl,
    env: process.env,
    shell: process.env.ComSpec || "powershell.exe",
    timeoutMs: Number(configValues.defaultTimeoutMs || 30000),
    maxOutputBytes: Number(configValues.maxOutputBytes || 200000),
    process,
    os,
    path,
    fsp: fs.promises,
    Buffer,
    json: JSON.stringify,
    truncateOutput: utils.truncateOutput,
    configSchematics,
  };
}

function getRegisteredTool(configValues, toolName) {
  const tools = [];
  registerWebTools(buildContext(configValues), tools);
  const found = tools.find((entry) => entry.name === toolName);
  if (!found) throw new Error(`Tool not registered: ${toolName}`);
  return found;
}

function parseJsonMaybe(text) {
  if (typeof text !== "string") return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function callTool(configValues, toolName, args) {
  const tool = getRegisteredTool(configValues, toolName);
  const result = await tool.implementation(args);
  return parseJsonMaybe(result);
}

async function runBrowserScriptSimulation(backend) {
  const overrideUrl = String(process.env.BROWSER_SCRIPT_URL || "").trim();
  const output = await callTool(
    { browserAutomationBackend: backend, allowAutoExecution: true },
    "as_web_extract",
    {
      action: "browser_script",
      url: overrideUrl || "https://example.com",
      script_js: `
const first = await helpers.browserAgent.snapshotPage({ limit: 10 });
return {
  title: first.title,
  url: first.url,
  snapshotText: first.snapshotText,
  elementCount: first.elements.length,
  backend: helpers.browserBackend,
  engine: helpers.browserEngine,
};
      `.trim(),
      input_json: "{}",
      output_directory: "reports/web-tool-simulations",
      wait_until: "load",
      timeout_ms: 120000,
      detail: "compact",
    },
  );
  assert.strictEqual(output.success, true, `${backend} browser_script outer command failed: ${output.error || output.stderr || "unknown error"}`);
  const inner = parseJsonMaybe(output.stdout);
  assert(inner && inner.success === true, `${backend} browser_script inner result was not successful.`);
  if (!overrideUrl) {
    assert(inner.result && /Example Domain/i.test(String(inner.result.title || "")), `${backend} browser_script did not reach Example Domain.`);
  }
  assert(/e\d+/.test(String(inner.result.snapshotText || "")), `${backend} browser_script did not expose browserAgent refs.`);
  return {
    backend,
    mode: inner.mode,
    engine: inner.engine,
    title: inner.result?.title || null,
    url: inner.result?.url || null,
    snapshotText: inner.result?.snapshotText || null,
    elementCount: inner.result.elementCount,
  };
}

async function runArchiveSimulation() {
  const outputPath = path.join("reports", "web-tool-simulations", "example-camofox-pdf.pdf");
  const output = await callTool(
    { browserAutomationBackend: "camofox", allowAutoExecution: true },
    "as_web_extract",
    {
      action: "archive",
      url: "https://example.com",
      output_path: outputPath,
      format: "pdf",
      wait_until: "load",
      timeout_ms: 120000,
      detail: "compact",
    },
  );
  assert.strictEqual(output.success, true, `archive outer command failed: ${output.error || output.stderr || "unknown error"}`);
  const inner = parseJsonMaybe(output.stdout);
  assert(inner && inner.success === true, "archive inner result was not successful.");
  assert.strictEqual(inner.requestedBackend, "camofox", "archive test should request the Camoufox backend.");
  assert.strictEqual(inner.effectiveBackend, "playwright", "archive PDF export should fall back to Playwright when Camoufox is selected.");
  assert(fs.existsSync(path.join(root, outputPath)), "archive output file was not created.");
  return {
    requestedBackend: inner.requestedBackend,
    effectiveBackend: inner.effectiveBackend,
    engine: inner.engine,
    outputPath,
  };
}

async function runSiteSearchSimulations() {
  const browserBackend = String(process.env.BROWSER_BACKEND || "camofox").trim().toLowerCase() === "playwright"
    ? "playwright"
    : "camofox";
  const configValues = {
    browserAutomationBackend: browserBackend,
    allowAutoExecution: true,
  };
  const onlySite = String(process.env.ONLY_SITE || "").trim().toLowerCase();
  const websiteChecks = [
    { website: "archive", query: "tolkien" },
    { website: "wikipedia", query: "OpenAI" },
    { website: "reddit", query: "OpenAI" },
    { website: "stackoverflow", query: "TypeScript zod" },
    { website: "stackexchange", query: "PowerShell", site: "superuser" },
    { website: "wikihow", query: "tie a tie" },
    { website: "quora", query: "OpenAI" },
    { website: "youtube", query: "OpenAI" },
    { website: "hackernews", query: "OpenAI" },
    { website: "slashdot", query: "OpenAI" },
    { website: "twitter", query: "OpenAI" },
    { website: "github", query: "openai" },
    { website: "npm", query: "react" },
    { website: "pypi", query: "requests" },
    { website: "arxiv", query: "transformer" },
    { website: "annas_archive", query: "tolkien" },
    { website: "libgen", query: "tolkien" },
    { website: "mdn", query: "fetch" },
    { website: "msdn", query: "powershell" },
  ];
  const selectedChecks = onlySite
    ? websiteChecks.filter((entry) => String(entry.website || "").toLowerCase() === onlySite)
    : websiteChecks;
  if (onlySite && selectedChecks.length === 0) {
    throw new Error(`No site simulation is registered for ONLY_SITE=${onlySite}`);
  }
  const tool = getRegisteredTool(configValues, "as_multi_website_search");
  const results = [];
  for (const item of selectedChecks) {
    console.log(`[site] ${item.website}`);
    const payload = parseJsonMaybe(await tool.implementation({
      website: item.website,
      query: item.query,
      limit: 2,
      language: "en",
      subreddit: "",
      sort: "relevance",
      time: "week",
      site: item.site || "",
      search_engine: "duckduckgo",
      detail: "maximum",
    }));
    console.log(JSON.stringify({ website: item.website, provider: payload.provider, count: Array.isArray(payload.results) ? payload.results.length : null, note: payload.note || null }, null, 2));
    assert(Array.isArray(payload.results), `${item.website} did not return a results array.`);
    assert(payload.results.length > 0, `${item.website} returned no results for query '${item.query}'.`);
    assert(!/duckduckgo|google|fallback/i.test(String(payload.provider || "")), `${item.website} fell back to a generic search provider: ${payload.provider}`);
    results.push({
      website: item.website,
      provider: payload.provider,
      count: payload.results.length,
      firstTitle: payload.results[0]?.title || payload.results[0]?.name || null,
    });
  }
  return results;
}

async function main() {
  const onlySite = String(process.env.ONLY_SITE || "").trim().toLowerCase();
  const onlyBrowserBackend = String(process.env.ONLY_BROWSER_BACKEND || "").trim().toLowerCase();
  const skipSiteSearches = String(process.env.SKIP_SITE_SEARCHES || "").trim() === "1";
  const summary = {
    browserScript: [],
    archive: null,
    siteSearches: [],
  };

  if (!onlySite) {
    if (!onlyBrowserBackend || onlyBrowserBackend === "playwright") {
      console.log("[browser] playwright");
      summary.browserScript.push(await runBrowserScriptSimulation("playwright"));
    }
    if (!onlyBrowserBackend || onlyBrowserBackend === "camofox") {
      console.log("[browser] camofox");
      summary.browserScript.push(await runBrowserScriptSimulation("camofox"));
    }
    console.log("[archive] camofox-pdf");
    summary.archive = await runArchiveSimulation();
  }
  if (!skipSiteSearches) {
    summary.siteSearches = await runSiteSearchSimulations();
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
