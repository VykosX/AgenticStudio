import { tool, type Tool, type ToolsProviderController } from "@lmstudio/sdk";
import { exec, type ExecOptions } from "child_process";
import { promises as fsp } from "fs";
import * as os from "os";
import * as path from "path";
import { z } from "zod";
import YAML from "yaml";
import { configSchematics } from "../config";
import { registerDownloadVideoTool } from "../tools/downloadVideo";
import { registerMathAndUnitTools } from "../tools/mathAndUnits";
import { registerSystemInfoTool } from "../tools/systemInfo";
import { finalizeConsolidatedToolSurface, registerConsolidatedTools } from "../tools/consolidated";
import { registerFilesTools } from "../tools/files";
import { registerDevelopmentTools } from "../tools/development";
import { registerWebTools } from "../tools/web";
import { registerDataMediaTools } from "../tools/dataMedia";
import { registerDesktopAutomationTools } from "../tools/desktopAutomation";
import { registerStatefulTools } from "../tools/stateful";
import { registerMetaTools } from "../tools/meta";
import type {
  CommandResult,
  SubAgentChatResponse,
  SubAgentFunctionDefinition,
  SubAgentMessage,
  ToolDocumentation,
  ToolProfile,
} from "./providerTypes";
import {
  asArray,
  computeFuzzyScore,
  dynamicToolNameSchema,
  escapeForPython,
  indentPython,
  json,
  cavemanifyToolResult,
  expandEnvironmentPath,
  mergeDefined,
  normalize,
  parseJsonArrayOfStrings,
  parseJsonObject,
  quote,
  toNumberOrNull,
  truncateOutput,
} from "./providerUtils";
import {
  detectEnabledPluginsFromLmStudioState,
  getCurrentCavemanState,
  getConversationStorageContext,
  getCurrentConversationIdFromLmStudioState,
  getCurrentRequestedTools,
  getCurrentToolProfile,
  getPluginsRootDirectory,
  getWorkspaceRoot,
  lmStudioRootDirectory,
  lmStudioInternalDirectory,
  migrateMisplacedPluginDataDirectory,
  normalizeToolProfile,
  pluginDataDirectory,
  resolveMemoryPaths,
  resolveTodoPaths,
  writeCurrentCavemanState,
  writeStoredRequestedTools,
  writeStoredToolProfile,
} from "./providerState";
import {
  appendOperationLog,
  batchFileSelectionParameters,
  buildDirectoryTree,
  captureDirectorySnapshot,
  classifyFileCategory,
  collectDirectories,
  collectFiles,
  collectToolSourceFiles,
  countDescendants,
  csvObjectsToRows,
  csvRowsToObjects,
  describePath,
  detectStructuredFormat,
  fileExists,
  jsonMergePatch,
  maybeWriteToolOutputToFile,
  movePathToWorkspaceTrash,
  normalizeSuggestedName,
  overwriteCopy,
  overwriteMove,
  parseCsv,
  pathIsDirectory,
  readJsonFile,
  readMergedRecords,
  readOperationLog,
  readWatcher,
  resolveDefaultToolOutputPath,
  resolveBatchFileTargets,
  resolveInsideDirectory,
  stringifyCsv,
  unifiedDiff,
  writeJsonFile,
  writeWatcher,
} from "./providerFilesystem";
import {
  assertCommandAllowed,
  buildCommandResponse,
  buildCommandResponsePayload,
  buildEnv,
  buildManagedCommandResponse,
  executeInlineNodeScript,
  executeInlinePython,
  executeManagedCommand,
  firecrawlApiRequest,
  firecrawlPollUntilDone,
  getAllowAutoExecution,
  getAllowFullFilesystemAccess,
  getCommandPolicy,
  getCommandOverride,
  getConfiguredExecutable,
  getDenoExecutablePath,
  getDirectoryDeleteConfirmationCount,
  getFileDeletionMode,
  getFirecrawlApiKey,
  getMaxOutputBytes,
  getNodeExecutablePath,
  getPython,
  getScreenshotDirectorySetting,
  getShell,
  getTimeoutMs,
  getWatcherDefaultLimit,
  powerShellCommand,
  powerShellScript,
  refreshProcessEnvironmentFromWindowsRegistry,
  resolveExecutablePath,
  runCommand,
} from "./providerCommands";
import {
  basicToolRecord,
  compactToolRecord,
  discoverPluginInventory,
  discoverToolDocumentation,
  filterDisabledOnly,
  filterToolsByProfile,
  findMatchingTool,
  findSimilarTools,
  normalizeQueryToolList,
  recommendToolsForGoal,
  runtimeToolSchema,
  standardToolRecord,
  summarizeToolNamesByPlugin,
  writeToFileParameter,
} from "./providerCatalog";

let allowFullFilesystemAccessMode = false;

function resolveInsideWorkspace(root: string, requestedPath: string): string {
  let expandedPath = expandEnvironmentPath(String(requestedPath || ""));
  if (process.platform === "win32" && /^[\\/](?![\\/])/.test(expandedPath) && !/^[A-Za-z]:[\\/]/.test(expandedPath)) {
    expandedPath = expandedPath.replace(/^[\\/]+/, "");
  }
  const resolved = path.resolve(root, expandedPath);
  if (allowFullFilesystemAccessMode) {
    return path.isAbsolute(expandedPath) ? path.resolve(expandedPath) : resolved;
  }
  const lowerResolved = resolved.toLowerCase();
  const lowerRoot = path.resolve(root).toLowerCase();
  if (!lowerResolved.startsWith(lowerRoot + path.sep) && lowerResolved !== lowerRoot) {
    throw new Error(`Access denied: '${requestedPath}' is outside the workspace.`);
  }
  return resolved;
}

function getZstdCompressionLevel(ctl: ToolsProviderController): number {
  return (ctl.getPluginConfig(configSchematics).get("zstdCompressionLevel") as number | undefined) ?? 10;
}

async function commandAvailable(
  command: string,
  cwd: string,
  shell: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
  maxOutputBytes: number,
): Promise<boolean> {
  const checkCommand = process.platform === "win32" ? `where ${command}` : `command -v ${command}`;
  const result = await runCommand(checkCommand, { cwd, shell, env }, timeoutMs, maxOutputBytes);
  return !result.error && result.exitCode === 0;
}

async function pythonModuleAvailable(
  moduleName: string,
  cwd: string,
  pythonExecutable: string,
  shell: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
  maxOutputBytes: number,
): Promise<boolean> {
  const result = await runCommand(`${quote(pythonExecutable)} -m ${moduleName} --version`, { cwd, shell, env }, timeoutMs, maxOutputBytes);
  return !result.error && result.exitCode === 0;
}

type ResolvedCompiler = {
  name: "clang++" | "g++" | "cl";
  command: string;
  shellOverride?: string;
  versionCommand?: string;
  detectedBy?: string;
};

function getVswherePath(ctl: ToolsProviderController): string {
  return getConfiguredExecutable(ctl, "vswherePath") || "C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe";
}

async function resolveWindowsVcVarsPath(
  ctl: ToolsProviderController,
  cwd: string,
  shell: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
  maxOutputBytes: number,
): Promise<string | null> {
  if (process.platform !== "win32") return null;
  const configured = getConfiguredExecutable(ctl, "msvcVcVarsPath");
  if (configured && await fileExists(configured)) {
    return configured;
  }
  const vswherePath = getVswherePath(ctl);
  if (!(await fileExists(vswherePath))) {
    return null;
  }
  const query = `${quote(vswherePath)} -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -find VC\\Auxiliary\\Build\\vcvars64.bat`;
  const result = await runCommand(query, { cwd, shell, env }, timeoutMs, maxOutputBytes);
  const discovered = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return discovered && await fileExists(discovered) ? discovered : null;
}

async function resolveCompilerCandidates(
  ctl: ToolsProviderController,
  cwd: string,
  shell: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
  maxOutputBytes: number,
  compilerPreference: string,
): Promise<ResolvedCompiler[]> {
  const preference = String(compilerPreference || "auto");
  const names = (() => {
    if (process.platform === "win32") {
      if (preference === "msvc") return ["cl", "clang++", "g++"];
      if (preference === "gcc") return ["g++", "clang++", "cl"];
      return ["clang++", "g++", "cl"];
    }
    if (preference === "gcc") return ["g++", "clang++"];
    return ["clang++", "g++"];
  })();
  const resolved: ResolvedCompiler[] = [];
  for (const name of names) {
    if (name === "cl") {
      if (await commandAvailable("cl", cwd, shell, env, timeoutMs, maxOutputBytes)) {
        resolved.push({ name: "cl", command: "cl", versionCommand: "cl", detectedBy: "path" });
        continue;
      }
      const vcVarsPath = await resolveWindowsVcVarsPath(ctl, cwd, shell, env, timeoutMs, maxOutputBytes);
      if (vcVarsPath) {
        const vcCommandPrefix = `call ${quote(vcVarsPath)} >nul &&`;
        resolved.push({
          name: "cl",
          command: `${vcCommandPrefix} cl`,
          versionCommand: `${vcCommandPrefix} cl`,
          shellOverride: "cmd.exe",
          detectedBy: "vcvars64",
        });
      }
      continue;
    }
    if (await commandAvailable(name, cwd, shell, env, timeoutMs, maxOutputBytes)) {
      resolved.push({ name: name as "clang++" | "g++", command: name, versionCommand: `${name} --version`, detectedBy: "path" });
    }
  }
  return resolved;
}

function dynamicToolsDirectory(_root: string): string {
  return path.join(pluginDataDirectory(), "tools");
}

function workspaceTrashDirectory(_root: string): string {
  return path.join(pluginDataDirectory(), "trash");
}

function operationsLogPath(_root: string): string {
  return path.join(pluginDataDirectory(), "operations", "operations.log");
}

function reorgPlansDirectory(_root: string): string {
  return path.join(pluginDataDirectory(), "plans");
}

function fileWatchersDirectory(_root: string): string {
  return path.join(pluginDataDirectory(), "watchers");
}

function skillsDirectory(_root: string): string {
  return path.join(pluginDataDirectory(), "default", "skills");
}

function screenshotsDirectory(_root: string): string {
  return path.join(pluginDataDirectory(), "screenshots");
}

function escapeForPowerShellSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

type ReorgPlanEntry = {
  source: string;
  destination: string;
  category: string;
  reason: string;
};

function summarizeByPlugin(docs: ToolDocumentation[]): Array<Record<string, unknown>> {
  const grouped = new Map<string, { plugin: string; pluginLabel: string; liveCount: number; categories: Map<string, number>; sampleTools: string[] }>();
  for (const doc of docs) {
    const key = doc.plugin;
    let bucket = grouped.get(key);
    if (!bucket) {
      bucket = {
        plugin: doc.plugin,
        pluginLabel: doc.pluginLabel || doc.plugin,
        liveCount: 0,
        categories: new Map<string, number>(),
        sampleTools: [],
      };
      grouped.set(key, bucket);
    }
    bucket.liveCount += 1;
    bucket.categories.set(doc.category, (bucket.categories.get(doc.category) || 0) + 1);
    if (bucket.sampleTools.length < 8) {
      bucket.sampleTools.push(doc.name);
    }
  }
  return [...grouped.values()]
    .sort((a, b) => a.plugin.localeCompare(b.plugin))
    .map((bucket) => ({
      plugin: bucket.plugin,
      pluginLabel: bucket.pluginLabel,
      toolCount: bucket.liveCount,
      topCategories: [...bucket.categories.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5)
        .map(([category, count]) => ({ category, count })),
      sampleTools: bucket.sampleTools,
    }));
}

let currentSubAgentDepth = 0;

function getNormalizedLmStudioEndpoint(ctl: ToolsProviderController): string {
  const raw = (ctl.getPluginConfig(configSchematics).get("lmStudioEndpoint") as string | undefined)?.trim() || "http://localhost:1234/v1";
  const normalized = raw.replace(/\/+$/, "");
  return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
}

function getSubAgentPermissionLevel(ctl: ToolsProviderController): "read_only" | "standard" | "full" {
  const value = (ctl.getPluginConfig(configSchematics).get("subAgentPermissions") as string | undefined) || "standard";
  return value === "read_only" || value === "full" ? value : "standard";
}

function getSubAgentProfiles(ctl: ToolsProviderController): Record<string, string> {
  const raw = (ctl.getPluginConfig(configSchematics).get("subAgentProfiles") as string | undefined)?.trim() || "";
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

async function listLoadedModelsForSubAgent(endpoint: string): Promise<string[]> {
  try {
    const response = await fetch(`${endpoint}/models`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return [];
    const data = await response.json() as { data?: Array<{ id?: string }> };
    return (data.data || []).map((entry) => entry.id || "").filter(Boolean);
  } catch {
    return [];
  }
}

async function resolveSubAgentModel(endpoint: string, preferredModelId: string): Promise<string> {
  const loaded = await listLoadedModelsForSubAgent(endpoint);
  if (preferredModelId && loaded.includes(preferredModelId)) return preferredModelId;
  if (loaded.length >= 2) return loaded[1];
  if (loaded.length >= 1) return loaded[0];
  return preferredModelId || "local-model";
}

function buildSubAgentToolDefinitions(permission: "read_only" | "standard" | "full"): SubAgentFunctionDefinition[] {
  const definitions: SubAgentFunctionDefinition[] = [
    {
      name: "read_file",
      description: "Read a text file from the workspace.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    },
    {
      name: "list_directory",
      description: "List files and folders in a directory.",
      parameters: { type: "object", properties: { path: { type: "string" }, recursive: { type: "boolean" }, limit: { type: "number" } } },
    },
    {
      name: "file_stat",
      description: "Get metadata for a file or folder.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    },
    {
      name: "search_text",
      description: "Search text content across files in a directory.",
      parameters: { type: "object", properties: { query: { type: "string" }, directory: { type: "string" }, limit: { type: "number" } }, required: ["query"] },
    },
    {
      name: "fetch_web_content",
      description: "Fetch a web page and return readable text.",
      parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
    },
  ];
  if (permission === "standard" || permission === "full") {
    definitions.push(
      {
        name: "write_file",
        description: "Write content to a file in the workspace.",
        parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
      },
      {
        name: "replace_text_in_file",
        description: "Replace unique text in a file.",
        parameters: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] },
      },
      {
        name: "make_directory",
        description: "Create a directory.",
        parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      },
      {
        name: "copy_path",
        description: "Copy a file or directory.",
        parameters: { type: "object", properties: { source: { type: "string" }, destination: { type: "string" }, overwrite: { type: "boolean" } }, required: ["source", "destination"] },
      },
      {
        name: "move_path",
        description: "Move or rename a file or directory.",
        parameters: { type: "object", properties: { source: { type: "string" }, destination: { type: "string" }, overwrite: { type: "boolean" } }, required: ["source", "destination"] },
      },
      {
        name: "delete_path",
        description: "Delete or trash a file or directory.",
        parameters: { type: "object", properties: { path: { type: "string" }, recursive: { type: "boolean" }, confirmed: { type: "boolean" } }, required: ["path"] },
      },
    );
  }
  if (permission === "full") {
    definitions.push(
      {
        name: "run_command",
        description: "Run a shell command inside the workspace.",
        parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
      },
      {
        name: "run_python_code",
        description: "Execute Python code.",
        parameters: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
      },
    );
  }
  return definitions;
}

async function fetchWebReadableText(url: string, maxChars: number): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const html = await response.text();
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, maxChars);
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function absolutizeUrl(candidate: string, baseUrl: string): string | null {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
}

async function fallbackWebSearch(query: string, limit: number): Promise<Array<Record<string, unknown>>> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(30000),
  });
  const html = await response.text();
  const matches = [...html.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const results: Array<Record<string, unknown>> = [];
  for (const match of matches) {
    const href = (match[1] || "").replace(/&amp;/g, "&");
    const title = stripHtmlToText(match[2] || "");
    if (!href || !title) continue;
    let finalUrl = href;
    try {
      const parsed = new URL(href, "https://duckduckgo.com");
      const uddg = parsed.searchParams.get("uddg");
      if (uddg) finalUrl = decodeURIComponent(uddg);
    } catch {
      // keep href as-is
    }
    results.push({ title, url: finalUrl });
    if (results.length >= limit) break;
  }
  return results;
}

async function fallbackImageSearch(query: string, limit: number): Promise<Array<Record<string, unknown>>> {
  const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC3`;
  const response = await fetch(bingUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(30000),
  });
  const html = await response.text();
  const matches = [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi)];
  const results: Array<Record<string, unknown>> = [];
  const imageCards = [...html.matchAll(/<a[^>]+class="[^"]*\biusc\b[^"]*"[^>]+m="([^"]+)"[^>]*>/gi)];
  for (const match of imageCards) {
    const rawMetadata = (match[1] || "")
      .replace(/&quot;/gi, "\"")
      .replace(/&#34;/gi, "\"")
      .replace(/&amp;/gi, "&");
    try {
      const metadata = JSON.parse(rawMetadata);
      const imageUrl = absolutizeUrl(metadata.murl || "", bingUrl);
      if (!imageUrl) continue;
      results.push({
        title: stripHtmlToText(metadata.t || metadata.desc || ""),
        imageUrl,
        thumbnailUrl: absolutizeUrl(metadata.turl || "", bingUrl),
        sourceUrl: absolutizeUrl(metadata.purl || "", bingUrl),
      });
      if (results.length >= limit) return results;
    } catch {
      // Fall back to img parsing below.
    }
  }
  for (const match of matches) {
    const src = absolutizeUrl(match[1] || "", bingUrl);
    if (!src || src.includes("bing.com") || src.includes("mm.bing.net")) continue;
    results.push({ imageUrl: src, alt: match[2] || "" });
    if (results.length >= limit) break;
  }
  return results;
}

async function extractPageImages(url: string, limit: number): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30000) });
  const html = await response.text();
  const matches = [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi)];
  const results: Array<Record<string, unknown>> = [];
  for (const match of matches) {
    const imageUrl = absolutizeUrl(match[1] || "", response.url || url);
    if (!imageUrl) continue;
    results.push({ imageUrl, alt: match[2] || "" });
    if (results.length >= limit) break;
  }
  return results;
}

async function executeSubAgentTool(
  ctl: ToolsProviderController,
  name: string,
  argsJson: string,
  context: {
    workspaceRoot: string;
    cwd: string;
    shell: string;
    env: NodeJS.ProcessEnv;
    timeoutMs: number;
    maxOutputBytes: number;
    pythonExecutable: string;
  },
  filesModified: string[],
): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson || "{}");
  } catch {
    return `Error: invalid JSON arguments for tool ${name}.`;
  }
  const rel = (value: string) => path.relative(context.workspaceRoot, value) || ".";
  switch (name) {
    case "read_file": {
      const fullPath = resolveInsideWorkspace(context.cwd, String(args.path || ""));
      const text = await fsp.readFile(fullPath, "utf8");
      return truncateOutput(text, context.maxOutputBytes);
    }
    case "list_directory": {
      const dirPath = resolveInsideWorkspace(context.cwd, String(args.path || "."));
      const recursive = Boolean(args.recursive);
      const limit = Number(args.limit || 100);
      const entries: Array<Record<string, unknown>> = [];
      const visit = async (currentDir: string): Promise<void> => {
        if (entries.length >= limit) return;
        for (const entry of await fsp.readdir(currentDir, { withFileTypes: true })) {
          if (entries.length >= limit) break;
          const fullPath = path.join(currentDir, entry.name);
          entries.push(await describePath(fullPath, context.workspaceRoot));
          if (recursive && entry.isDirectory()) await visit(fullPath);
        }
      };
      await visit(dirPath);
      return json({ path: rel(dirPath), entries });
    }
    case "file_stat": {
      const fullPath = resolveInsideWorkspace(context.cwd, String(args.path || ""));
      return json(await describePath(fullPath, context.workspaceRoot));
    }
    case "search_text": {
      const query = String(args.query || "");
      const startDir = resolveInsideWorkspace(context.cwd, String(args.directory || "."));
      const limit = Number(args.limit || 50);
      const files = await collectFiles(startDir, 2000);
      const results: Array<Record<string, unknown>> = [];
      for (const filePath of files) {
        if (results.length >= limit) break;
        try {
          const content = await fsp.readFile(filePath, "utf8");
          const index = content.toLowerCase().indexOf(query.toLowerCase());
          if (index >= 0) {
            results.push({
              path: rel(filePath),
              preview: content.slice(Math.max(0, index - 80), Math.min(content.length, index + 160)),
            });
          }
        } catch {
          continue;
        }
      }
      return json({ query, results });
    }
    case "fetch_web_content": {
      return await fetchWebReadableText(String(args.url || ""), 6000);
    }
    case "write_file": {
      const fullPath = resolveInsideWorkspace(context.cwd, String(args.path || ""));
      await fsp.mkdir(path.dirname(fullPath), { recursive: true });
      await fsp.writeFile(fullPath, String(args.content || ""), "utf8");
      filesModified.push(rel(fullPath));
      return json({ success: true, path: rel(fullPath) });
    }
    case "replace_text_in_file": {
      const fullPath = resolveInsideWorkspace(context.cwd, String(args.path || ""));
      const oldText = String(args.old_text || "");
      if (!oldText) return "Error: old_text must not be empty.";
      const newText = String(args.new_text || "");
      const original = await fsp.readFile(fullPath, "utf8");
      const count = original.split(oldText).length - 1;
      if (count !== 1) return `Error: expected exactly one match, found ${count}.`;
      await fsp.writeFile(fullPath, original.replace(oldText, newText), "utf8");
      filesModified.push(rel(fullPath));
      return json({ success: true, path: rel(fullPath) });
    }
    case "make_directory": {
      const fullPath = resolveInsideWorkspace(context.cwd, String(args.path || ""));
      await fsp.mkdir(fullPath, { recursive: true });
      return json({ success: true, path: rel(fullPath) });
    }
    case "copy_path": {
      const sourcePath = resolveInsideWorkspace(context.cwd, String(args.source || ""));
      const destinationPath = resolveInsideWorkspace(context.cwd, String(args.destination || ""));
      const overwrite = Boolean(args.overwrite);
      await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
      await fsp.cp(sourcePath, destinationPath, { recursive: true, force: overwrite, errorOnExist: !overwrite });
      filesModified.push(rel(destinationPath));
      return json({ success: true, source: rel(sourcePath), destination: rel(destinationPath) });
    }
    case "move_path": {
      const sourcePath = resolveInsideWorkspace(context.cwd, String(args.source || ""));
      const destinationPath = resolveInsideWorkspace(context.cwd, String(args.destination || ""));
      const overwrite = Boolean(args.overwrite);
      if (await fileExists(destinationPath)) {
        if (!overwrite) return "Error: destination exists and overwrite is false.";
        await fsp.rm(destinationPath, { recursive: true, force: true });
      }
      await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
      await fsp.rename(sourcePath, destinationPath);
      filesModified.push(rel(destinationPath));
      return json({ success: true, source: rel(sourcePath), destination: rel(destinationPath) });
    }
    case "delete_path": {
      const targetPath = resolveInsideWorkspace(context.cwd, String(args.path || ""));
      const stat = await fsp.lstat(targetPath);
      if (stat.isDirectory() && !Boolean(args.recursive)) return "Error: recursive must be true for directories.";
      let descendantCount = 0;
      if (stat.isDirectory()) {
        descendantCount = await countDescendants(targetPath, getDirectoryDeleteConfirmationCount(ctl));
        if (descendantCount >= getDirectoryDeleteConfirmationCount(ctl) && !Boolean(args.confirmed)) {
          return json({ success: false, requiresConfirmation: true, path: rel(targetPath), descendantCount });
        }
      }
      if (getFileDeletionMode(ctl) === "trash") {
        const trashedTo = await movePathToWorkspaceTrash(targetPath, context.workspaceRoot);
        filesModified.push(rel(targetPath));
        return json({ success: true, deletionMode: "trash", trashName: path.basename(trashedTo), path: rel(targetPath) });
      }
      await fsp.rm(targetPath, { recursive: true, force: true });
      return json({ success: true, deletionMode: "permanent", path: rel(targetPath) });
    }
    case "run_command": {
      const command = String(args.command || "");
      return await buildManagedCommandResponse(ctl, command, { cwd: context.cwd, shell: context.shell, env: context.env }, context.timeoutMs, context.maxOutputBytes);
    }
    case "run_python_code": {
      const code = String(args.code || "");
      const result = await executeInlinePython(ctl, context.pythonExecutable, code, context.shell, context.env, context.cwd, context.timeoutMs, context.maxOutputBytes);
      return buildCommandResponse("python inline", result);
    }
    default:
      return `Error: Unknown sub-agent tool ${name}.`;
  }
}

async function autoSaveSubAgentCodeBlocks(
  content: string,
  workingDir: string,
  workspaceRoot: string,
  filesModified: string[],
): Promise<string> {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const matches = Array.from(content.matchAll(codeBlockRegex));
  let updated = content;
  for (const match of matches) {
    const lang = (match[1] || "").trim();
    const code = match[2];
    const header = updated.slice(Math.max(0, (match.index || 0) - 300), match.index || 0);
    const fileMatch = header.match(/([\w./\\-]+\.(?:ts|tsx|js|jsx|json|md|py|sh|yaml|yml|txt|css|html|sql|c|cpp|h|hpp))/i);
    if (!fileMatch || !code.trim()) continue;
    const filePath = resolveInsideWorkspace(workingDir, fileMatch[1]);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, code, "utf8");
    const relPath = path.relative(workspaceRoot, filePath);
    if (!filesModified.includes(relPath)) filesModified.push(relPath);
    updated = updated.replace(match[0], `[System: Saved code block to ${relPath}${lang ? ` (${lang})` : ""}]`);
  }
  return updated;
}

async function chatCompletionForSubAgent(
  endpoint: string,
  model: string,
  messages: SubAgentMessage[],
  tools: SubAgentFunctionDefinition[],
  timeoutMs: number,
): Promise<SubAgentChatResponse> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.3,
    max_tokens: 2048,
  };
  if (tools.length > 0) {
    body.tools = tools.map((toolDef) => ({ type: "function", function: toolDef }));
    body.tool_choice = "auto";
  }
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Sub-agent API error ${response.status}: ${text}`);
  }
  return await response.json() as SubAgentChatResponse;
}

export async function toolsProvider(ctl: ToolsProviderController): Promise<Tool[]> {
  await migrateMisplacedPluginDataDirectory();
  allowFullFilesystemAccessMode = getAllowFullFilesystemAccess(ctl);
  const currentToolProfile = await getCurrentToolProfile(ctl);
  const allowIndividualToolRequests = ((ctl.getPluginConfig(configSchematics).get("allowIndividualToolRequests") as boolean | undefined) ?? true) === true;
  const currentRequestedToolNames = allowIndividualToolRequests ? await getCurrentRequestedTools() : [];
  const workspaceRoot = getWorkspaceRoot(ctl);
  const shell = getShell(ctl);
  const pythonExecutable = getPython(ctl);
  const timeoutMs = getTimeoutMs(ctl);
  const maxOutputBytes = getMaxOutputBytes(ctl);
  const env = buildEnv(ctl);
  const cavemanState = await getCurrentCavemanState();
  const configuredCavemanProfile = ((ctl.getPluginConfig(configSchematics).get("cavemanSkillProfile") as string | undefined) || "normal");
  const configuredCavemanifyResults = (ctl.getPluginConfig(configSchematics).get("cavemanifyToolResults") as boolean | undefined) ?? false;
  const cavemanControl = {
    skipNextToolPending: cavemanState.skipNextTool,
    skipTurnActive: cavemanState.skipTurnStage === "active",
    effectiveCavemanMode: cavemanState.modeOverride || configuredCavemanProfile,
  };
  const cavemanToolReminder = "Respond terse like smart caveman. Technical substance stay. Fluff die. Active every response.";
  const rawResultJson = (value: unknown) => json(value);
  const shouldBypassCavemanRewrite = (toolName: string, params: Record<string, unknown>) => {
    if (toolName === "as_skill_recommend") return true;
    if (toolName === "as_tool_help" && String(params.goal || "").trim()) return true;
    return false;
  };
  const appendCavemanReminder = (value: unknown): unknown => {
    if (typeof value === "string") {
      return value.includes(cavemanToolReminder) ? value : `${value}\n\n${cavemanToolReminder}`;
    }
    if (Array.isArray(value)) {
      return { results: value, caveman_reminder: cavemanToolReminder };
    }
    if (value && typeof value === "object") {
      return { ...(value as Record<string, unknown>), caveman_reminder: cavemanToolReminder };
    }
    return { value, caveman_reminder: cavemanToolReminder };
  };
  const finalizeToolResult = (toolName: string, params: Record<string, unknown>, value: unknown) => {
    const shouldSkipThisTool = cavemanControl.skipNextToolPending;
    if (shouldSkipThisTool) {
      cavemanControl.skipNextToolPending = false;
      void writeCurrentCavemanState({ skipNextTool: false });
    }
    const cavemanModeActive = !shouldSkipThisTool
      && !cavemanControl.skipTurnActive
      && cavemanControl.effectiveCavemanMode !== "normal";
    let normalizedValue = value;
    if (typeof normalizedValue === "string") {
      try {
        normalizedValue = JSON.parse(normalizedValue);
      } catch {
        // Leave plain text results untouched.
      }
    }
    const shouldCavemanify = cavemanModeActive
      && configuredCavemanifyResults
      && !shouldBypassCavemanRewrite(toolName, params);
    if (shouldCavemanify) {
      normalizedValue = cavemanifyToolResult(normalizedValue);
    }
    if (cavemanModeActive) {
      normalizedValue = appendCavemanReminder(normalizedValue);
    }
    return normalizedValue;
  };

  const safeTool = <T extends Record<string, unknown>>(name: string, fn: (params: T) => Promise<any>) =>
    async (params: T) => {
      try {
        return finalizeToolResult(name, params, await fn(params));
      } catch (error: any) {
        return finalizeToolResult(name, params, {
          tool: name,
          success: false,
          error: error?.message ?? String(error),
        });
      }
    };

  const requireCommandExecution = () => {
    if (!getAllowAutoExecution(ctl)) {
      throw new Error("Command-based helper tools are disabled because 'Allow Automatic Execution' is off in agentic-studio settings.");
    }
  };

  const subAgentRuntime = {
    getDepth: () => currentSubAgentDepth,
    incrementDepth: () => {
      currentSubAgentDepth += 1;
    },
    decrementDepth: () => {
      currentSubAgentDepth = Math.max(0, currentSubAgentDepth - 1);
    },
    getNormalizedLmStudioEndpoint,
    getSubAgentPermissionLevel,
    getSubAgentProfiles,
    resolveSubAgentModel,
    buildSubAgentToolDefinitions,
    chatCompletionForSubAgent,
    executeSubAgentTool,
    autoSaveSubAgentCodeBlocks,
  };

  const tools: Tool[] = [];
  const sharedToolContext = {
    tool,
    z,
    safeTool,
    configSchematics,
    requireCommandExecution,
    workspaceRoot,
    allowFullFilesystemAccessMode,
    resolveInsideWorkspace,
    resolveInsideDirectory,
    readJsonFile,
    writeJsonFile,
    readMergedRecords,
    pluginDataDirectory,
    getConversationStorageContext,
    resolveMemoryPaths,
    resolveTodoPaths,
    unifiedDiff,
    parseCsv,
    stringifyCsv,
    csvRowsToObjects,
    csvObjectsToRows,
    batchFileSelectionParameters,
    resolveBatchFileTargets,
    collectFiles,
    collectDirectories,
    describePath,
    detectStructuredFormat,
    jsonMergePatch,
    classifyFileCategory,
    normalizeSuggestedName,
    buildDirectoryTree,
    pathIsDirectory,
    dynamicToolsDirectory,
    workspaceTrashDirectory,
    reorgPlansDirectory,
    fileWatchersDirectory,
    skillsDirectory,
    screenshotsDirectory,
    escapeForPowerShellSingleQuoted,
    appendOperationLog,
    readOperationLog,
    overwriteMove,
    overwriteCopy,
    captureDirectorySnapshot,
    readWatcher,
    writeWatcher,
    countDescendants,
    movePathToWorkspaceTrash,
    fileExists,
    quote,
    runCommand,
    powerShellCommand,
    powerShellScript,
    buildCommandResponse,
    buildCommandResponsePayload,
    buildManagedCommandResponse,
    executeManagedCommand,
    commandAvailable,
    pythonModuleAvailable,
    resolveCompilerCandidates,
    executeInlinePython,
    executeInlineNodeScript,
    resolveExecutablePath,
    getNodeExecutablePath,
    getDenoExecutablePath,
    getWatcherDefaultLimit,
    getScreenshotDirectorySetting,
    getZstdCompressionLevel,
    getDirectoryDeleteConfirmationCount,
    getFileDeletionMode,
    getFirecrawlApiKey,
    assertCommandAllowed,
    refreshProcessEnvironmentFromWindowsRegistry,
    getConfiguredExecutable,
    getCommandOverride,
    computeFuzzyScore,
    escapeForPython,
    indentPython,
    parseJsonArrayOfStrings,
    parseJsonObject,
    mergeDefined,
    firecrawlApiRequest,
    firecrawlPollUntilDone,
    stripHtmlToText,
    fallbackWebSearch,
    fallbackImageSearch,
    extractPageImages,
    discoverToolDocumentation,
    discoverPluginInventory,
    filterDisabledOnly,
    detectEnabledPluginsFromLmStudioState,
    normalizeToolProfile,
    currentToolProfile,
    currentRequestedToolNames,
    allowIndividualToolRequests,
    getCurrentConversationIdFromLmStudioState,
    writeStoredRequestedTools,
    writeStoredToolProfile,
    resolveDefaultToolOutputPath,
    maybeWriteToolOutputToFile: (root: string, requestedPath: string, payload: unknown) =>
      maybeWriteToolOutputToFile(root, requestedPath, payload, resolveInsideWorkspace),
    compactToolRecord,
    basicToolRecord,
    standardToolRecord,
    summarizeToolNamesByPlugin,
    findMatchingTool,
    normalizeQueryToolList,
    findSimilarTools,
    recommendToolsForGoal,
    runtimeToolSchema,
    writeToFileParameter,
    dynamicToolNameSchema,
    buildEnvironment: buildEnv,
    resolveCommandPolicy: getCommandPolicy,
    currentDate: new Date().toISOString(),
    rawJson: rawResultJson,
    effectiveCavemanMode: cavemanControl.effectiveCavemanMode,
    cavemanState,
    cavemanControl,
    writeCurrentCavemanState,
    toolsProvider,
    subAgentRuntime,
    ctl,
    env,
    shell,
    timeoutMs,
    maxOutputBytes,
    pythonExecutable,
    process,
    os,
    path,
    fsp,
    Buffer,
    YAML,
    json: rawResultJson,
    normalize,
    asArray,
    toNumberOrNull,
    truncateOutput,
    filterToolsByProfile,
  };
  registerMetaTools({ ...sharedToolContext, tools }, tools);
  registerFilesTools({ ...sharedToolContext, tools }, tools);
  registerDevelopmentTools({ ...sharedToolContext, tools }, tools);
  registerWebTools({ ...sharedToolContext, tools }, tools);
  registerDataMediaTools({ ...sharedToolContext, tools }, tools);
  registerDesktopAutomationTools({ ...sharedToolContext, tools }, tools);
  registerStatefulTools({ ...sharedToolContext, tools }, tools);
  registerDownloadVideoTool({ ...sharedToolContext, tools }, tools);
  registerMathAndUnitTools({ ...sharedToolContext, tools }, tools);
  registerSystemInfoTool({ ...sharedToolContext, tools }, tools);
  registerConsolidatedTools({ ...sharedToolContext, tools }, tools);

  const publicTools = finalizeConsolidatedToolSurface(tools, ctl);
  tools.splice(0, tools.length, ...publicTools);
  return filterToolsByProfile(tools, currentToolProfile, currentRequestedToolNames);
}

