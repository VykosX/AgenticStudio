// @ts-nocheck
import type { ToolModuleContext } from "../shared/toolModule";

export function registerWebTools(ctx: ToolModuleContext, tools: any[]): void {
  const { tool, z, safeTool, requireCommandExecution, workspaceRoot, resolveInsideWorkspace, batchFileSelectionParameters, resolveBatchFileTargets, fileExists, quote, buildCommandResponse, buildCommandResponsePayload, executeManagedCommand, executeInlineNodeScript, resolveExecutablePath, getNodeExecutablePath, getDenoExecutablePath, parseJsonArrayOfStrings, parseJsonObject, mergeDefined, firecrawlApiRequest, firecrawlPollUntilDone, getFirecrawlApiKey, stripHtmlToText, fallbackWebSearch, fallbackImageSearch, extractPageImages, maybeWriteToolOutputToFile, ctl, env, shell, timeoutMs, maxOutputBytes, process, os, path, fsp, Buffer, json, truncateOutput, configSchematics } = ctx as any;

  const downloadableExtensions = new Set([
    ".7z", ".aac", ".azw3", ".bz2", ".csv", ".doc", ".docx", ".epub", ".flac", ".gz", ".jpeg", ".jpg",
    ".json", ".m4a", ".mobi", ".mov", ".mp3", ".mp4", ".odp", ".ods", ".odt", ".ogg", ".opus", ".pdf",
    ".png", ".rar", ".tar", ".tgz", ".torrent", ".txt", ".wav", ".webm", ".xls", ".xlsx", ".xml", ".zip",
  ]);

  const videoDownloaderHosts = [
    "youtube.com", "youtu.be", "vimeo.com", "tiktok.com", "twitch.tv", "soundcloud.com", "bandcamp.com",
    "instagram.com", "x.com", "twitter.com", "facebook.com", "fb.watch", "dailymotion.com", "bilibili.com",
    "odysee.com", "rumble.com",
  ];
  const WEB_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0 Safari/537.36";
  const TEXT_PREVIEW_CHARS = 1600;
  const RESULT_SAMPLE_LIMIT = 12;
  const REPORT_READ_GUIDANCE = "Report spilled to disk. Do not read whole file by default. First narrow with as_file_search_text on keywords, ids, errors, URLs, or titles. Then use as_file_read with offset/length only on the matching regions you actually need.";
  const PYPI_SIMPLE_INDEX_TTL_MS = 24 * 60 * 60 * 1000;
  let pypiSimpleIndexCache: { fetchedAt: number; projectNames: string[] } | null = null;
  const normalizeDetailLevel = (value: unknown) => {
    const normalized = String(value || "compact").trim().toLowerCase();
    if (normalized === "maximum") return "max";
    return normalized === "full" || normalized === "max" ? normalized : "compact";
  };
  const createReportPath = (toolName: string, label: string, extension = "json") =>
    path.join("reports", `${toolName}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`);
  const pluginRoot = path.resolve(__dirname, "..", "..");
  const DEFAULT_SEARCH_PAGE_SIZE = 5;
  const compactObject = (value: Record<string, unknown>, keys: string[]) => Object.fromEntries(
    keys
      .filter((key) => value[key] !== undefined && value[key] !== null && value[key] !== "")
      .map((key) => [key, value[key]]),
  );
  const compactSearchRecord = (entry: Record<string, unknown>) => compactObject(entry, [
    "title", "name", "identifier", "url", "link", "href", "outboundUrl", "hnUrl",
    "snippet", "description", "summary", "author", "creator", "subreddit",
    "score", "points", "comments", "answers", "accepted", "published", "publishedDate",
    "createdUtc", "year", "mediaType", "provider", "source", "imageUrl", "thumbnailUrl",
    "thumbnail", "width", "height",
  ]);
  const compactTorrentRecord = (entry: Record<string, unknown>) => compactObject(entry, [
    "name", "hash", "state", "progress", "size", "total_size", "dlspeed", "upspeed",
    "downloaded", "uploaded", "eta", "num_seeds", "num_leechs", "save_path", "category",
    "tracker", "url", "availability",
  ]);
  const compactTorrentFileRecord = (entry: Record<string, unknown>) => compactObject(entry, [
    "index", "name", "size", "progress", "priority", "is_seed", "piece_range", "availability",
  ]);
  const encodeInlineNodeLiteral = (value: string) => Buffer.from(String(value || ""), "utf8").toString("base64");
  const compactTextPayload = async (toolName: string, detailLevel: string, label: string, text: string, metadata: Record<string, unknown> = {}) => {
    const preview = String(text || "").slice(0, TEXT_PREVIEW_CHARS);
    const payload: Record<string, unknown> = {
      ...metadata,
      detail: detailLevel,
      [`${label}Preview`]: detailLevel === "full" ? String(text || "") : preview,
      [`${label}Length`]: String(text || "").length,
      [`${label}Truncated`]: String(text || "").length > preview.length,
    };
    if (detailLevel === "compact" && String(text || "").length > preview.length) {
      payload[`${label}ReportPath`] = await maybeWriteToolOutputToFile(
        workspaceRoot,
        createReportPath(toolName, label),
        { ...metadata, [label]: text },
      );
      payload.reportReadGuidance = REPORT_READ_GUIDANCE;
    }
    return payload;
  };
  const compactCollectionPayload = async (
    toolName: string,
    detailLevel: string,
    payload: Record<string, unknown>,
    key: string,
    values: unknown[],
    mapper: (entry: Record<string, unknown>) => Record<string, unknown> = (entry) => entry,
  ) => {
    if (detailLevel === "max") return payload;
    const normalized = values.map((entry) => mapper((entry && typeof entry === "object") ? entry as Record<string, unknown> : { value: entry }));
    const sample = detailLevel === "full" ? normalized : normalized.slice(0, RESULT_SAMPLE_LIMIT);
    const result: Record<string, unknown> = {
      ...payload,
      detail: detailLevel,
      [key]: sample,
      count: normalized.length,
      truncated: normalized.length > sample.length,
    };
    if (detailLevel === "compact" && normalized.length > sample.length) {
      result[`${key}ReportPath`] = await maybeWriteToolOutputToFile(
        workspaceRoot,
        createReportPath(toolName, key),
        payload,
      );
      result.reportReadGuidance = REPORT_READ_GUIDANCE;
    }
    return result;
  };

  const safeUrl = (value: unknown, base?: string): URL | null => {
    try {
      return new URL(String(value || ""), base);
    } catch {
      return null;
    }
  };

  const extensionFromUrl = (value: string): string => {
    const parsed = safeUrl(value);
    const pathname = parsed ? parsed.pathname : String(value || "");
    return path.extname(pathname.split(/[?#]/)[0] || "").toLowerCase();
  };

  const isProbablyDownloadableUrl = (value: string): boolean => {
    const ext = extensionFromUrl(value);
    return !!ext && downloadableExtensions.has(ext);
  };

  const sanitizeFileName = (value: string): string => {
    const cleaned = String(value || "")
      .replace(/["<>|:*?\\/\x00-\x1f]+/g, "_")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned || "download.bin";
  };

  const filenameFromContentDisposition = (value: string | null): string => {
    const header = String(value || "");
    const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match) return sanitizeFileName(decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, "")));
    const basicMatch = header.match(/filename="?([^";]+)"?/i);
    return basicMatch ? sanitizeFileName(basicMatch[1]) : "";
  };

  const inferFileNameFromUrl = (value: string, fallback = "download.bin"): string => {
    const parsed = safeUrl(value);
    const rawName = parsed ? decodeURIComponent(path.basename(parsed.pathname || "")) : "";
    return sanitizeFileName(rawName && rawName !== "/" ? rawName : fallback);
  };

  const contentTypeLooksHtml = (value: string | null): boolean => {
    const type = String(value || "").toLowerCase();
    return !type || type.includes("text/html") || type.includes("application/xhtml");
  };

  const resolveDownloadDestination = async (outputPath: string, suggestedFileName: string): Promise<string> => {
    const requested = String(outputPath || "downloads/").trim() || "downloads/";
    const normalized = requested.replace(/\\/g, "/");
    let treatAsDirectory = /\/$/.test(normalized);
    if (!treatAsDirectory) {
      const candidate = resolveInsideWorkspace(workspaceRoot, requested);
      try {
        const stat = await fsp.stat(candidate);
        treatAsDirectory = stat.isDirectory();
      } catch {
        treatAsDirectory = false;
      }
    }
    const relativeDestination = treatAsDirectory
      ? path.join(requested, sanitizeFileName(suggestedFileName || "download.bin"))
      : requested;
    return resolveInsideWorkspace(workspaceRoot, relativeDestination);
  };

  const transformKnownDownloadUrl = (value: string): { url: string; note: string | null } => {
    const parsed = safeUrl(value);
    if (!parsed) return { url: value, note: null };
    const host = parsed.hostname.toLowerCase();
    if (host === "drive.google.com" || host.endsWith(".drive.google.com")) {
      const id = parsed.searchParams.get("id") || parsed.pathname.match(/\/file\/d\/([^/]+)/)?.[1];
      if (id) {
        return {
          url: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`,
          note: "Converted a Google Drive share URL to its public download endpoint.",
        };
      }
    }
    if (host === "docs.google.com" || host.endsWith(".docs.google.com")) {
      const docMatch = parsed.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
      if (docMatch) {
        const exportFormat = docMatch[1] === "spreadsheets" ? "xlsx" : docMatch[1] === "presentation" ? "pptx" : "docx";
        return {
          url: `https://docs.google.com/${docMatch[1]}/d/${encodeURIComponent(docMatch[2])}/export?format=${exportFormat}`,
          note: `Converted a Google Docs share URL to a ${exportFormat} export endpoint.`,
        };
      }
    }
    if (host === "dropbox.com" || host === "www.dropbox.com") {
      parsed.searchParams.set("dl", "1");
      return { url: parsed.toString(), note: "Converted a Dropbox share URL to request direct download mode." };
    }
    return { url: value, note: null };
  };

  const extractGoogleDriveConfirmUrl = (html: string, baseUrl: string): string | null => {
    const formMatch = html.match(/<form[^>]+id="download-form"[^>]+action="([^"]+)"[\s\S]*?<\/form>/i);
    if (formMatch) {
      const action = formMatch[1].replace(/&amp;/g, "&");
      const formUrl = safeUrl(action, baseUrl);
      if (!formUrl) return null;
      for (const input of formMatch[0].matchAll(/<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"[^>]*>/gi)) {
        formUrl.searchParams.set(input[1], input[2].replace(/&amp;/g, "&"));
      }
      return formUrl.toString();
    }
    const hrefMatch = html.match(/href="([^"]*(?:confirm|download_warning)[^"]*)"/i);
    if (!hrefMatch) return null;
    return safeUrl(hrefMatch[1].replace(/&amp;/g, "&"), baseUrl)?.toString() || null;
  };

  const scoreDownloadCandidate = (candidateUrl: string, label: string, contentType = "", contentLength = ""): number => {
    let score = 0;
    const ext = extensionFromUrl(candidateUrl);
    const lowerLabel = String(label || "").toLowerCase();
    const lowerType = String(contentType || "").toLowerCase();
    if (downloadableExtensions.has(ext)) score += 60;
    if ([".pdf", ".epub", ".zip", ".mp3", ".mp4", ".torrent"].includes(ext)) score += 15;
    if (/\b(download|get|file|pdf|epub|source|original|full text|archive)\b/i.test(lowerLabel)) score += 20;
    if (/application\/(pdf|zip|octet-stream|epub)|audio\/|video\//i.test(lowerType)) score += 35;
    if (contentLength && Number(contentLength) > 0) score += 5;
    return score;
  };

  const probeCandidateHeaders = async (candidateUrl: string): Promise<Record<string, string>> => {
    try {
      const response = await fetch(candidateUrl, {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": "agentic-studio/1.0" },
        signal: AbortSignal.timeout(12000),
      });
      return {
        contentType: response.headers.get("content-type") || "",
        contentLength: response.headers.get("content-length") || "",
        finalUrl: response.url || candidateUrl,
      };
    } catch {
      return { contentType: "", contentLength: "", finalUrl: candidateUrl };
    }
  };

  const discoverDownloadOptions = async (pageUrl: string, html: string, limit: number): Promise<Array<Record<string, unknown>>> => {
    const matches = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>|<(?:source|video|audio|iframe|embed)\b([^>]*)>/gi)];
    const seen = new Set<string>();
    const candidates: Array<Record<string, unknown>> = [];
    for (const match of matches) {
      const attrs = (match[1] || match[3] || "").replace(/&amp;/g, "&");
      const href = attrs.match(/\b(?:href|src)=["']([^"']+)["']/i)?.[1];
      if (!href || /^(?:#|javascript:|mailto:|tel:)/i.test(href)) continue;
      const absolute = safeUrl(href, pageUrl)?.toString();
      if (!absolute || seen.has(absolute)) continue;
      const label = stripHtmlToText(match[2] || attrs);
      const attrDownload = /\bdownload(?:=|\s|>)/i.test(attrs);
      let baseScore = scoreDownloadCandidate(absolute, label) + (attrDownload ? 15 : 0);
      if (baseScore < 20 && !isProbablyDownloadableUrl(absolute)) continue;
      seen.add(absolute);
      candidates.push({ url: absolute, label, fileName: inferFileNameFromUrl(absolute), extension: extensionFromUrl(absolute), score: baseScore });
      if (candidates.length >= Math.max(limit * 3, 12)) break;
    }
    const probed = [];
    for (const candidate of candidates.slice(0, Math.max(limit * 2, 8))) {
      const headers = await probeCandidateHeaders(candidate.url as string);
      const score = Number(candidate.score || 0) + scoreDownloadCandidate(String(headers.finalUrl || candidate.url), String(candidate.label || ""), headers.contentType, headers.contentLength);
      probed.push({ ...candidate, ...headers, score });
    }
    return probed
      .filter((entry) => Number(entry.score || 0) > 25)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, limit)
      .map((entry, index) => ({ index: index + 1, ...entry }));
  };

  const fetchDownloadToFile = async (downloadUrl: string, outputPath: string, overwrite: boolean, timeoutMsForCall: number, inheritedNote: string | null = null) => {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMsForCall);
    try {
      let response = await fetch(downloadUrl, {
        redirect: "follow",
        headers: { "User-Agent": "agentic-studio/1.0" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Download failed with status ${response.status}: ${response.statusText}`);
      let contentType = response.headers.get("content-type") || "";
      if (contentTypeLooksHtml(contentType) && /drive\.google\.com/i.test(response.url || downloadUrl)) {
        const html = await response.text();
        const confirmUrl = extractGoogleDriveConfirmUrl(html, response.url || downloadUrl);
        if (confirmUrl) {
          response = await fetch(confirmUrl, {
            redirect: "follow",
            headers: { "User-Agent": "agentic-studio/1.0" },
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(`Google Drive confirmed download failed with status ${response.status}: ${response.statusText}`);
          contentType = response.headers.get("content-type") || "";
        } else {
          throw new Error("Google Drive returned an HTML confirmation page and no public download confirmation link was found.");
        }
      }
      const suggestedName = filenameFromContentDisposition(response.headers.get("content-disposition"))
        || inferFileNameFromUrl(response.url || downloadUrl);
      const destinationPath = await resolveDownloadDestination(outputPath, suggestedName);
      if (await fileExists(destinationPath) && !overwrite) {
        throw new Error("Destination already exists and overwrite is false.");
      }
      await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
      const buffer = Buffer.from(await response.arrayBuffer());
      await fsp.writeFile(destinationPath, buffer);
      return {
        success: true,
        url: downloadUrl,
        finalUrl: response.url || downloadUrl,
        note: inheritedNote,
        outputPath: path.relative(workspaceRoot, destinationPath),
        sizeBytes: buffer.length,
        contentType,
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  };

  const isCommonYtDlpHost = (value: string): boolean => {
    const parsed = safeUrl(value);
    if (!parsed) return false;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return videoDownloaderHosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
  };

  const runVideoDownloadRedirect = async (downloadUrl: string, outputPath: string, overwrite: boolean, timeoutMsForCall: number) => {
    requireCommandExecution();
    const ytDlp = await resolveExecutablePath(ctl, env, "ytDlpPath", "yt-dlp");
    const denoExecutable = await getDenoExecutablePath(ctl);
    const requested = String(outputPath || "downloads/").trim() || "downloads/";
    const normalized = requested.replace(/\\/g, "/");
    const outputLooksDirectory = /\/$/.test(normalized) || !path.extname(path.basename(normalized));
    const destination = resolveInsideWorkspace(workspaceRoot, outputLooksDirectory ? requested : path.dirname(requested));
    await fsp.mkdir(destination, { recursive: true });
    const outputTemplate = outputLooksDirectory ? "%(title)s [%(id)s].%(ext)s" : path.basename(requested);
    const parts = [quote(ytDlp), "--newline", "--no-playlist", `-P ${quote(destination)}`, `-o ${quote(outputTemplate)}`];
    if (!overwrite) parts.push("--no-overwrites");
    if (denoExecutable) parts.push(`--js-runtimes ${quote(`deno:${denoExecutable}`)}`);
    parts.push(quote(downloadUrl));
    const command = parts.join(" ");
    const result = await executeManagedCommand(ctl, command, { cwd: destination, shell, env }, timeoutMsForCall, Math.max(maxOutputBytes, 500000));
    return json(mergeDefined({
      redirectedToTool: "as_download_video",
      note: "Detected a yt-dlp-supported media page; reused the video downloader path.",
      outputDirectory: path.relative(workspaceRoot, destination),
    }, buildCommandResponsePayload(command, result)));
  };

  const googleWebSearch = async (searchQuery: string, limit: number): Promise<Array<Record<string, unknown>>> => {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=${Math.min(Math.max(limit, 1), 20)}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(30000),
    });
    const html = await response.text();
    const results: Array<Record<string, unknown>> = [];
    for (const match of html.matchAll(/<a[^>]+href="\/url\?q=([^"&]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const url = decodeURIComponent(match[1]);
      if (!/^https?:\/\//i.test(url)) continue;
      const title = stripHtmlToText(match[2] || "");
      if (!title) continue;
      results.push({ title, url });
      if (results.length >= limit) break;
    }
    return results.length > 0 ? results : [{ title: "Google search results page", url: searchUrl, note: "Google did not return parseable organic results to this local request." }];
  };

  const decodeBingClickUrl = (rawUrl: string): string => {
    const absoluteUrl = safeUrl(decodeHtmlEntities(rawUrl || ""), "https://www.bing.com")?.toString() || "";
    const parsed = safeUrl(absoluteUrl);
    const encodedTarget = parsed?.searchParams.get("u") || "";
    if (encodedTarget) {
      const normalized = encodedTarget.replace(/^a1/i, "");
      try {
        const decoded = Buffer.from(normalized, "base64").toString("utf8");
        if (/^https?:\/\//i.test(decoded)) return decoded;
      } catch {
        // Fall through to the raw absolute URL.
      }
    }
    return absoluteUrl;
  };

  const bingWebSearch = async (searchQuery: string, limit: number): Promise<Array<Record<string, unknown>>> => {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(searchQuery)}&count=${Math.min(Math.max(limit, 1), 20)}`;
    const { text } = await searchFetchText(searchUrl);
    const matches = [...text.matchAll(/<li class="b_algo"[\s\S]*?<h2[^>]*><a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>([\s\S]*?)<\/li>/gi)];
    const results: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    for (const match of matches) {
      const url = decodeBingClickUrl(match[1] || "");
      const title = normalizeSearchText(match[2] || "");
      const snippet = normalizeSearchText(match[3]?.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
      if (!url || !title || seen.has(url)) continue;
      seen.add(url);
      results.push({ title, url, snippet: snippet || undefined });
      if (results.length >= limit) break;
    }
    return results;
  };

  const normalizeSiteToken = (siteValue: string): string => {
    const raw = String(siteValue || "").trim();
    if (!raw) return "";
    if (/\bsite:/i.test(raw) || /\bOR\b/i.test(raw)) return raw;
    const withoutProtocol = raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
    return withoutProtocol;
  };

  const buildScopedQuery = (rawQuery: string, targetSite: string): string => {
    const normalizedSite = normalizeSiteToken(targetSite);
    if (!normalizedSite) return rawQuery;
    if (/\bsite:/i.test(normalizedSite) || /\bOR\b/i.test(normalizedSite)) return `${rawQuery} ${normalizedSite}`;
    return `${rawQuery} site:${normalizedSite}`;
  };

  const yahooWebSearch = async (searchQuery: string, limit: number): Promise<Array<Record<string, unknown>>> => {
    const searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(searchQuery)}&n=${Math.min(Math.max(limit, 1), 20)}`;
    const { text } = await searchFetchText(searchUrl);
    const matches = [...text.matchAll(/<h3[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/gi)];
    const results: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    for (const match of matches) {
      const url = decodeHtmlEntities(match[1] || "");
      const title = normalizeSearchText(match[2] || "");
      if (!url || !title || !/^https?:\/\//i.test(url) || seen.has(url)) continue;
      seen.add(url);
      results.push({ title, url });
      if (results.length >= limit) break;
    }
    return results;
  };

  const getLocalSearchCountryPreference = (): string[] => {
    const localeCandidates = [
      String(Intl.DateTimeFormat().resolvedOptions().locale || ""),
      String(process.env.LANG || ""),
      String(process.env.LC_ALL || ""),
    ].filter(Boolean);
    const localeCountry = localeCandidates
      .map((value) => value.match(/[-_](\w{2})\b/i)?.[1]?.toUpperCase() || "")
      .find(Boolean);
    const timeZone = String(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    const preference = new Set<string>();
    if (localeCountry) preference.add(localeCountry);
    if (/^America\/Sao_Paulo$/i.test(timeZone)) {
      ["BR", "AR", "UY", "PY", "CL", "US", "CA"].forEach((code) => preference.add(code));
    } else if (/^America\//i.test(timeZone)) {
      ["US", "CA", "MX", "BR", "AR"].forEach((code) => preference.add(code));
    } else if (/^Europe\//i.test(timeZone)) {
      ["DE", "NL", "FR", "GB", "SE", "CH"].forEach((code) => preference.add(code));
    } else if (/^Asia\//i.test(timeZone)) {
      ["SG", "JP", "KR", "IN", "HK", "TW"].forEach((code) => preference.add(code));
    } else if (/^Oceania\/|^Australia\//i.test(timeZone)) {
      ["AU", "NZ", "SG", "JP", "US"].forEach((code) => preference.add(code));
    }
    return Array.from(preference);
  };

  const getSearxInstanceCountryCode = (instance: Record<string, unknown>, cidrCatalog: Record<string, Record<string, unknown>>): string => {
    const ips = (instance.network as Record<string, unknown> | undefined)?.ips as Record<string, Record<string, unknown>> | undefined;
    if (!ips) return "";
    for (const ipRecord of Object.values(ips)) {
      const cidr = String(ipRecord?.asn_cidr || "");
      const cidrEntry = cidrCatalog[cidr] || {};
      const country = String(cidrEntry.network_country || cidrEntry.asn_country_code || "").toUpperCase();
      if (country) return country;
    }
    return "";
  };

  const getSearxMirrorCatalog = async () => {
    const { data } = await searchFetchJson("https://searx.space/data/instances.json", {}, 45000);
    const catalog = (data && typeof data === "object") ? data as Record<string, unknown> : {};
    const instances = (catalog.instances && typeof catalog.instances === "object") ? catalog.instances as Record<string, Record<string, unknown>> : {};
    const cidrCatalog = (catalog.cidrs && typeof catalog.cidrs === "object") ? catalog.cidrs as Record<string, Record<string, unknown>> : {};
    const preferredCountries = getLocalSearchCountryPreference();
    const mirrors = Object.entries(instances)
      .filter(([url, info]) => /^https:\/\//i.test(url) && String(info?.generator || "").toLowerCase() === "searxng")
      .map(([url, info]) => {
        const searchTiming = info?.timing as Record<string, unknown> | undefined;
        const uptime = info?.uptime as Record<string, unknown> | undefined;
        const countryCode = getSearxInstanceCountryCode(info || {}, cidrCatalog);
        const countryRank = countryCode ? preferredCountries.indexOf(countryCode) : -1;
        return {
          url: url.replace(/\/+$/, ""),
          countryCode: countryCode || null,
          countryRank: countryRank >= 0 ? countryRank : preferredCountries.length + 10,
          uptimeDay: Number(uptime?.uptimeDay || 0),
          uptimeWeek: Number(uptime?.uptimeWeek || 0),
          uptimeMonth: Number(uptime?.uptimeMonth || 0),
          uptimeYear: Number(uptime?.uptimeYear || 0),
          searchSuccess: Number(((searchTiming?.search as Record<string, unknown> | undefined)?.success_percentage) || 0),
          searchMedian: Number((((searchTiming?.search as Record<string, unknown> | undefined)?.all as Record<string, unknown> | undefined)?.median) || Number.MAX_SAFE_INTEGER),
          version: String(info?.version || ""),
          networkType: String(info?.network_type || ""),
          tlsGrade: String(((info?.tls as Record<string, unknown> | undefined)?.grade) || ""),
          htmlGrade: String(((info?.html as Record<string, unknown> | undefined)?.grade) || ""),
        };
      })
      .filter((entry) => entry.searchSuccess > 0 && entry.networkType !== "tor")
      .sort((left, right) => (
        left.countryRank - right.countryRank
        || right.uptimeWeek - left.uptimeWeek
        || right.searchSuccess - left.searchSuccess
        || left.searchMedian - right.searchMedian
        || right.uptimeMonth - left.uptimeMonth
      ));
    return { preferredCountries, mirrors };
  };

  const listSearxMirrors = async (index: number, pageSize = DEFAULT_SEARCH_PAGE_SIZE) => {
    const { preferredCountries, mirrors } = await getSearxMirrorCatalog();
    const start = Math.max(Number(index) || 0, 0);
    const size = Math.min(Math.max(Number(pageSize) || DEFAULT_SEARCH_PAGE_SIZE, 1), 25);
    return {
      provider: "searxng_mirror_catalog",
      preferredCountries,
      index: start,
      returned: Math.min(size, Math.max(mirrors.length - start, 0)),
      total: mirrors.length,
      mirrors: mirrors.slice(start, start + size).map((entry, offset) => ({
        index: start + offset,
        url: entry.url,
        countryCode: entry.countryCode,
        uptimeWeek: entry.uptimeWeek,
        uptimeMonth: entry.uptimeMonth,
        uptimeYear: entry.uptimeYear,
        searchSuccess: entry.searchSuccess,
        searchMedianSeconds: Number.isFinite(entry.searchMedian) ? entry.searchMedian : null,
        version: entry.version || null,
        tlsGrade: entry.tlsGrade || null,
        htmlGrade: entry.htmlGrade || null,
      })),
    };
  };

  const searchSearxMirror = async (baseUrl: string, searchQuery: string, limit: number, language = "all") => {
    const params = new URLSearchParams({
      q: searchQuery,
      format: "json",
      language: language || "all",
      safesearch: "0",
    });
    const { data } = await searchFetchJson(`${baseUrl.replace(/\/+$/, "")}/search?${params.toString()}`, {}, 30000);
    const rawResults = Array.isArray((data as Record<string, unknown>)?.results) ? (data as Record<string, unknown>).results as Array<Record<string, unknown>> : [];
    const results = rawResults
      .map((entry) => compactSearchRecord({
        title: entry.title || entry.content || entry.url || "",
        url: entry.url || entry.pretty_url || "",
        snippet: entry.content || entry.description || "",
        imageUrl: entry.img_src || "",
        thumbnailUrl: entry.thumbnail || "",
        published: entry.publishedDate || entry.published || "",
        source: entry.engine || entry.parsed_url?.netloc || "",
      }))
      .filter((entry) => String(entry.url || "").trim() && String(entry.title || "").trim())
      .slice(0, limit);
    return results;
  };

  const searxWebSearch = async (searchQuery: string, limit: number, options: Record<string, unknown> = {}) => {
    const explicitMirror = String(options.searxng_mirror_url || "").trim().replace(/\/+$/, "");
    const pageIndex = Math.max(Number(options.searxng_mirror_index) || 0, 0);
    const pageSize = Math.max(Number(options.searxng_mirror_max || options.searxng_page_size) || DEFAULT_SEARCH_PAGE_SIZE, DEFAULT_SEARCH_PAGE_SIZE);
    const language = String(options.language || "all");
    const candidateMirrors = explicitMirror
      ? [{ url: explicitMirror }]
      : (await getSearxMirrorCatalog()).mirrors.slice(pageIndex, pageIndex + Math.max(pageSize, 20));
    const errors: string[] = [];
    for (const mirror of candidateMirrors) {
      try {
        const results = await searchSearxMirror(String(mirror.url), searchQuery, limit, language);
        if (results.length > 0) {
          return {
            provider: "searxng",
            mirror: String(mirror.url),
            results,
          };
        }
        errors.push(`${mirror.url}: no results`);
      } catch (error) {
        errors.push(`${mirror.url}: ${(error as Error).message}`);
      }
    }
    throw new Error(`SearxNG search failed across ${candidateMirrors.length} mirror(s): ${errors.slice(0, 5).join(" | ")}`);
  };

  const runSearchProvider = async (scopedQuery: string, limit: number, preferredProvider: string, options: Record<string, unknown> = {}) => {
    const hasFirecrawl = !!getFirecrawlApiKey(ctl);
    if ((preferredProvider === "auto" || preferredProvider === "firecrawl") && hasFirecrawl) {
      try {
        const result = await firecrawlApiRequest(ctl, "/v2/search", "POST", { query: scopedQuery, limit });
        return { provider: "firecrawl", results: result.data || result.results || result };
      } catch (error) {
        if (preferredProvider === "firecrawl") {
          const fallback = await searxWebSearch(scopedQuery, limit, options);
          return {
            provider: fallback.provider,
            mirror: fallback.mirror,
            warning: `Firecrawl search failed and fell back to SearxNG: ${(error as Error).message}`,
            results: fallback.results,
          };
        }
      }
    }
    if (preferredProvider === "google") {
      return { provider: "google", results: await googleWebSearch(scopedQuery, limit) };
    }
    if (preferredProvider === "searxng") {
      return await searxWebSearch(scopedQuery, limit, options);
    }
    if (preferredProvider === "yahoo") {
      return { provider: "yahoo_fallback", results: await yahooWebSearch(scopedQuery, limit) };
    }
    if (preferredProvider === "bing") {
      return { provider: "bing_fallback", results: await bingWebSearch(scopedQuery, limit) };
    }
    if (preferredProvider === "duckduckgo") {
      return { provider: "duckduckgo_fallback", results: await fallbackWebSearch(scopedQuery, limit) };
    }
    const providerErrors: string[] = [];
    try {
      const searxResults = await searxWebSearch(scopedQuery, limit, options);
      if (Array.isArray(searxResults.results) && searxResults.results.length > 0) {
        return searxResults;
      }
    } catch (error) {
      providerErrors.push(`searxng: ${(error as Error).message}`);
      if (preferredProvider !== "auto") throw error;
    }
    try {
      const yahooResults = await yahooWebSearch(scopedQuery, limit);
      if (Array.isArray(yahooResults) && yahooResults.length > 0) {
        return { provider: "yahoo_fallback", results: yahooResults };
      }
    } catch (error) {
      providerErrors.push(`yahoo: ${(error as Error).message}`);
    }
    try {
      const bingResults = await bingWebSearch(scopedQuery, limit);
      if (Array.isArray(bingResults) && bingResults.length > 0) {
        return { provider: "bing_fallback", results: bingResults };
      }
    } catch (error) {
      providerErrors.push(`bing: ${(error as Error).message}`);
    }
    try {
      const duckDuckGoResults = await fallbackWebSearch(scopedQuery, limit);
      if (Array.isArray(duckDuckGoResults) && duckDuckGoResults.length > 0) {
        return { provider: "duckduckgo_fallback", results: duckDuckGoResults };
      }
    } catch (error) {
      providerErrors.push(`duckduckgo: ${(error as Error).message}`);
    }
    try {
      return { provider: "google_fallback", results: await googleWebSearch(scopedQuery, limit), warning: providerErrors.length > 0 ? providerErrors.slice(0, 4).join(" | ") : undefined };
    } catch (error) {
      providerErrors.push(`google: ${(error as Error).message}`);
      throw new Error(`All search providers failed for query "${scopedQuery}": ${providerErrors.slice(0, 6).join(" | ")}`);
    }
  };

  const archiveDownloadLinks = async (identifier: string, maxLinks: number) => {
    const metadataUrl = `https://archive.org/metadata/${encodeURIComponent(identifier)}`;
    const response = await fetch(metadataUrl, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) return [];
    const metadata = await response.json() as any;
    const files = Array.isArray(metadata.files) ? metadata.files : [];
    return files
      .filter((file: any) => {
        const name = String(file?.name || "");
        const descriptor = `${name} ${file?.format || ""}`.toLowerCase();
        if (!name || /(^|_)(meta|files)\.xml$/i.test(name)) return false;
        if (/encrypted|lcp|daisy|scandata|hocr|abbyy|metadata/i.test(descriptor)) return false;
        return downloadableExtensions.has(path.extname(name).toLowerCase());
      })
      .slice(0, maxLinks)
      .map((file: any, index: number) => {
        const name = String(file.name || "");
        const downloadUrl = `https://archive.org/download/${encodeURIComponent(identifier)}/${name.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
        return {
          index: index + 1,
          name,
          format: file.format || null,
          sizeBytes: file.size ? Number(file.size) : null,
          url: downloadUrl,
          asWebDownloadArgs: {
            url: downloadUrl,
            output_path: `downloads/archive.org/${identifier}/`,
          },
        };
      });
  };

  const searchInternetArchive = async (query: string, limit: number) => {
    const params = new URLSearchParams();
    params.set("q", query);
    for (const field of ["identifier", "title", "creator", "year", "mediatype", "description"]) params.append("fl[]", field);
    params.set("rows", String(limit));
    params.set("output", "json");
    const apiUrl = `https://archive.org/advancedsearch.php?${params.toString()}`;
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Internet Archive search failed with status ${response.status}: ${response.statusText}`);
    const data = await response.json() as any;
    const docs = Array.isArray(data?.response?.docs) ? data.response.docs : [];
    const results = [];
    for (const entry of docs.slice(0, limit)) {
      const identifier = String(entry.identifier || "");
      const downloadLinks = identifier ? await archiveDownloadLinks(identifier, 8) : [];
      results.push({
        title: entry.title || identifier,
        identifier,
        creator: entry.creator || null,
        year: entry.year || null,
        mediaType: entry.mediatype || null,
        url: identifier ? `https://archive.org/details/${encodeURIComponent(identifier)}` : null,
        metadataUrl: identifier ? `https://archive.org/metadata/${encodeURIComponent(identifier)}` : null,
        downloadLinks,
      });
    }
    return { provider: "archive.org_advancedsearch", apiUrl, results };
  };

  const decodeHtmlEntities = (value: string): string => String(value || "")
    .replace(/&quot;/gi, "\"")
    .replace(/&#34;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

  const normalizeSearchText = (value: unknown): string => stripHtmlToText(String(value || "")).replace(/\s+/g, " ").trim();

  const searchFetchText = async (url: string, init: Record<string, unknown> = {}, timeoutForCall = 30000) => {
    const headers = { "User-Agent": WEB_USER_AGENT, ...(init.headers as Record<string, string> || {}) };
    const response = await fetch(url, {
      ...init,
      headers,
      redirect: "follow",
      signal: (init.signal as AbortSignal | undefined) || AbortSignal.timeout(timeoutForCall),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
    }
    return { response, text };
  };

  const searchFetchJson = async (url: string, init: Record<string, unknown> = {}, timeoutForCall = 30000) => {
    const { response, text } = await searchFetchText(url, init, timeoutForCall);
    try {
      return { response, data: text ? JSON.parse(text) : {} };
    } catch (error) {
      throw new Error(`Expected JSON but received non-JSON response from ${response.url || url}: ${(error as Error).message}`);
    }
  };

  const readConfigField = (fieldName: string): unknown =>
    ctl.getPluginConfig(configSchematics).get(fieldName as any);

  const getBrowserAutomationBackend = (): "playwright" | "camofox" => {
    const configured = String(readConfigField("browserAutomationBackend") || "playwright").trim().toLowerCase();
    return configured === "camofox" ? "camofox" : "playwright";
  };

  const resolveConfigPath = (configuredPath: string, fallbackPath: string): string => {
    const raw = String(configuredPath || "").trim();
    if (!raw) return path.resolve(pluginRoot, fallbackPath);
    const expanded = raw
      .replace(/%([^%]+)%/g, (_match, rawName) => {
        const wanted = String(rawName || "").trim().toLowerCase();
        const key = Object.keys(process.env).find((entry) => entry.toLowerCase() === wanted);
        return key ? String(process.env[key] || "") : `%${rawName}%`;
      })
      .replace(/\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, braced, bare) => {
        const rawName = String(braced || bare || "").trim();
        const key = Object.keys(process.env).find((entry) => entry === rawName);
        return key ? String(process.env[key] || "") : match;
      });
    if (path.isAbsolute(expanded)) return path.resolve(expanded);
    return path.resolve(pluginRoot, expanded);
  };

  const resolveCamofoxVendorDirectory = (): string =>
    path.join(pluginRoot, "dependencies", "camofox-browser");

  const resolveCamofoxHomeDirectory = (): string => {
    const configured = String(readConfigField("camofoxHomeDirectory") || "").trim();
    return resolveConfigPath(configured, "dependencies/camofox-browser/.runtime-home");
  };

  const resolveCamofoxInstallDirectory = (): string => {
    const homeDirectory = resolveCamofoxHomeDirectory();
    if (process.platform === "win32") return path.join(homeDirectory, "AppData", "Local", "camoufox", "camoufox", "Cache");
    if (process.platform === "darwin") return path.join(homeDirectory, "Library", "Caches", "camoufox");
    return path.join(homeDirectory, ".cache", "camoufox");
  };

  const resolveDefaultPlaywrightBrowsersDirectory = (): string => {
    const hostHomeDirectory = os.homedir();
    if (process.platform === "win32") return path.join(hostHomeDirectory, "AppData", "Local", "ms-playwright");
    if (process.platform === "darwin") return path.join(hostHomeDirectory, "Library", "Caches", "ms-playwright");
    return path.join(hostHomeDirectory, ".cache", "ms-playwright");
  };

  const buildCamofoxRuntimeEnv = (baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
    const homeDirectory = resolveCamofoxHomeDirectory();
    const runtimeEnv: NodeJS.ProcessEnv = { ...baseEnv, HOME: homeDirectory };
    if (!String(runtimeEnv.PLAYWRIGHT_BROWSERS_PATH || "").trim()) {
      runtimeEnv.PLAYWRIGHT_BROWSERS_PATH = resolveDefaultPlaywrightBrowsersDirectory();
    }
    if (process.platform === "win32") {
      const localAppData = path.join(homeDirectory, "AppData", "Local");
      const roamingAppData = path.join(homeDirectory, "AppData", "Roaming");
      const driveMatch = homeDirectory.match(/^[A-Za-z]:/);
      runtimeEnv.USERPROFILE = homeDirectory;
      runtimeEnv.LOCALAPPDATA = localAppData;
      runtimeEnv.APPDATA = roamingAppData;
      if (driveMatch) {
        runtimeEnv.HOMEDRIVE = driveMatch[0];
        runtimeEnv.HOMEPATH = homeDirectory.slice(driveMatch[0].length) || "\\";
      }
    }
    return runtimeEnv;
  };

  let camofoxPreparationPromise: Promise<{ vendorDir: string; env: NodeJS.ProcessEnv; homeDirectory: string; versionPath: string }> | null = null;

  const ensureCamofoxRuntime = async () => {
    if (camofoxPreparationPromise) return await camofoxPreparationPromise;
    camofoxPreparationPromise = (async () => {
      requireCommandExecution();
      const vendorDir = resolveCamofoxVendorDirectory();
      const vendorPackagePath = path.join(vendorDir, "package.json");
      const camoufoxPackagePath = path.join(vendorDir, "node_modules", "camoufox-js", "package.json");
      if (!await fileExists(vendorPackagePath)) {
        throw new Error("Camofox backend is enabled, but dependencies/camofox-browser is missing under the plugin install directory. Restore the vendored Camofox dependency or switch Browser Automation Backend back to Playwright.");
      }
      if (!await fileExists(camoufoxPackagePath)) {
        throw new Error("Camofox backend is enabled, but dependencies/camofox-browser/node_modules is missing under the plugin install directory. Run npm install inside dependencies/camofox-browser or switch Browser Automation Backend back to Playwright.");
      }
      const homeDirectory = resolveCamofoxHomeDirectory();
      const runtimeEnv = buildCamofoxRuntimeEnv(env);
      await fsp.mkdir(homeDirectory, { recursive: true });
      if (process.platform === "win32") {
        await fsp.mkdir(path.join(homeDirectory, "AppData", "Local"), { recursive: true });
        await fsp.mkdir(path.join(homeDirectory, "AppData", "Roaming"), { recursive: true });
      }
      const versionPath = path.join(resolveCamofoxInstallDirectory(), "version.json");
      if (!await fileExists(versionPath)) {
        const fetchResult = await executeManagedCommand(
          ctl,
          "npx camoufox-js fetch",
          { cwd: vendorDir, shell, env: runtimeEnv },
          Math.max(timeoutMs, 30 * 60 * 1000),
          Math.max(maxOutputBytes, 400000),
        );
        if (fetchResult.exitCode !== 0 || fetchResult.error) {
          const failureText = String(fetchResult.stderr || fetchResult.error || fetchResult.stdout || `exit code ${fetchResult.exitCode}`).trim();
          throw new Error(`Failed to fetch the Camofox browser runtime: ${failureText}`);
        }
      }
      return { vendorDir, env: runtimeEnv, homeDirectory, versionPath };
    })().catch((error) => {
      camofoxPreparationPromise = null;
      throw error;
    });
    return await camofoxPreparationPromise;
  };

  const executeConfiguredBrowserNodeScript = async (script: string, timeoutOverrideMs: number, backend = getBrowserAutomationBackend()) => {
    const nodeExecutable = await getNodeExecutablePath(ctl);
    if (backend === "camofox") {
      const runtime = await ensureCamofoxRuntime();
      return await executeInlineNodeScript(
        ctl,
        script,
        shell,
        runtime.env,
        workspaceRoot,
        timeoutOverrideMs,
        maxOutputBytes,
        nodeExecutable,
        runtime.vendorDir,
      );
    }
    return await executeInlineNodeScript(
      ctl,
      script,
      shell,
      env,
      workspaceRoot,
      timeoutOverrideMs,
      maxOutputBytes,
      nodeExecutable,
    );
  };

  const buildBrowserBackendPrelude = (preferredBackend: string): string => [
    `const preferredBrowserBackend = ${JSON.stringify(preferredBackend === "camofox" ? "camofox" : "playwright")};`,
    `const agenticPlaywrightModulePath = ${JSON.stringify(path.join(pluginRoot, "node_modules", "playwright"))};`,
    'function normalizeWaitUntil(value) { return value === "networkidle0" || value === "networkidle2" ? "networkidle" : (value || "networkidle"); }',
    'function decodeAgenticLiteral(value) { return Buffer.from(String(value || ""), "base64").toString("utf8"); }',
    'function loadAgenticPlaywright() {',
    '  try { return require(agenticPlaywrightModulePath); } catch { return require("playwright"); }',
    '}',
    'function resolveHostOs() {',
    '  if (process.platform === "win32") return "windows";',
    '  if (process.platform === "darwin") return "macos";',
    '  return "linux";',
    '}',
    'async function createAgenticBrowserType(requestedBackend, requestedTypeName = "chromium") {',
    '  if (requestedBackend === "camofox") {',
    '    const { launchOptions } = await import("camoufox-js");',
    '    const { firefox } = await import("playwright-core");',
    '    return {',
    '      name: "camofox",',
    '      engine: "camofox_firefox",',
    '      async launch(overrides = {}) {',
    '        const camoufoxLaunchOptions = await launchOptions({',
    '          headless: overrides.headless !== false,',
    '          os: resolveHostOs(),',
    '          humanize: true,',
    '          enable_cache: true,',
    '          // LM Studio uses its own bundled Node runtime on Windows, so',
    '          // disabling WebGL keeps Camofox from touching the optional',
    '          // sqlite-backed WebGL sampler that can otherwise fail on ABI mismatch.',
    '          block_webgl: process.platform === "win32",',
    '        });',
    '        const merged = { ...camoufoxLaunchOptions, ...overrides };',
    '        if (!merged.proxy) delete merged.proxy;',
    '        return await firefox.launch(merged);',
    '      },',
    '    };',
    '  }',
    '  const { chromium, firefox, webkit } = loadAgenticPlaywright();',
    '  const registry = { chromium, firefox, webkit };',
    '  const browserType = registry[requestedTypeName] || chromium;',
    '  return {',
    '    name: requestedTypeName,',
    '    engine: requestedTypeName === "chromium" ? "playwright_chromium" : ("playwright_" + requestedTypeName),',
    '    async launch(overrides = {}) {',
    '      const merged = { ...overrides };',
    '      if (!merged.executablePath && typeof browserType.executablePath === "function") {',
    '        merged.executablePath = browserType.executablePath();',
    '      }',
    '      return await browserType.launch(merged);',
    '    },',
    '  };',
    '}',
    'async function createAgenticPlaywrightAliases(requestedBackend) {',
    '  const launchViaBackend = async (browserTypeName, overrides = {}) => {',
    '    const browserType = await createAgenticBrowserType(requestedBackend, browserTypeName);',
    '    const browser = await browserType.launch(overrides);',
    '    browser.__agenticBrowserEngine = browserType.engine;',
    '    browser.__agenticBrowserName = browserType.name;',
    '    return browser;',
    '  };',
    '  return {',
    '    chromium: { launch: (overrides = {}) => launchViaBackend("chromium", overrides) },',
    '    firefox: requestedBackend === "camofox"',
    '      ? { launch: (overrides = {}) => launchViaBackend("chromium", overrides) }',
    '      : { launch: (overrides = {}) => launchViaBackend("firefox", overrides) },',
    '    webkit: requestedBackend === "camofox"',
    '      ? { launch: () => { throw new Error("WebKit is not available when Browser Automation Backend is Camofox."); } }',
    '      : { launch: (overrides = {}) => launchViaBackend("webkit", overrides) },',
    '  };',
    '}',
  ].join("\n");

  const extractTextRuns = (value: unknown): string => {
    if (!value || typeof value !== "object") return normalizeSearchText(value);
    if (typeof (value as Record<string, unknown>).simpleText === "string") return normalizeSearchText((value as Record<string, unknown>).simpleText);
    if (Array.isArray((value as Record<string, unknown>).runs)) {
      return normalizeSearchText(((value as Record<string, unknown>).runs as Array<Record<string, unknown>>).map((entry) => entry?.text || "").join(""));
    }
    return "";
  };

  const collectNestedObjects = (value: unknown, keyName: string, output: Array<Record<string, unknown>> = []) => {
    if (!value || typeof value !== "object") return output;
    if (Array.isArray(value)) {
      for (const entry of value) collectNestedObjects(entry, keyName, output);
      return output;
    }
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
      if (entryKey === keyName && entryValue && typeof entryValue === "object" && !Array.isArray(entryValue)) {
        output.push(entryValue as Record<string, unknown>);
      }
      collectNestedObjects(entryValue, keyName, output);
    }
    return output;
  };

  const splitSiteSearchTerms = (queryValue: string): string[] => {
    const normalized = normalizeSearchText(queryValue).toLowerCase();
    if (!normalized) return [];
    return normalized.startsWith(".") || normalized.endsWith(".")
      ? normalized.split(/[ ,]+/).filter(Boolean)
      : normalized.split(/[ ,.]+/).filter(Boolean);
  };

  const normalizeHost = (value: string): string => String(value || "").trim().toLowerCase().replace(/^www\./, "");

  const getSearchResultUrl = (entry: Record<string, unknown>): string => String(
    entry?.url || entry?.link || entry?.href || entry?.outboundUrl || entry?.hnUrl || "",
  ).trim();

  const scoreQueryMatch = (text: string, queryValue: string, terms: string[]): number => {
    const haystack = normalizeSearchText(text).toLowerCase();
    const normalizedQuery = normalizeSearchText(queryValue).toLowerCase();
    if (!haystack) return 0;
    let score = 0;
    if (normalizedQuery && haystack.includes(normalizedQuery)) score += 30;
    if (haystack === normalizedQuery) score += 40;
    score += terms.filter((term) => haystack.includes(term)).length * 8;
    return score;
  };

  const normalizeLocaleTag = (value: string, fallback: string, mode: "upper-region" | "lower-region") => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return fallback;
    const parts = trimmed.split("-").filter(Boolean);
    if (parts.length === 0) return fallback;
    const [languagePart, ...rest] = parts;
    const languageCode = languagePart.toLowerCase();
    const regionCode = rest[0]
      ? (mode === "upper-region" ? rest[0].toUpperCase() : rest[0].toLowerCase())
      : (mode === "upper-region" ? "US" : "us");
    return `${languageCode}-${regionCode}`;
  };

  const searchWikipedia = async (queryValue: string, limitValue: number, languageValue: string) => {
    const wikipediaLanguage = String(languageValue || "").trim().toLowerCase() || "en";
    const apiUrl = `https://${wikipediaLanguage}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(queryValue)}&srlimit=${limitValue}&format=json&origin=*`;
    const { data } = await searchFetchJson(apiUrl);
    return {
      provider: "wikipedia_api_search",
      apiUrl,
      language: wikipediaLanguage,
      results: (data?.query?.search || []).map((entry: any) => ({
        title: entry.title,
        pageId: entry.pageid,
        snippet: stripHtmlToText(entry.snippet || ""),
        url: `https://${wikipediaLanguage}.wikipedia.org/wiki/${encodeURIComponent(String(entry.title).replace(/\s+/g, "_"))}`,
      })),
    };
  };

  const searchReddit = async (queryValue: string, limitValue: number, subredditValue: string, sortValue: string, timeValue: string) => {
    const normalizedSubreddit = String(subredditValue || "").trim();
    const base = normalizedSubreddit ? `https://www.reddit.com/r/${encodeURIComponent(normalizedSubreddit)}/search.json` : "https://www.reddit.com/search.json";
    const searchUrl = `${base}?q=${encodeURIComponent(queryValue)}&restrict_sr=${normalizedSubreddit ? "1" : "0"}&sort=${sortValue}&t=${timeValue}&limit=${limitValue}`;
    const { data } = await searchFetchJson(searchUrl, { headers: { "User-Agent": "agentic-studio/1.0" } });
    return {
      provider: normalizedSubreddit ? "reddit_subreddit_search_json" : "reddit_search_json",
      searchUrl,
      subreddit: normalizedSubreddit || null,
      results: ((data?.data?.children) || []).map((entry: any) => ({
        title: entry.data?.title,
        subreddit: entry.data?.subreddit,
        author: entry.data?.author,
        score: entry.data?.score,
        comments: entry.data?.num_comments,
        createdUtc: entry.data?.created_utc,
        url: `https://www.reddit.com${entry.data?.permalink || ""}`,
        outboundUrl: entry.data?.url_overridden_by_dest || entry.data?.url || null,
      })),
    };
  };

  const searchHackerNews = async (queryValue: string, limitValue: number) => {
    const apiUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(queryValue)}&hitsPerPage=${limitValue}`;
    const { data } = await searchFetchJson(apiUrl);
    return {
      provider: "hn_algolia_api_search",
      apiUrl,
      results: (data?.hits || []).map((entry: any) => ({
        title: entry.title || entry.story_title,
        author: entry.author,
        points: entry.points,
        comments: entry.num_comments,
        url: entry.url || `https://news.ycombinator.com/item?id=${entry.objectID}`,
        hnUrl: `https://news.ycombinator.com/item?id=${entry.objectID}`,
      })),
    };
  };

  const searchStackExchange = async (queryValue: string, limitValue: number, stackExchangeSiteValue: string) => {
    const normalizedSite = String(stackExchangeSiteValue || "").trim() || "stackoverflow";
    const apiUrl = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&site=${encodeURIComponent(normalizedSite)}&q=${encodeURIComponent(queryValue)}&pagesize=${limitValue}`;
    const { data } = await searchFetchJson(apiUrl);
    return {
      provider: normalizedSite === "stackoverflow" ? "stack_overflow_api_search" : "stack_exchange_api_search",
      apiUrl,
      stackExchangeSite: normalizedSite,
      results: (data?.items || []).map((entry: any) => ({
        title: stripHtmlToText(entry.title || ""),
        score: entry.score,
        answers: entry.answer_count,
        accepted: entry.is_answered,
        tags: entry.tags,
        url: entry.link,
      })),
    };
  };

  const searchWikiHow = async (queryValue: string, limitValue: number) => {
    const searchUrl = `https://www.wikihow.com/wikiHowTo?search=${encodeURIComponent(queryValue)}`;
    const { text } = await searchFetchText(searchUrl);
    const matches = [...text.matchAll(/<a class="result_link" href=([^\s>]+)[^>]*>[\s\S]*?<div class="result_title">([\s\S]*?)<\/div>[\s\S]*?(?:<li class="sr_view">\s*([\s\S]*?)\s*<\/li>)?[\s\S]*?(?:<li class="sr_updated">[\s\S]*?<span>Updated<\/span>\s*([\s\S]*?)\s*<\/li>)?/gi)];
    const seen = new Set<string>();
    const results: Array<Record<string, unknown>> = [];
    for (const match of matches) {
      const url = safeUrl(match[1] || "", "https://www.wikihow.com")?.toString() || "";
      const title = normalizeSearchText(match[2] || "");
      const views = normalizeSearchText(match[3] || "");
      const updated = normalizeSearchText(match[4] || "");
      if (!url || !title || seen.has(url)) continue;
      seen.add(url);
      results.push({
        title,
        url,
        views: views || null,
        updated: updated || null,
      });
      if (results.length >= limitValue) break;
    }
    return { provider: "wikihow_search_page", searchUrl, results };
  };

  const loadPypiSimpleProjectNames = async () => {
    if (pypiSimpleIndexCache && (Date.now() - pypiSimpleIndexCache.fetchedAt) < PYPI_SIMPLE_INDEX_TTL_MS) {
      return pypiSimpleIndexCache.projectNames;
    }
    const { text } = await searchFetchText("https://pypi.org/simple/", {
      headers: { Accept: "application/vnd.pypi.simple.v1+json" },
    }, 120000);
    const projectNames: string[] = [];
    const pattern = /"name":"([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      projectNames.push(decodeHtmlEntities(match[1] || ""));
    }
    pypiSimpleIndexCache = { fetchedAt: Date.now(), projectNames };
    return projectNames;
  };

  const fetchPypiProjectMetadata = async (projectName: string) => {
    const apiUrl = `https://pypi.org/pypi/${encodeURIComponent(projectName)}/json`;
    const { data } = await searchFetchJson(apiUrl, {}, 30000);
    const info = data?.info || {};
    return {
      title: info.name || projectName,
      name: info.name || projectName,
      version: info.version || null,
      snippet: info.summary || null,
      requiresPython: info.requires_python || null,
      homePage: info.home_page || null,
      source: info.project_urls?.["Source"] || info.project_urls?.["Source Code"] || null,
      documentation: info.project_urls?.Documentation || null,
      published: data?.urls?.[0]?.upload_time_iso_8601 || null,
      url: info.package_url || info.project_url || `https://pypi.org/project/${encodeURIComponent(projectName)}/`,
    };
  };

  const searchPyPi = async (queryValue: string, limitValue: number, preferredProvider: string) => {
    const normalizedQuery = normalizeSearchText(queryValue).toLowerCase();
    const terms = splitSiteSearchTerms(queryValue);
    const exactCandidates = new Set<string>();
    if (/^[a-z0-9._-]+$/i.test(queryValue.trim())) {
      exactCandidates.add(queryValue.trim());
      exactCandidates.add(queryValue.trim().replace(/_/g, "-"));
      exactCandidates.add(queryValue.trim().replace(/-/g, "_"));
    }
    let rankedCandidates: Array<{ name: string; score: number }> = [];
    let note = "Uses PyPI's Simple Index plus project JSON metadata because the interactive website search page serves a client challenge to local fetches.";
    try {
      const projectNames = await loadPypiSimpleProjectNames();
      rankedCandidates = projectNames
        .map((projectName) => {
          const normalizedName = projectName.toLowerCase();
          let score = 0;
          if (normalizedName === normalizedQuery) score += 180;
          if (exactCandidates.has(projectName) || exactCandidates.has(normalizedName)) score += 140;
          if (normalizedQuery && normalizedName.startsWith(normalizedQuery)) score += 90;
          if (normalizedQuery && normalizedName.includes(normalizedQuery)) score += 55;
          score += terms.filter((term) => normalizedName.includes(term)).length * 12;
          return { name: projectName, score };
        })
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
        .slice(0, Math.min(Math.max(limitValue * 4, 12), 40));
    } catch (error) {
      note = `${note} The Simple Index fetch failed, so results were recovered from a scoped web search: ${(error as Error).message}`;
    }

    if (rankedCandidates.length === 0) {
      const scopedQuery = buildScopedQuery(queryValue, "site:pypi.org/project");
      const providerResult = await runSearchProvider(scopedQuery, Math.min(Math.max(limitValue * 3, 10), 30), preferredProvider);
      const seenNames = new Set<string>();
      rankedCandidates = [];
      for (const entry of providerResult.results as Array<Record<string, unknown>>) {
        const url = getSearchResultUrl(entry);
        const parsed = safeUrl(url);
        const host = normalizeHost(parsed?.hostname || "");
        const packageName = host === "pypi.org" ? decodeURIComponent(parsed?.pathname.match(/^\/project\/([^/]+)/)?.[1] || "") : "";
        if (!packageName || seenNames.has(packageName)) continue;
        seenNames.add(packageName);
        rankedCandidates.push({
          name: packageName,
          score: scoreQueryMatch(`${entry.title || ""} ${packageName}`, queryValue, terms) + 20,
        });
      }
    }

    const metadataResults = (await Promise.all(
      rankedCandidates
        .slice(0, Math.min(Math.max(limitValue * 2, 8), 20))
        .map(async (candidate) => {
          try {
            const metadata = await fetchPypiProjectMetadata(candidate.name);
            return { ...metadata, score: candidate.score + scoreQueryMatch(String(metadata.snippet || metadata.title || ""), queryValue, terms) };
          } catch {
            return null;
          }
        }),
    )).filter(Boolean) as Array<Record<string, unknown>>;

    const results = metadataResults
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || String(left.title || "").localeCompare(String(right.title || "")))
      .slice(0, limitValue)
      .map(({ score, ...entry }) => entry);

    return {
      provider: "pypi_simple_index_json",
      apiUrl: "https://pypi.org/simple/",
      note,
      results,
    };
  };

  const searchScopedSearchEngineResults = async (
    queryValue: string,
    limitValue: number,
    preferredProvider: string,
    scopedSite: string,
    keepResult: (entry: Record<string, unknown>, parsedUrl: URL) => boolean,
    scoreEntry: (entry: Record<string, unknown>, parsedUrl: URL, terms: string[]) => number,
    providerLabel: string,
    note: string,
  ) => {
    const runVariant = async (providerPreference: string) => {
      const scopedQuery = buildScopedQuery(queryValue, scopedSite);
      const { provider, results } = await runSearchProvider(scopedQuery, Math.min(Math.max(limitValue * 4, 12), 40), providerPreference);
      const terms = splitSiteSearchTerms(queryValue);
      const seen = new Set<string>();
      const filtered = [];
      for (const entry of results as Array<Record<string, unknown>>) {
        const url = getSearchResultUrl(entry);
        const parsedUrl = safeUrl(url);
        if (!parsedUrl || !keepResult(entry, parsedUrl)) continue;
        const canonicalUrl = parsedUrl.toString();
        if (seen.has(canonicalUrl)) continue;
        seen.add(canonicalUrl);
        filtered.push({
          title: normalizeSearchText(String(entry.title || entry.name || "")),
          url: canonicalUrl,
          snippet: normalizeSearchText(String(entry.snippet || entry.description || "")) || null,
          score: scoreEntry(entry, parsedUrl, terms),
        });
      }
      return {
        provider: `${providerLabel}_${provider}`,
        scopedQuery,
        results: filtered
          .sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || String(left.title || "").localeCompare(String(right.title || "")))
          .slice(0, limitValue)
          .map(({ score, ...entry }) => entry),
      };
    };

    const primary = await runVariant(preferredProvider);
    if (primary.results.length > 0 || preferredProvider === "auto") {
      return { ...primary, note };
    }
    const secondary = await runVariant("auto");
    if (secondary.results.length > 0) {
      return {
        ...secondary,
        note: `${note} Retried with auto search after ${preferredProvider} returned no usable site results.`,
      };
    }
    return { ...primary, note };
  };

  const runBrowserBackedWebsiteSearch = async (
    websiteLabel: string,
    searchUrl: string,
    limitValue: number,
    evaluationBody: string,
    waitForResultsMs = 3500,
    timeoutForCallMs = 180000,
  ) => {
    requireCommandExecution();
    const preferredBackend = getBrowserAutomationBackend();
    const pageTimeout = Math.max(15000, Math.min(timeoutForCallMs - 5000, 120000));
    const script = [
      buildBrowserBackendPrelude(preferredBackend),
      `const searchUrl = decodeAgenticLiteral(${JSON.stringify(encodeInlineNodeLiteral(searchUrl))});`,
      `const resultLimit = ${Math.min(Math.max(limitValue, 1), 50)};`,
      `const waitForResultsMs = ${Math.min(Math.max(waitForResultsMs, 0), 15000)};`,
      "(async () => {",
      '  const browserType = await createAgenticBrowserType(preferredBrowserBackend, "chromium");',
      "  const browser = await browserType.launch({ headless: true });",
      "  try {",
      "    const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });",
      "    const page = await context.newPage();",
      `    await page.goto(searchUrl, { waitUntil: normalizeWaitUntil("domcontentloaded"), timeout: ${pageTimeout} });`,
      "    if (waitForResultsMs > 0) await page.waitForTimeout(waitForResultsMs);",
      "    const results = await page.evaluate(async ({ limit }) => {",
      evaluationBody,
      "    }, { limit: resultLimit });",
      "    console.log(JSON.stringify({ success: true, backend: preferredBrowserBackend, engine: browserType.engine, searchUrl, pageUrl: page.url(), pageTitle: await page.title(), results }, null, 2));",
      "    await context.close();",
      "  } finally {",
      "    await browser.close();",
      "  }",
      "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });",
    ].join("\n");
    const result = await executeConfiguredBrowserNodeScript(script, timeoutForCallMs, preferredBackend);
    if (result.exitCode !== 0 || result.error) {
      const failureText = String(result.stderr || result.error || result.stdout || `exit code ${result.exitCode}`).trim();
      throw new Error(failureText || `${websiteLabel} browser search failed.`);
    }
    const parsed = parseJsonObject(result.stdout as string, `${websiteLabel}_browser_search_result`);
    return {
      provider: `${websiteLabel}_browser_${String(parsed.engine || preferredBackend)}`,
      searchUrl: String(parsed.searchUrl || searchUrl),
      pageUrl: String(parsed.pageUrl || parsed.searchUrl || searchUrl),
      pageTitle: String(parsed.pageTitle || ""),
      note: preferredBackend === "camofox"
        ? `Used the vendored Camofox browser backend for direct ${websiteLabel} search extraction.`
        : `Used Playwright Chromium for direct ${websiteLabel} search extraction.`,
      results: Array.isArray(parsed.results) ? parsed.results : [],
    };
  };

  const searchQuora = async (queryValue: string, limitValue: number, preferredProvider: string) => {
    const note = "Quora direct search uses a real browser session because static local fetches often trigger an anti-bot challenge.";
    let browserError = "";
    try {
      requireCommandExecution();
      const preferredBackend = getBrowserAutomationBackend();
      const pageTimeout = Math.max(15000, Math.min(180000 - 5000, 120000));
      const directScript = [
        buildBrowserBackendPrelude(preferredBackend),
        `const searchQuery = ${JSON.stringify(queryValue)};`,
        `const resultLimit = ${Math.min(Math.max(limitValue, 1), 50)};`,
        "const quoraHost = String.fromCharCode(113, 117, 111, 114, 97, 46, 99, 111, 109);",
        'const homeUrl = "https://www." + quoraHost + "/";',
        'const searchUrl = homeUrl + "search?q=" + encodeURIComponent(searchQuery);',
        "const waitForResultsMs = 4500;",
        "(async () => {",
        '  const browserType = await createAgenticBrowserType(preferredBrowserBackend, "chromium");',
        "  const browser = await browserType.launch({ headless: true });",
        "  try {",
        "    const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });",
        "    const page = await context.newPage();",
        `    await page.goto(homeUrl, { waitUntil: normalizeWaitUntil("domcontentloaded"), timeout: ${pageTimeout} });`,
        "    const searchSelectors = ['input[type=\"search\"]', 'input[placeholder*=\"Search\" i]', 'input[aria-label*=\"Search\" i]'];",
        "    let searchBox = null;",
        "    for (const selector of searchSelectors) {",
        "      const candidate = page.locator(selector).first();",
        "      if (await candidate.count().catch(() => 0)) { searchBox = candidate; break; }",
        "    }",
        "    if (searchBox) {",
        "      await searchBox.fill(searchQuery).catch(() => {});",
        "      await searchBox.press(\"Enter\").catch(async () => { await page.keyboard.press(\"Enter\"); });",
        "    } else {",
        `      await page.goto(searchUrl, { waitUntil: normalizeWaitUntil("domcontentloaded"), timeout: ${pageTimeout} });`,
        "    }",
        "    if (waitForResultsMs > 0) await page.waitForTimeout(waitForResultsMs);",
        "    const results = await page.evaluate(async ({ limit }) => {",
        '      const normalize = (value) => String(value || "").replace(/\\s+/g, " ").trim();',
        '      const currentHost = String(location.hostname || "").replace(/^www\\./, "").toLowerCase();',
        "      const seen = new Set();",
        "      const results = [];",
        "      const anchors = Array.from(document.querySelectorAll('a[href]'));",
        "      for (const anchor of anchors) {",
        '        const rawHref = anchor.getAttribute("href") || "";',
        '        const title = normalize(anchor.textContent || anchor.getAttribute("aria-label") || "");',
        "        if (!rawHref || !title) continue;",
        "        let parsed;",
        "        try { parsed = new URL(rawHref, location.origin); } catch { continue; }",
        '        const host = String(parsed.hostname || "").replace(/^www\\./, "").toLowerCase();',
        '        const pathname = parsed.pathname || "/";',
        "        if (host !== currentHost) continue;",
        '        if (pathname === "/" || /^\\/(?:search|profile|topic|about|careers|contact|business|spaces|press|privacy|terms|languages|ads?info|login|signup)\\b/i.test(pathname)) continue;',
        "        const url = parsed.toString();",
        "        if (seen.has(url)) continue;",
        '        const container = anchor.closest(\'article, section, div[role="listitem"], div[class*="result"], div[class*="Result"], div[class*="search"], div[class*="Search"]\') || anchor.parentElement || anchor;',
        '        const fullText = normalize(container && container.textContent ? container.textContent : "");',
        '        const snippet = normalize(fullText.replace(title, "").slice(0, 320));',
        '        if (/^(?:press|imprensa|privacy|terms|login|signup)$/i.test(title)) continue;',
        "        seen.add(url);",
        "        results.push({ title, url, snippet: snippet || null });",
        "        if (results.length >= limit) break;",
        "      }",
        "      return results;",
        "    }, { limit: resultLimit });",
        "    console.log(JSON.stringify({ success: true, backend: preferredBrowserBackend, engine: browserType.engine, searchUrl, pageUrl: page.url(), pageTitle: await page.title(), results }, null, 2));",
        "    await context.close();",
        "  } finally {",
        "    await browser.close();",
        "  }",
        "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });",
      ].join("\n");
      const result = await executeConfiguredBrowserNodeScript(directScript, 180000, preferredBackend);
      if (result.exitCode !== 0 || result.error) {
        const failureText = String(result.stderr || result.error || result.stdout || `exit code ${result.exitCode}`).trim();
        throw new Error(failureText || "quora browser search failed.");
      }
      const parsed = parseJsonObject(result.stdout as string, "quora_browser_search_result");
      const directSearch = {
        provider: `quora_browser_${String(parsed.engine || preferredBackend)}`,
        searchUrl: String(parsed.searchUrl || ""),
        pageUrl: String(parsed.pageUrl || parsed.searchUrl || ""),
        pageTitle: String(parsed.pageTitle || ""),
        note: preferredBackend === "camofox"
          ? "Used the vendored Camofox browser backend for direct quora search extraction."
          : "Used Playwright Chromium for direct quora search extraction.",
        results: Array.isArray(parsed.results) ? parsed.results : [],
      };
      if (directSearch.results.length > 0) return { ...directSearch, note };
      if (/quora\.com\/?$/i.test(directSearch.pageUrl || "") || /:\/\/[a-z-]+\.quora\.com\/?$/i.test(directSearch.pageUrl || "") || /compartilhar conhecimento|share knowledge/i.test(directSearch.pageTitle || "")) {
        return {
          provider: `quora_browser_${String(parsed.engine || preferredBackend)}_blocked`,
          searchUrl: directSearch.pageUrl || directSearch.searchUrl,
          note: `${note} Quora redirected the anonymous browser session to its public login wall instead of exposing searchable results.`,
          results: [{
            title: directSearch.pageTitle || "Quora login wall",
            url: directSearch.pageUrl || directSearch.searchUrl,
            snippet: "Quora did not expose public search results to the anonymous browser session for this query.",
          }],
        };
      }
      browserError = "The direct Quora browser search returned no usable result links.";
    } catch (error) {
      browserError = (error as Error).message;
    }
    const strictSearch = await searchScopedSearchEngineResults(
      queryValue,
      limitValue,
      preferredProvider,
      "site:quora.com",
      (_entry, parsedUrl) => {
        const host = normalizeHost(parsedUrl.hostname);
        const pathname = parsedUrl.pathname || "/";
        if (host === "quora.com") return pathname !== "/" && !/^\/(?:search|profile|about|careers|contact|business|spaces)\b/i.test(pathname);
        if (host === "help.quora.com") return /^\/hc\/en-us\/articles\//i.test(pathname);
        return false;
      },
      (entry, parsedUrl, terms) => {
        const pathname = parsedUrl.pathname || "/";
        let score = scoreQueryMatch(`${entry.title || ""} ${entry.snippet || ""} ${pathname}`, queryValue, terms);
        if (/\/answer\//i.test(pathname)) score += 35;
        else if (/^\/topic\//i.test(pathname)) score += 18;
        else if (/^\/[^/]+$/i.test(pathname)) score += 20;
        if (normalizeHost(parsedUrl.hostname) === "help.quora.com") score += 8;
        return score;
      },
      "quora_scoped_search",
      `${note} Browser extraction failed, so a scoped public web search was used instead: ${browserError || "unknown browser error"}`,
    );
    if (strictSearch.results.length > 0) return strictSearch;
    return await searchScopedSearchEngineResults(
      `quora ${queryValue}`,
      limitValue,
      preferredProvider,
      "",
      (_entry, parsedUrl) => {
        const host = normalizeHost(parsedUrl.hostname);
        if (host === "quora.com") return parsedUrl.pathname !== "/" && !/^\/(?:search|profile|about|careers|contact|business|spaces)\b/i.test(parsedUrl.pathname || "/");
        if (host === "help.quora.com") return /^\/hc\/en-us\/articles\//i.test(parsedUrl.pathname || "/");
        return false;
      },
      (entry, parsedUrl, terms) => {
        let score = scoreQueryMatch(`${entry.title || ""} ${entry.snippet || ""} ${parsedUrl.pathname || "/"}`, queryValue, terms);
        if (/\/answer\//i.test(parsedUrl.pathname || "")) score += 35;
        else if (/^\/topic\//i.test(parsedUrl.pathname || "")) score += 18;
        else if (/^\/[^/]+$/i.test(parsedUrl.pathname || "")) score += 20;
        if (/quora/i.test(String(entry.title || ""))) score += 10;
        if (normalizeHost(parsedUrl.hostname) === "help.quora.com") score += 8;
        return score;
      },
      "quora_scoped_search",
      `${note} Browser extraction failed, and a broader Quora-branded query was used only after the scoped fallback returned nothing useful: ${browserError || "unknown browser error"}`,
    );
  };

  const searchTwitterX = async (queryValue: string, limitValue: number, preferredProvider: string) => {
    const note = "X/Twitter direct search uses a real browser session so the tool can try the live public search UI before falling back to scoped web search.";
    let browserError = "";
    try {
      const directSearch = await runBrowserBackedWebsiteSearch(
        "x",
        `https://x.com/search?q=${encodeURIComponent(queryValue)}&src=typed_query&f=live`,
        limitValue,
        [
          '      const normalize = (value) => String(value || "").replace(/\\s+/g, " ").trim();',
          "      const seen = new Set();",
          "      const results = [];",
          "      const anchors = Array.from(document.querySelectorAll('a[href]'));",
          "      for (const anchor of anchors) {",
          '        const rawHref = anchor.getAttribute("href") || "";',
          "        let parsed;",
          "        try { parsed = new URL(rawHref, location.origin); } catch { continue; }",
          '        const host = parsed.hostname.replace(/^www\\./, "").toLowerCase();',
          '        if (host !== "x.com" && host !== "twitter.com") continue;',
          '        const pathname = parsed.pathname || "/";',
          '        const isStatus = /^\\/[^/]+\\/status\\/\\d+/i.test(pathname);',
          '        const isProfile = /^\\/[^/]+$/i.test(pathname) && !/^\\/(?:search|explore|home|i\\/flow|settings|messages|compose|notifications|login|signup|tos|privacy|about|help|i\\/grok|i\\/premium_sign_up)\\b/i.test(pathname);',
          "        if (!isStatus && !isProfile) continue;",
          "        const url = parsed.toString();",
          "        if (seen.has(url)) continue;",
          '        const title = normalize(anchor.textContent || anchor.getAttribute("aria-label") || "");',
          '        const container = anchor.closest(\'article, div[data-testid="cellInnerDiv"], section, div[role="link"]\') || anchor.parentElement || anchor;',
          '        const fullText = normalize(container && container.textContent ? container.textContent : "");',
          '        const snippet = normalize((title && fullText.startsWith(title) ? fullText.slice(title.length) : fullText).slice(0, 320));',
          '        if (/^(?:terms of service|privacy policy|cookie policy|accessibility|help center|download the x app|get grok|create account|sign in)$/i.test(title)) continue;',
          "        seen.add(url);",
          '        results.push({ title: title || (isStatus ? pathname : pathname.replace(/^\\//, "")), url, snippet: snippet || null, mediaType: isStatus ? "post" : "profile" });',
          "      }",
          "      return results",
          '        .sort((left, right) => (left.mediaType === "post" ? -1 : 0) - (right.mediaType === "post" ? -1 : 0))',
          "        .slice(0, limit);",
        ].join("\n"),
        4500,
      );
      if (directSearch.results.length > 0) return { ...directSearch, note };
      if (/\/(?:i\/flow\/login|login)\b/i.test(String((directSearch as any).pageUrl || "")) || /sign in to x|what'?s happening/i.test(String((directSearch as any).pageTitle || ""))) {
        return {
          provider: `${String((directSearch as any).provider || "x_browser")}_blocked`,
          searchUrl: String((directSearch as any).pageUrl || directSearch.searchUrl || ""),
          note: `${note} X redirected the anonymous browser session to its login wall instead of exposing public search results.`,
          results: [{
            title: String((directSearch as any).pageTitle || "X login wall"),
            url: String((directSearch as any).pageUrl || directSearch.searchUrl || ""),
            snippet: "X did not expose public search results to the anonymous browser session for this query.",
          }],
        };
      }
      browserError = "The direct X/Twitter browser search returned no usable result links.";
    } catch (error) {
      browserError = (error as Error).message;
    }
    const strictSearch = await searchScopedSearchEngineResults(
      queryValue,
      limitValue,
      preferredProvider,
      "site:x.com OR site:twitter.com",
      (_entry, parsedUrl) => {
        const host = normalizeHost(parsedUrl.hostname);
        if (host !== "x.com" && host !== "twitter.com") return false;
        const pathname = parsedUrl.pathname || "/";
        return pathname !== "/" && !/^\/(?:search|explore|home|i\/flow|settings|messages|compose)\b/i.test(pathname);
      },
      (entry, parsedUrl, terms) => {
        const pathname = parsedUrl.pathname || "/";
        let score = scoreQueryMatch(`${entry.title || ""} ${entry.snippet || ""} ${pathname}`, queryValue, terms);
        if (/\/status\/\d+/i.test(pathname)) score += 45;
        else if (/^\/[^/]+$/i.test(pathname)) score += 18;
        return score;
      },
      "x_scoped_search",
      `${note} Browser extraction failed, so a scoped public web search was used instead: ${browserError || "unknown browser error"}`,
    );
    if (strictSearch.results.length > 0) return strictSearch;
    return await searchScopedSearchEngineResults(
      `twitter ${queryValue}`,
      limitValue,
      preferredProvider,
      "",
      (_entry, parsedUrl) => {
        const host = normalizeHost(parsedUrl.hostname);
        return (host === "x.com" || host === "twitter.com") && parsedUrl.pathname !== "/" && !/^\/(?:search|explore|home|i\/flow|settings|messages|compose)\b/i.test(parsedUrl.pathname || "/");
      },
      (entry, parsedUrl, terms) => {
        let score = scoreQueryMatch(`${entry.title || ""} ${entry.snippet || ""} ${parsedUrl.pathname || "/"}`, queryValue, terms);
        if (/\/status\/\d+/i.test(parsedUrl.pathname || "")) score += 45;
        else if (/^\/[^/]+$/i.test(parsedUrl.pathname || "")) score += 18;
        if (/twitter|x/i.test(String(entry.title || ""))) score += 10;
        return score;
      },
      "x_scoped_search",
      `${note} Browser extraction failed, and a broader Twitter/X-branded query was used only after the scoped fallback returned nothing useful: ${browserError || "unknown browser error"}`,
    );
  };

  const searchGitHubRepositories = async (queryValue: string, limitValue: number) => {
    const apiUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(queryValue)}&sort=stars&order=desc&per_page=${Math.min(Math.max(limitValue, 1), 50)}`;
    const { data } = await searchFetchJson(apiUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    const results = Array.isArray(data?.items) ? data.items : [];
    return {
      provider: "github_rest_repositories",
      apiUrl,
      results: results.slice(0, limitValue).map((entry: any) => ({
        title: entry.full_name || entry.name,
        name: entry.name || null,
        owner: entry.owner?.login || null,
        snippet: entry.description || null,
        stars: typeof entry.stargazers_count === "number" ? entry.stargazers_count : null,
        language: entry.language || null,
        updatedAt: entry.updated_at || null,
        url: entry.html_url || null,
      })),
    };
  };

  const searchNpmRegistry = async (queryValue: string, limitValue: number) => {
    const apiUrl = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(queryValue)}&size=${Math.min(Math.max(limitValue, 1), 50)}`;
    const { data } = await searchFetchJson(apiUrl);
    const results = Array.isArray(data?.objects) ? data.objects : [];
    return {
      provider: "npm_registry_search",
      apiUrl,
      results: results.slice(0, limitValue).map((entry: any) => ({
        title: entry.package?.name || null,
        name: entry.package?.name || null,
        version: entry.package?.version || null,
        snippet: entry.package?.description || null,
        publisher: entry.package?.publisher?.username || null,
        weeklyDownloads: entry.downloads?.weekly ?? null,
        monthlyDownloads: entry.downloads?.monthly ?? null,
        score: typeof entry.searchScore === "number" ? entry.searchScore : entry.score?.final ?? null,
        published: entry.package?.date || entry.updated || null,
        url: entry.package?.links?.npm || (entry.package?.name ? `https://www.npmjs.com/package/${encodeURIComponent(entry.package.name)}` : null),
        repository: entry.package?.links?.repository || null,
        homepage: entry.package?.links?.homepage || null,
      })),
    };
  };
  const searchFetchFirstWorkingMirror = async (label: string, urls: string[], timeoutForCall = 30000) => {
    const errors: string[] = [];
    for (const url of urls) {
      try {
        const { response, text } = await searchFetchText(url, {}, timeoutForCall);
        return { response, text, searchUrl: response.url || url };
      } catch (error) {
        errors.push(`${url}: ${(error as Error).message}`);
      }
    }
    throw new Error(`${label} search failed across all configured mirrors. ${errors.slice(0, 3).join(" | ")}`.trim());
  };

  const searchAnnasArchive = async (queryValue: string, limitValue: number) => {
    const mirrors = [
      "https://annas-archive.gl",
      "https://annas-archive.gd",
      "https://annas-archive.pk",
    ];
    const searchUrls = mirrors.map((baseUrl) => `${baseUrl}/search?q=${encodeURIComponent(queryValue)}`);
    const note = "Anna's Archive uses its native mirror search page before any browser fallback is attempted.";
    let fetchError = "";
    try {
      const { response, text, searchUrl } = await searchFetchFirstWorkingMirror("Anna's Archive", searchUrls, 45000);
      const origin = safeUrl(response.url || searchUrl)?.origin || safeUrl(searchUrl)?.origin || mirrors[0];
      const blocks = text.split(/<div class="flex\s+pt-3 pb-3 border-b last:border-b-0 border-gray-100">/i).slice(1);
      const seen = new Set<string>();
      const results: Array<Record<string, unknown>> = [];
      for (const block of blocks) {
        const detailPath = block.match(/<a href="(\/md5\/[^"]+)"/i)?.[1] || "";
        const title = normalizeSearchText(block.match(/<a href="\/md5\/[^"]+"[^>]*font-semibold[^>]*>([\s\S]*?)<\/a>/i)?.[1] || "");
        if (!detailPath || !title) continue;
        const url = safeUrl(detailPath, origin)?.toString() || "";
        if (!url || seen.has(url)) continue;
        seen.add(url);
        const metadataAnchors = [...block.matchAll(/<a href="\/search\?q=[^"]+"[^>]*class="[^"]*text-sm[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)];
        const author = normalizeSearchText(metadataAnchors[0]?.[1] || "");
        const publisher = normalizeSearchText(metadataAnchors[1]?.[1] || "");
        const source = normalizeSearchText(block.match(/<div class="line-clamp-\[2\][^"]*font-mono">([\s\S]*?)<\/div>/i)?.[1] || "");
        const snippet = normalizeSearchText(block.match(/<div class="relative"><div class="line-clamp-\[[0-9]+\][^"]*text-sm text-gray-600[^"]*">([\s\S]*?)<\/div>/i)?.[1] || "");
        results.push({
          title,
          url,
          author: author || null,
          publisher: publisher || null,
          snippet: snippet || null,
          source: source || null,
        });
        if (results.length >= limitValue) break;
      }
      if (results.length > 0) {
        return {
          provider: "annas_archive_results_page",
          searchUrl,
          note,
          results,
        };
      }
      fetchError = "The Anna's Archive search page loaded, but no result records were parsed from the mirror HTML.";
    } catch (error) {
      fetchError = (error as Error).message;
    }

    for (const searchUrl of searchUrls) {
      try {
        const directSearch = await runBrowserBackedWebsiteSearch(
          "annas_archive",
          searchUrl,
          limitValue,
          [
            "      const normalize = (value) => String(value || \"\").replace(/\\s+/g, \" \").trim();",
            "      const seen = new Set();",
            "      const results = [];",
            "      const cards = Array.from(document.querySelectorAll('div.flex.pt-3.pb-3.border-b, div[class*=\"border-b\"]')).filter((card) => card.querySelector('a[href^=\"/md5/\"]'));",
            "      for (const card of cards) {",
            "        const titleAnchor = Array.from(card.querySelectorAll('a[href^=\"/md5/\"]')).find((anchor) => /font-semibold|text-lg/i.test(anchor.className || '') && normalize(anchor.textContent || ''));",
            "        const detailHref = titleAnchor?.getAttribute('href') || card.querySelector('a[href^=\"/md5/\"]')?.getAttribute('href') || '';",
            "        const title = normalize(titleAnchor?.textContent || '');",
            "        if (!detailHref || !title) continue;",
            "        let parsed;",
            "        try { parsed = new URL(detailHref, location.origin); } catch { continue; }",
            "        const url = parsed.toString();",
            "        if (seen.has(url)) continue;",
            "        seen.add(url);",
            "        const metadataAnchors = Array.from(card.querySelectorAll('a[href^=\"/search?q=\"]')).map((anchor) => normalize(anchor.textContent || '')).filter(Boolean);",
            "        const source = normalize(card.querySelector('div.font-mono')?.textContent || '');",
            "        const snippet = normalize(card.querySelector('div.relative div.text-sm.text-gray-600')?.textContent || '');",
            "        results.push({ title, url, author: metadataAnchors[0] || null, publisher: metadataAnchors[1] || null, snippet: snippet || null, source: source || null });",
            "        if (results.length >= limit) break;",
            "      }",
            "      return results;",
          ].join("\n"),
          3000,
        );
        if (directSearch.results.length > 0) {
          return {
            ...directSearch,
            note: `${note} Browser extraction was used because regular mirror fetch parsing failed: ${fetchError || "unknown fetch error"}`,
          };
        }
      } catch {
        // Try the next mirror before failing the whole search.
      }
    }

    throw new Error(`Anna's Archive search failed. ${fetchError || "No browser-backed mirror returned usable results."}`);
  };

  const searchLibgen = async (queryValue: string, limitValue: number) => {
    const mirrors = [
      "https://libgen.li",
      "https://libgen.la",
      "https://libgen.gl",
      "https://libgen.bz",
      "https://libgen.vg",
    ];
    const searchParams = new URLSearchParams();
    searchParams.set("req", queryValue);
    ["t", "a", "s", "y", "p", "i"].forEach((value) => searchParams.append("columns[]", value));
    ["f", "e", "s", "a", "p", "w"].forEach((value) => searchParams.append("objects[]", value));
    ["l", "c", "f", "a", "m", "r", "s"].forEach((value) => searchParams.append("topics[]", value));
    searchParams.set("res", String(Math.min(Math.max(limitValue, 1), 50)));
    const searchUrls = mirrors.map((baseUrl) => `${baseUrl}/index.php?${searchParams.toString()}`);
    const note = "Libgen uses its native Format 2 search page with mirror failover before any browser fallback is attempted.";
    let fetchError = "";
    try {
      const { response, text, searchUrl } = await searchFetchFirstWorkingMirror("Libgen", searchUrls, 45000);
      const origin = safeUrl(response.url || searchUrl)?.origin || safeUrl(searchUrl)?.origin || mirrors[0];
      const tableBody = text.match(/<table[^>]+id="tablelibgen"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>\s*<\/table>/i)?.[1] || "";
      const rows = [...tableBody.matchAll(/<tr>\s*([\s\S]*?)<\/tr>/gi)];
      const results: Array<Record<string, unknown>> = [];
      for (const row of rows) {
        const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
        if (cells.length < 9) continue;
        const titleCandidates = [...cells[0].matchAll(/<a\b[\s\S]*?href="([^"]*edition\.php\?id=[^"]+)"[\s\S]*?>([\s\S]*?)<\/a>/gi)]
          .map((match) => ({ href: match[1], text: normalizeSearchText(match[2] || "") }))
          .filter((entry) => entry.text && /[A-Za-z]/.test(entry.text));
        const titleEntry = titleCandidates.sort((left, right) => right.text.length - left.text.length)[0];
        const url = titleEntry?.href ? (safeUrl(titleEntry.href, origin)?.toString() || "") : "";
        const title = titleEntry?.text || "";
        if (!url || !title) continue;
        const mirrorUrls = [...cells[8].matchAll(/<a[^>]+href="([^"]+)"/gi)]
          .map((match) => safeUrl(decodeHtmlEntities(match[1] || ""), origin)?.toString() || "")
          .filter(Boolean);
        results.push({
          title,
          url,
          author: normalizeSearchText(cells[1] || "") || null,
          publisher: normalizeSearchText(cells[2] || "") || null,
          year: normalizeSearchText(cells[3] || "") || null,
          language: normalizeSearchText(cells[4] || "") || null,
          pages: normalizeSearchText(cells[5] || "") || null,
          size: normalizeSearchText(cells[6] || "") || null,
          extension: normalizeSearchText(cells[7] || "").toLowerCase() || null,
          identifier: normalizeSearchText(cells[0].match(/<font color="green">([\s\S]*?)<\/font>/i)?.[1] || "") || null,
          mirrorUrl: mirrorUrls[0] || null,
        });
        if (results.length >= limitValue) break;
      }
      if (results.length > 0) {
        return {
          provider: "libgen_format2_results_page",
          searchUrl,
          note,
          results,
        };
      }
      fetchError = "The Libgen search page loaded, but no result rows were parsed from the results table.";
    } catch (error) {
      fetchError = (error as Error).message;
    }

    for (const searchUrl of searchUrls) {
      try {
        const directSearch = await runBrowserBackedWebsiteSearch(
          "libgen",
          searchUrl,
          limitValue,
          [
            "      const normalize = (value) => String(value || \"\").replace(/\\s+/g, \" \").trim();",
            "      const results = [];",
            "      const rows = Array.from(document.querySelectorAll('#tablelibgen tbody tr'));",
            "      for (const row of rows) {",
            "        const cells = Array.from(row.querySelectorAll('td'));",
            "        if (cells.length < 9) continue;",
            "        const titleAnchors = Array.from(cells[0].querySelectorAll('a[href*=\"edition.php?id=\"]'))",
            "          .map((anchor) => ({ href: anchor.getAttribute('href') || '', text: normalize(anchor.textContent || '') }))",
            "          .filter((entry) => entry.text && /[A-Za-z]/.test(entry.text));",
            "        titleAnchors.sort((left, right) => right.text.length - left.text.length);",
            "        const titleEntry = titleAnchors[0];",
            "        if (!titleEntry || !titleEntry.href || !titleEntry.text) continue;",
            "        let parsed;",
            "        try { parsed = new URL(titleEntry.href, location.origin); } catch { continue; }",
            "        const mirrorHref = cells[8].querySelector('a[href]')?.getAttribute('href') || '';",
            "        results.push({",
            "          title: titleEntry.text,",
            "          url: parsed.toString(),",
            "          author: normalize(cells[1].textContent || '') || null,",
            "          publisher: normalize(cells[2].textContent || '') || null,",
            "          year: normalize(cells[3].textContent || '') || null,",
            "          language: normalize(cells[4].textContent || '') || null,",
            "          pages: normalize(cells[5].textContent || '') || null,",
            "          size: normalize(cells[6].textContent || '') || null,",
            "          extension: normalize(cells[7].textContent || '').toLowerCase() || null,",
            "          identifier: normalize(cells[0].querySelector('font[color=\"green\"]')?.textContent || '') || null,",
            "          mirrorUrl: mirrorHref ? new URL(mirrorHref, location.origin).toString() : null,",
            "        });",
            "        if (results.length >= limit) break;",
            "      }",
            "      return results;",
          ].join("\n"),
          2500,
        );
        if (directSearch.results.length > 0) {
          return {
            ...directSearch,
            note: `${note} Browser extraction was used because regular mirror fetch parsing failed: ${fetchError || "unknown fetch error"}`,
          };
        }
      } catch {
        // Try the next mirror before failing the whole search.
      }
    }

    throw new Error(`Libgen search failed. ${fetchError || "No browser-backed mirror returned usable results."}`);
  };
  const searchArxiv = async (queryValue: string, limitValue: number) => {
    const apiUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(queryValue)}&start=0&max_results=${Math.min(Math.max(limitValue, 1), 50)}`;
    const { text } = await searchFetchText(apiUrl);
    const entries = text.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
    const results = entries.slice(0, limitValue).map((entry) => ({
      title: normalizeSearchText(entry.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || ""),
      snippet: normalizeSearchText(entry.match(/<summary>([\s\S]*?)<\/summary>/i)?.[1] || ""),
      published: normalizeSearchText(entry.match(/<published>([\s\S]*?)<\/published>/i)?.[1] || ""),
      updated: normalizeSearchText(entry.match(/<updated>([\s\S]*?)<\/updated>/i)?.[1] || ""),
      url: normalizeSearchText(entry.match(/<id>([\s\S]*?)<\/id>/i)?.[1] || ""),
      authors: [...entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>\s*<\/author>/gi)].map((match) => normalizeSearchText(match[1])).filter(Boolean),
    })).filter((entry) => entry.title && entry.url);
    return { provider: "arxiv_atom_api", apiUrl, results };
  };

  const searchYouTube = async (queryValue: string, limitValue: number) => {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(queryValue)}`;
    const { text } = await searchFetchText(searchUrl);
    const initialDataMatch = text.match(/var ytInitialData = ([\s\S]*?);<\/script>/i);
    if (!initialDataMatch) throw new Error("YouTube did not expose ytInitialData on the search results page.");
    const data = JSON.parse(initialDataMatch[1]);
    const results: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();

    for (const renderer of collectNestedObjects(data, "videoRenderer")) {
      const videoId = String(renderer.videoId || "").trim();
      const title = extractTextRuns(renderer.title);
      if (!videoId || !title) continue;
      const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
      if (seen.has(url)) continue;
      seen.add(url);
      results.push({
        title,
        url,
        channel: extractTextRuns(renderer.ownerText || renderer.shortBylineText),
        snippet: extractTextRuns(renderer.detailedMetadataSnippets?.[0]?.snippetText || renderer.descriptionSnippet),
        duration: extractTextRuns(renderer.lengthText),
        published: extractTextRuns(renderer.publishedTimeText),
        views: extractTextRuns(renderer.viewCountText),
        mediaType: "video",
      });
      if (results.length >= limitValue) return { provider: "youtube_results_page", searchUrl, results };
    }

    for (const renderer of collectNestedObjects(data, "playlistRenderer")) {
      const playlistId = String(renderer.playlistId || "").trim();
      const title = extractTextRuns(renderer.title);
      if (!playlistId || !title) continue;
      const url = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
      if (seen.has(url)) continue;
      seen.add(url);
      results.push({
        title,
        url,
        channel: extractTextRuns(renderer.longBylineText || renderer.shortBylineText),
        itemCount: extractTextRuns(renderer.videoCountText),
        mediaType: "playlist",
      });
      if (results.length >= limitValue) return { provider: "youtube_results_page", searchUrl, results };
    }

    for (const renderer of collectNestedObjects(data, "channelRenderer")) {
      const title = extractTextRuns(renderer.title);
      const channelUrl = safeUrl(String(renderer.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || ""), "https://www.youtube.com")?.toString()
        || (renderer.channelId ? `https://www.youtube.com/channel/${encodeURIComponent(String(renderer.channelId))}` : "");
      if (!title || !channelUrl) continue;
      if (seen.has(channelUrl)) continue;
      seen.add(channelUrl);
      results.push({
        title,
        url: channelUrl,
        snippet: extractTextRuns(renderer.descriptionSnippet),
        subscribers: extractTextRuns(renderer.subscriberCountText),
        videos: extractTextRuns(renderer.videoCountText),
        mediaType: "channel",
      });
      if (results.length >= limitValue) return { provider: "youtube_results_page", searchUrl, results };
    }

    return { provider: "youtube_results_page", searchUrl, results };
  };

  const searchMdnIndex = async (queryValue: string, limitValue: number, locale = "en-US") => {
    const apiUrl = `https://developer.mozilla.org/${locale}/search-index.json`;
    const { data } = await searchFetchJson(apiUrl);
    const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    const normalizedQuery = normalizeSearchText(queryValue).toLowerCase();
    const terms = splitSiteSearchTerms(queryValue);
    const scored = items
      .map((entry: any) => {
        const title = normalizeSearchText(entry?.title || "");
        const rawUrl = String(entry?.url || "");
        const resolvedUrl = safeUrl(rawUrl, `https://developer.mozilla.org/${locale}/`)?.toString() || "";
        const slugTail = rawUrl.split("/").filter(Boolean).pop()?.toLowerCase() || "";
        const titleLower = title.toLowerCase();
        const matchedTerms = terms.filter((term) => titleLower.includes(term) || slugTail.includes(term)).length;
        let score = matchedTerms * 12;
        if (titleLower.includes(normalizedQuery)) score += 40;
        if (slugTail.includes(normalizedQuery)) score += 25;
        if (titleLower === normalizedQuery || slugTail === normalizedQuery) score += 60;
        return {
          title,
          url: resolvedUrl,
          section: rawUrl.split("/").slice(0, -1).filter(Boolean).join("/"),
          score,
        };
      })
      .filter((entry) => entry.title && entry.url && entry.score > 0)
      .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
    return {
      provider: "mdn_search_index",
      apiUrl,
      results: scored.slice(0, limitValue).map(({ score, ...entry }) => entry),
    };
  };

  const searchMicrosoftLearn = async (queryValue: string, limitValue: number, locale = "en-us") => {
    const apiUrl = `https://learn.microsoft.com/api/search?search=${encodeURIComponent(queryValue)}&locale=${encodeURIComponent(locale)}&$top=${Math.min(Math.max(limitValue, 1), 50)}`;
    const { data } = await searchFetchJson(apiUrl);
    const results = Array.isArray(data?.results) ? data.results : [];
    return {
      provider: "microsoft_learn_api_search",
      apiUrl,
      results: results.slice(0, limitValue).map((entry: any) => ({
        title: entry.title || null,
        url: entry.url || null,
        snippet: entry.description || entry.descriptions?.[0]?.content || null,
        category: entry.category || null,
        lastUpdatedDate: entry.lastUpdatedDate || null,
      })),
    };
  };

  const searchSlashdot = async (queryValue: string, limitValue: number) => {
    const searchUrl = `https://slashdot.org/index2.pl?fhfilter=${encodeURIComponent(queryValue)}`;
    const { text } = await searchFetchText(searchUrl);
    const matches = [...text.matchAll(/<a[^>]+href="([^"]*\/story\/[^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    const seen = new Set<string>();
    const results = [];
    for (const match of matches) {
      const url = safeUrl(decodeHtmlEntities(match[1] || ""), "https://slashdot.org")?.toString() || "";
      const title = normalizeSearchText(match[2] || "");
      if (!url || !title || seen.has(url)) continue;
      seen.add(url);
      results.push({ title, url });
      if (results.length >= limitValue) break;
    }
    return { provider: "slashdot_filtered_firehose", searchUrl, results };
  };

  const specificWebsiteFallbackReason = (websiteName: string): string | null => ({
    docs: "Use website='docs' with a site domain for documentation sites that do not have a first-class search routine yet.",
    site: "Use website='site' with a domain to run a scoped general web search.",
    custom: "Use website='custom' with a domain to run a scoped general web search.",
    web: "Use website='web' for broad general web search without site scoping.",
  }[websiteName] || null);

  const runSpecificWebsiteSearch = async (
    websiteName: string,
    queryValue: string,
    limitValue: number,
    languageValue: string,
    subredditValue: string,
    sortValue: string,
    timeValue: string,
    siteValue: string,
    preferredProvider: string,
  ) => {
    switch (websiteName) {
      case "archive":
      case "internet_archive":
      case "archive_org":
        return await searchInternetArchive(queryValue, limitValue);
      case "wikipedia":
        return await searchWikipedia(queryValue, limitValue, languageValue);
      case "reddit":
        return await searchReddit(queryValue, limitValue, subredditValue, sortValue, timeValue);
      case "hackernews":
        return await searchHackerNews(queryValue, limitValue);
      case "stackoverflow":
        return await searchStackExchange(queryValue, limitValue, "stackoverflow");
      case "stackexchange":
        return await searchStackExchange(queryValue, limitValue, String(siteValue || "").trim() || "stackoverflow");
      case "wikihow":
        return await searchWikiHow(queryValue, limitValue);
      case "quora":
        return await searchQuora(queryValue, limitValue, preferredProvider);
      case "twitter":
      case "x":
        return await searchTwitterX(queryValue, limitValue, preferredProvider);
      case "github":
        return await searchGitHubRepositories(queryValue, limitValue);
      case "npm":
        return await searchNpmRegistry(queryValue, limitValue);
      case "pypi":
        return await searchPyPi(queryValue, limitValue, preferredProvider);
      case "arxiv":
        return await searchArxiv(queryValue, limitValue);
      case "annas_archive":
        return await searchAnnasArchive(queryValue, limitValue);
      case "libgen":
        return await searchLibgen(queryValue, limitValue);
      case "youtube":
        return await searchYouTube(queryValue, limitValue);
      case "mdn":
        return await searchMdnIndex(queryValue, limitValue, normalizeLocaleTag(languageValue, "en-US", "upper-region"));
      case "msdn":
        return await searchMicrosoftLearn(queryValue, limitValue, normalizeLocaleTag(languageValue, "en-us", "lower-region"));
      case "slashdot":
        return await searchSlashdot(queryValue, limitValue);
      default:
        return null;
    }
  };

  const configString = (fieldName: string): string =>
    (ctl.getPluginConfig(configSchematics).get(fieldName as any) as string | undefined)?.trim() || "";

  const qbtBaseUrl = (value: string): string => (String(value || "").trim() || configString("qbittorrentUrl") || "http://127.0.0.1:8080").replace(/\/+$/, "");
  const qbtUsername = (value: string): string => String(value || "").trim() || configString("qbittorrentUsername");
  const qbtPassword = (value: string): string => String(value || "") || configString("qbittorrentPassword");
  const seerrBaseUrl = (value: string): string => (String(value || "").trim() || configString("seerrUrl") || "http://127.0.0.1:5055").replace(/\/+$/, "");
  const seerrToken = (value: string): string => String(value || "").trim() || configString("seerrApiKey");

  const isLocalQbtBaseUrl = (baseUrl: string): boolean => {
    const parsed = safeUrl(baseUrl);
    const host = String(parsed?.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  };

  const connectQbt = async (baseUrl: string, username: string, password: string) => {
    requireCommandExecution();
    const api = require("qbittorrent-api-v2");
    return await api.connect(baseUrl, username, password);
  };

  const qbtLoginCookie = async (baseUrl: string, username: string, password: string): Promise<string> => {
    const body = new URLSearchParams({ username, password });
    const response = await fetch(`${baseUrl}/api/v2/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`qBittorrent login failed with status ${response.status}: ${response.statusText}`);
    const text = await response.text();
    if (!/Ok\./i.test(text)) throw new Error("qBittorrent login failed.");
    return response.headers.get("set-cookie") || "";
  };

  const qbtBypassSessionCookie = async (baseUrl: string): Promise<string> => {
    const response = await fetch(`${baseUrl}/api/v2/app/version`, {
      method: "GET",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`qBittorrent anonymous session bootstrap failed with status ${response.status}: ${response.statusText}`);
    await response.text();
    return response.headers.get("set-cookie") || "";
  };

  const qbtSearchSessionStorePath = path.join(workspaceRoot, ".agentic-studio", "qbittorrent-search-sessions.json");

  const readQbtSearchSessionStore = async (): Promise<Record<string, { baseUrl: string; cookie: string; updatedAt: string }>> => {
    try {
      const raw = await fsp.readFile(qbtSearchSessionStorePath, "utf8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed as Record<string, { baseUrl: string; cookie: string; updatedAt: string }> : {};
    } catch {
      return {};
    }
  };

  const writeQbtSearchSessionStore = async (store: Record<string, { baseUrl: string; cookie: string; updatedAt: string }>) => {
    await fsp.mkdir(path.dirname(qbtSearchSessionStorePath), { recursive: true });
    await fsp.writeFile(qbtSearchSessionStorePath, JSON.stringify(store, null, 2), "utf8");
  };

  const persistQbtSearchSession = async (baseUrl: string, searchId: number, cookie: string) => {
    if (!cookie || !Number.isFinite(searchId)) return;
    const store = await readQbtSearchSessionStore();
    store[`${baseUrl}::${searchId}`] = { baseUrl, cookie, updatedAt: new Date().toISOString() };
    store[`${baseUrl}::__latest__`] = { baseUrl, cookie, updatedAt: new Date().toISOString() };
    await writeQbtSearchSessionStore(store);
  };

  const loadQbtSearchSessionCookie = async (baseUrl: string, searchId?: number): Promise<string> => {
    const store = await readQbtSearchSessionStore();
    if (Number.isFinite(searchId)) {
      const exact = store[`${baseUrl}::${searchId}`];
      if (exact?.cookie) return exact.cookie;
    }
    const latest = store[`${baseUrl}::__latest__`];
    return latest?.cookie || "";
  };

  const clearQbtSearchSession = async (baseUrl: string, searchId: number) => {
    const store = await readQbtSearchSessionStore();
    delete store[`${baseUrl}::${searchId}`];
    await writeQbtSearchSessionStore(store);
  };

  const qbtApiRequest = async (baseUrl: string, cookie: string, endpoint: string, form: FormData | URLSearchParams) => {
    const headers: Record<string, string> = {};
    if (cookie) headers.Cookie = cookie;
    if (form instanceof URLSearchParams) headers["Content-Type"] = "application/x-www-form-urlencoded";
    const response = await fetch(`${baseUrl}/api/v2${endpoint}`, {
      method: "POST",
      headers,
      body: form,
      signal: AbortSignal.timeout(60000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`qBittorrent API ${endpoint} failed with status ${response.status}: ${text || response.statusText}`);
    try {
      return text ? JSON.parse(text) : { success: true };
    } catch {
      return { success: true, body: text };
    }
  };

  const qbtApiGet = async (baseUrl: string, cookie: string, endpoint: string, params?: Record<string, unknown>) => {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null || value === "") continue;
      searchParams.set(key, String(value));
    }
    const url = `${baseUrl}/api/v2${endpoint}${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`;
    const headers: Record<string, string> = {};
    if (cookie) headers.Cookie = cookie;
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(60000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`qBittorrent API ${endpoint} failed with status ${response.status}: ${text || response.statusText}`);
    try {
      return text ? JSON.parse(text) : { success: true };
    } catch {
      return text;
    }
  };

  const qbtApiGetWithFallbacks = async (
    baseUrl: string,
    cookie: string,
    endpoint: string,
    paramCandidates: Array<Record<string, unknown>>,
  ) => {
    let lastError: unknown;
    for (const params of paramCandidates) {
      try {
        return await qbtApiGet(baseUrl, cookie, endpoint, params);
      } catch (error) {
        lastError = error;
        if (!/status (400|404)\b/i.test(String((error as Error).message || ""))) throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`qBittorrent API ${endpoint} failed.`);
  };

  const qbtApiPostWithFallbacks = async (
    baseUrl: string,
    cookie: string,
    endpoint: string,
    formCandidates: Array<URLSearchParams>,
  ) => {
    let lastError: unknown;
    for (const form of formCandidates) {
      try {
        return await qbtApiRequest(baseUrl, cookie, endpoint, form);
      } catch (error) {
        lastError = error;
        if (!/status (400|404|405)\b/i.test(String((error as Error).message || ""))) throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`qBittorrent API ${endpoint} failed.`);
  };

  const resolveQbtAuthContext = async (baseUrl: string, username: string, password: string) => {
    const canBypassLocalAuth = isLocalQbtBaseUrl(baseUrl);
    if (username && password) {
      try {
        return { authMode: "login", cookie: await qbtLoginCookie(baseUrl, username, password) };
      } catch (error) {
        if (!canBypassLocalAuth) throw error;
        return {
          authMode: "localhost_bypass",
          cookie: "",
          warning: `qBittorrent login failed and fell back to localhost bypass mode: ${(error as Error).message}`,
        };
      }
    }
    if (canBypassLocalAuth) {
      return { authMode: "localhost_bypass", cookie: await qbtBypassSessionCookie(baseUrl) };
    }
    throw new Error("qBittorrent username and password must be provided either in the tool arguments or in the plugin settings.");
  };

  const createQbtHttpClient = async (baseUrl: string, authContext: Record<string, unknown>) => {
    const cookie = String(authContext.cookie || "");
    const postWithFallback = async (primaryEndpoint: string, fallbackEndpoint: string | null, form: URLSearchParams) => {
      try {
        return await qbtApiRequest(baseUrl, cookie, primaryEndpoint, form);
      } catch (error) {
        if (!fallbackEndpoint || !/status 404/i.test(String((error as Error).message || ""))) throw error;
        return await qbtApiRequest(baseUrl, cookie, fallbackEndpoint, form);
      }
    };
    return {
      authMode: authContext.authMode,
      warning: authContext.warning,
      appVersion: async () => await qbtApiGet(baseUrl, cookie, "/app/version"),
      apiVersion: async () => await qbtApiGet(baseUrl, cookie, "/app/webapiVersion"),
      transferInfo: async () => await qbtApiGet(baseUrl, cookie, "/transfer/info"),
      defaultSavePath: async () => await qbtApiGet(baseUrl, cookie, "/app/defaultSavePath"),
      torrents: async (filter?: string, category?: string, sort?: string, reverse?: boolean, limit?: number, offset?: number, hashes?: string) =>
        await qbtApiGet(baseUrl, cookie, "/torrents/info", { filter, category, sort, reverse, limit, offset, hashes }),
      deleteTorrents: async (hashes: string, deleteFiles: boolean) =>
        await qbtApiRequest(baseUrl, cookie, "/torrents/delete", new URLSearchParams({ hashes, deleteFiles: String(Boolean(deleteFiles)) })),
      pauseTorrents: async (hashes: string) =>
        await postWithFallback("/torrents/stop", "/torrents/pause", new URLSearchParams({ hashes })),
      resumeTorrents: async (hashes: string) =>
        await postWithFallback("/torrents/start", "/torrents/resume", new URLSearchParams({ hashes })),
      recheckTorrents: async (hashes: string) =>
        await qbtApiRequest(baseUrl, cookie, "/torrents/recheck", new URLSearchParams({ hashes })),
      reannounceTorrents: async (hashes: string) =>
        await qbtApiRequest(baseUrl, cookie, "/torrents/reannounce", new URLSearchParams({ hashes })),
      files: async (hash: string) =>
        await qbtApiGet(baseUrl, cookie, "/torrents/files", { hash }),
      properties: async (hash: string) =>
        await qbtApiGet(baseUrl, cookie, "/torrents/properties", { hash }),
      trackers: async (hash: string) =>
        await qbtApiGet(baseUrl, cookie, "/torrents/trackers", { hash }),
      setLocation: async (hashes: string, location: string) =>
        await qbtApiRequest(baseUrl, cookie, "/torrents/setLocation", new URLSearchParams({ hashes, location })),
      setCategory: async (hashes: string, category: string) =>
        await qbtApiRequest(baseUrl, cookie, "/torrents/setCategory", new URLSearchParams({ hashes, category })),
      setDownloadLimit: async (hashes: string, limit: number) =>
        await qbtApiRequest(baseUrl, cookie, "/torrents/setDownloadLimit", new URLSearchParams({ hashes, limit: String(limit) })),
      setUploadLimit: async (hashes: string, limit: number) =>
        await qbtApiRequest(baseUrl, cookie, "/torrents/setUploadLimit", new URLSearchParams({ hashes, limit: String(limit) })),
      setShareLimit: async (hashes: string, ratioLimit: number, seedingTimeLimit: number) =>
        await qbtApiRequest(baseUrl, cookie, "/torrents/setShareLimits", new URLSearchParams({ hashes, ratioLimit: String(ratioLimit), seedingTimeLimit: String(seedingTimeLimit) })),
      setForceStart: async (hashes: string, value: boolean) =>
        await qbtApiRequest(baseUrl, cookie, "/torrents/setForceStart", new URLSearchParams({ hashes, value: String(Boolean(value)) })),
      setSuperSeeding: async (hashes: string, value: boolean) =>
        await qbtApiRequest(baseUrl, cookie, "/torrents/setSuperSeeding", new URLSearchParams({ hashes, value: String(Boolean(value)) })),
      toggleSequentialDownload: async (hashes: string) =>
        await qbtApiRequest(baseUrl, cookie, "/torrents/toggleSequentialDownload", new URLSearchParams({ hashes })),
      toggleFirstLastPiecePrio: async (hashes: string) =>
        await qbtApiRequest(baseUrl, cookie, "/torrents/toggleFirstLastPiecePrio", new URLSearchParams({ hashes })),
      searchPlugins: async () =>
        await qbtApiGet(baseUrl, cookie, "/search/plugins"),
      startSearch: async (pattern: string, plugins: string, category: string) =>
        await qbtApiRequest(baseUrl, cookie, "/search/start", new URLSearchParams({ pattern, plugins, category })),
      searchStatus: async (searchId?: number) =>
        searchId === undefined
          ? await qbtApiGet(baseUrl, cookie, "/search/status")
          : await qbtApiGetWithFallbacks(baseUrl, cookie, "/search/status", [{ searchId }, { id: searchId }]),
      searchResults: async (searchId: number, limitValue?: number, offsetValue?: number) =>
        await qbtApiGetWithFallbacks(baseUrl, cookie, "/search/results", [
          { searchId, limit: limitValue, offset: offsetValue },
          { id: searchId, limit: limitValue, offset: offsetValue },
        ]),
      deleteSearch: async (searchId: number) =>
        await qbtApiPostWithFallbacks(baseUrl, cookie, "/search/delete", [
          new URLSearchParams({ searchId: String(searchId) }),
          new URLSearchParams({ id: String(searchId) }),
        ]),
    };
  };

  const connectOrBypassQbt = async (baseUrl: string, username: string, password: string) => {
    const authContext = await resolveQbtAuthContext(baseUrl, username, password);
    if (String(authContext.authMode) === "login") {
      try {
        return { client: await connectQbt(baseUrl, username, password), authContext };
      } catch (error) {
        if (!isLocalQbtBaseUrl(baseUrl)) throw error;
        const bypassContext = { authMode: "localhost_bypass", cookie: "", warning: `qBittorrent client login failed and fell back to localhost bypass mode: ${(error as Error).message}` };
        return { client: await createQbtHttpClient(baseUrl, bypassContext), authContext: bypassContext };
      }
    }
    return { client: await createQbtHttpClient(baseUrl, authContext), authContext };
  };

  const seerrApiRequest = async (baseUrl: string, apiKey: string, endpoint: string, method: string, body: unknown, timeoutForCall: number) => {
    if (!apiKey) throw new Error("Seerr API key is required. Pass seerr_api_key or configure Seerr API Key in plugin settings.");
    const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const response = await fetch(`${baseUrl}${normalizedEndpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: ["GET", "HEAD"].includes(method) ? undefined : JSON.stringify(body || {}),
      signal: AbortSignal.timeout(timeoutForCall),
    });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text };
    }
    if (!response.ok) {
      throw new Error(`Seerr API ${normalizedEndpoint} failed with status ${response.status}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`);
    }
    return parsed;
  };

  const addDownloadHintsToSearchResults = async (results: unknown[], maxArchiveLinks = 5): Promise<Array<Record<string, unknown>>> => {
    const enriched = [];
    for (const entry of results as Array<Record<string, unknown>>) {
      const candidateUrl = String(entry?.url || entry?.link || entry?.href || "");
      const downloadLinks: Array<Record<string, unknown>> = [];
      if (candidateUrl && isProbablyDownloadableUrl(candidateUrl)) {
        downloadLinks.push({
          index: 1,
          name: inferFileNameFromUrl(candidateUrl),
          url: candidateUrl,
          asWebDownloadArgs: { url: candidateUrl, output_path: "downloads/" },
        });
      }
      const parsed = safeUrl(candidateUrl);
      const archiveIdentifier = parsed && parsed.hostname.toLowerCase().endsWith("archive.org")
        ? parsed.pathname.match(/^\/details\/([^/?#]+)/)?.[1]
        : "";
      if (archiveIdentifier) {
        downloadLinks.push(...await archiveDownloadLinks(decodeURIComponent(archiveIdentifier), maxArchiveLinks));
      }
      enriched.push(downloadLinks.length > 0 ? { ...entry, downloadLinks } : entry);
    }
    return enriched;
  };

tools.push(tool({
    name: "as_http_request",
    description: "Make an HTTP request with method, headers, optional body, and truncated response.",
    parameters: {
      url: z.string().url(),
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).default("GET"),
      headers_json: z.string().default("{}"),
      body: z.string().default(""),
      detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
      timeout_ms: z.number().int().min(1000).max(300000).default(30000),
    },
    implementation: safeTool("as_http_request", async ({ url, method, headers_json, body, detail, timeout_ms }) => {
      const detailLevel = normalizeDetailLevel(detail);
      const parsedHeaders = JSON.parse(headers_json as string);
      if (!parsedHeaders || typeof parsedHeaders !== "object" || Array.isArray(parsedHeaders)) {
        throw new Error("headers_json must be a JSON object.");
      }
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeout_ms as number);
      try {
        const response = await fetch(url as string, {
          method: method as string,
          headers: parsedHeaders as Record<string, string>,
          body: ["GET", "HEAD"].includes(method as string) ? undefined : (body as string),
          signal: controller.signal,
          redirect: "follow",
        });
        const responseBody = truncateOutput(await response.text(), maxOutputBytes);
        const basePayload = {
          url,
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get("content-type") || null,
          contentLength: response.headers.get("content-length") || null,
        };
        if (detailLevel === "max") {
          return json({
            ...basePayload,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseBody,
          });
        }
        return json(await compactTextPayload("as_http_request", detailLevel, "body", responseBody, {
          ...basePayload,
          headerCount: [...response.headers.keys()].length,
          headers: detailLevel === "full" ? Object.fromEntries(response.headers.entries()) : undefined,
        }));
      } finally {
        clearTimeout(timeoutHandle);
      }
    }),
  }));

tools.push(tool({
    name: "as_http_wait",
    description: "Poll an HTTP endpoint until it returns the expected status and optional body content.",
    parameters: {
      url: z.string().url(),
      method: z.enum(["GET", "HEAD"]).default("GET"),
      headers_json: z.string().default("{}"),
      expect_status: z.number().int().min(100).max(599).default(200),
      contains_text: z.string().default(""),
      regex: z.string().default(""),
      detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
      timeout_ms: z.number().int().min(1000).max(3600000).default(60000),
      poll_interval_ms: z.number().int().min(100).max(10000).default(1000),
    },
    implementation: safeTool("as_http_wait", async ({ url, method, headers_json, expect_status, contains_text, regex, detail, timeout_ms, poll_interval_ms }) => {
      const detailLevel = normalizeDetailLevel(detail);
      const parsedHeaders = JSON.parse(headers_json as string);
      if (!parsedHeaders || typeof parsedHeaders !== "object" || Array.isArray(parsedHeaders)) {
        throw new Error("headers_json must be a JSON object.");
      }
      const startedAt = Date.now();
      const pattern = String(regex || "").trim() ? new RegExp(regex as string) : null;
      while (Date.now() - startedAt < Number(timeout_ms)) {
        const controller = new AbortController();
        const requestTimeout = setTimeout(() => controller.abort(), Math.min(Number(poll_interval_ms), 15000));
        try {
          const response = await fetch(url as string, {
            method: method as string,
            headers: parsedHeaders as Record<string, string>,
            redirect: "follow",
            signal: controller.signal,
          });
          const body = method === "HEAD" ? "" : await response.text();
          const statusOk = response.status === Number(expect_status);
          const textOk = !String(contains_text || "").trim() || body.includes(String(contains_text));
          const regexOk = !pattern || pattern.test(body);
          if (statusOk && textOk && regexOk) {
            const bodyText = truncateOutput(body, maxOutputBytes);
            if (detailLevel === "max") {
              return json({
                success: true,
                url,
                status: response.status,
                waitedMs: Date.now() - startedAt,
                body: bodyText,
              });
            }
            return json(await compactTextPayload("as_http_wait", detailLevel, "body", bodyText, {
              success: true,
              url,
              status: response.status,
              waitedMs: Date.now() - startedAt,
            }));
          }
        } catch {
          // Keep polling until timeout.
        } finally {
          clearTimeout(requestTimeout);
        }
        await new Promise((resolve) => setTimeout(resolve, Number(poll_interval_ms)));
      }
      return json({ success: false, url, timedOut: true, waitedMs: Date.now() - startedAt });
    }),
  }));

tools.push(tool({
    name: "as_web_download",
    description: "Download web files to disk, resolve common share links, route supported media pages through yt-dlp, or scan a page for downloadable file options.",
    parameters: {
      url: z.string().url(),
      output_path: z.string().default("downloads/"),
      overwrite: z.boolean().default(false),
      force_download: z.boolean().default(false),
      download_index: z.number().int().min(1).max(100).optional(),
      scan_limit: z.number().int().min(1).max(50).default(12),
      detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
      timeout_ms: z.number().int().min(1000).max(3600000).default(300000),
    },
    implementation: safeTool("as_web_download", async ({ url, output_path, overwrite, force_download, download_index, scan_limit, detail, timeout_ms }) => {
      const detailLevel = normalizeDetailLevel(detail);
      const originalUrl = String(url);
      const transformed = transformKnownDownloadUrl(originalUrl);
      const downloadUrl = transformed.url;

      if (isCommonYtDlpHost(downloadUrl) && !isProbablyDownloadableUrl(downloadUrl)) {
        return await runVideoDownloadRedirect(downloadUrl, output_path as string, overwrite as boolean, timeout_ms as number);
      }

      if (/\/\/(?:drive|docs)\.google\.com\//i.test(downloadUrl)) {
        return json(await fetchDownloadToFile(downloadUrl, output_path as string, overwrite as boolean, timeout_ms as number, transformed.note));
      }

      const parsed = safeUrl(downloadUrl);
      const archiveIdentifier = parsed && parsed.hostname.toLowerCase().endsWith("archive.org")
        ? (parsed.pathname.match(/^\/details\/([^/?#]+)/)?.[1] || parsed.pathname.match(/^\/download\/([^/?#]+)/)?.[1] || "")
        : "";
      if (archiveIdentifier && !parsed?.pathname.startsWith("/download/")) {
        const downloadLinks = await archiveDownloadLinks(decodeURIComponent(archiveIdentifier), scan_limit as number);
        if (downloadLinks.length === 0) {
          return json({
            success: false,
            detail: detailLevel,
            url: originalUrl,
            finalUrl: downloadUrl,
            note: "No downloadable Internet Archive files were found for this item.",
            downloadOptions: [],
          });
        }
        const chosen = download_index ? downloadLinks[Number(download_index) - 1] : (force_download ? downloadLinks[0] : null);
        if (chosen) {
          return json(await fetchDownloadToFile(String(chosen.url), output_path as string, overwrite as boolean, timeout_ms as number, transformed.note));
        }
        return json({
          success: false,
          detail: detailLevel,
          needsSelection: true,
          url: originalUrl,
          finalUrl: downloadUrl,
          note: "Select a download_index or set force_download=true to download the highest-ranked Internet Archive file.",
          downloadOptions: detailLevel === "compact" ? downloadLinks.slice(0, 10) : downloadLinks,
          truncated: detailLevel === "compact" && downloadLinks.length > 10,
        });
      }

      const head = await probeCandidateHeaders(downloadUrl);
      const looksDirect = isProbablyDownloadableUrl(String(head.finalUrl || downloadUrl))
        || !contentTypeLooksHtml(String(head.contentType || ""));
      if (looksDirect) {
        return json(await fetchDownloadToFile(downloadUrl, output_path as string, overwrite as boolean, timeout_ms as number, transformed.note));
      }

      const response = await fetch(downloadUrl, {
        redirect: "follow",
        headers: { "User-Agent": "agentic-studio/1.0" },
        signal: AbortSignal.timeout(Math.min(timeout_ms as number, 120000)),
      });
      if (!response.ok) throw new Error(`Download discovery failed with status ${response.status}: ${response.statusText}`);
      const contentType = response.headers.get("content-type") || "";
      if (!contentTypeLooksHtml(contentType)) {
        return json(await fetchDownloadToFile(response.url || downloadUrl, output_path as string, overwrite as boolean, timeout_ms as number, transformed.note));
      }

      const html = await response.text();
      const discovered = await discoverDownloadOptions(response.url || downloadUrl, html, scan_limit as number);
      const chosen = download_index ? discovered[Number(download_index) - 1] : (force_download ? discovered[0] : null);
      if (chosen?.url) {
        return json(await fetchDownloadToFile(String(chosen.url), output_path as string, overwrite as boolean, timeout_ms as number, transformed.note));
      }
      return json({
        success: false,
        detail: detailLevel,
        needsSelection: discovered.length > 0,
        url: originalUrl,
        finalUrl: response.url || downloadUrl,
        note: discovered.length > 0
          ? "The URL was an HTML page. Choose download_index or call again with force_download=true to fetch the best candidate."
          : "The URL was an HTML page and no likely downloadable file links were found.",
        transformedNote: transformed.note,
        downloadOptions: (detailLevel === "compact" ? discovered.slice(0, 10) : discovered).map((entry: Record<string, unknown>) => ({
          ...entry,
          asWebDownloadArgs: {
            url: entry.url,
            output_path,
            download_index: entry.index,
          },
        })),
        truncated: detailLevel === "compact" && discovered.length > 10,
      });
    }),
  }));

tools.push(tool({
    name: "as_web_extract",
    description: "Visit, scrape, archive, crawl, map, or run a bounded browser extraction workflow through one web extraction controller.",
    parameters: {
      action: z.enum(["visit", "images", "archive", "firecrawl_scrape", "firecrawl_map", "firecrawl_search", "firecrawl_crawl", "firecrawl_agent", "firecrawl_interact", "browser_script"]),
      url: z.string().url().default("https://example.com"),
      query: z.string().default(""),
      prompt: z.string().default(""),
      code: z.string().default(""),
      script_js: z.string().default(""),
      input_json: z.string().default("{}"),
      output_path: z.string().default(""),
      output_directory: z.string().default("."),
      format: z.enum(["mhtml", "pdf", "html"]).default("mhtml"),
      formats_json: z.string().default("[\"markdown\"]"),
      schema_json: z.string().default(""),
      extraction_prompt: z.string().default(""),
      options_json: z.string().default("{}"),
      detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
      wait_until: z.enum(["load", "domcontentloaded", "networkidle", "networkidle0", "networkidle2"]).default("networkidle"),
      limit: z.number().int().min(1).max(200).default(40),
      timeout_ms: z.number().int().min(1000).max(3600000).default(120000),
      poll_interval_ms: z.number().int().min(500).max(60000).default(3000),
      wait_timeout_ms: z.number().int().min(1000).max(3600000).default(300000),
    },
    implementation: safeTool("as_web_extract", async ({ action, url, query, prompt, code, script_js, input_json, output_path, output_directory, format, formats_json, schema_json, extraction_prompt, options_json, detail, wait_until, limit, timeout_ms, poll_interval_ms, wait_timeout_ms }) => {
      const selectedAction = String(action);
      const detailLevel = normalizeDetailLevel(detail);
      if (selectedAction === "visit") {
        const response = await fetch(url as string, { redirect: "follow", signal: AbortSignal.timeout(Math.min(timeout_ms as number, 300000)) });
        const html = await response.text();
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const text = stripHtmlToText(html).slice(0, maxOutputBytes);
        if (detailLevel === "max") return json({ url, finalUrl: response.url, title: stripHtmlToText(titleMatch?.[1] || ""), text });
        return json(await compactTextPayload("as_web_extract", detailLevel, "text", text, {
          action: selectedAction,
          url,
          finalUrl: response.url,
          title: stripHtmlToText(titleMatch?.[1] || ""),
        }));
      }
      if (selectedAction === "images") {
        const images = await extractPageImages(url as string, limit as number);
        if (detailLevel === "max") return json({ url, images });
        return json(await compactCollectionPayload("as_web_extract", detailLevel, { action: selectedAction, url }, "images", images, compactSearchRecord));
      }
      if (selectedAction === "archive") {
        requireCommandExecution();
        const preferredBrowserBackend = getBrowserAutomationBackend();
        const parsedUrl = safeUrl(url as string);
        const defaultOutputName = `${sanitizeFileName(parsedUrl?.hostname || "page")}-${Date.now()}.${format === "mhtml" ? "mhtml" : format}`;
        const destinationPath = resolveInsideWorkspace(workspaceRoot, String(output_path || "").trim() || `downloads/${defaultOutputName}`);
        await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
        const script = [
          buildBrowserBackendPrelude(preferredBrowserBackend),
          'const fs = require("fs/promises");',
          `const targetUrl = decodeAgenticLiteral(${JSON.stringify(encodeInlineNodeLiteral(String(url)))});`,
          `const targetWaitUntil = ${JSON.stringify(wait_until)};`,
          `const targetTimeoutMs = ${Number(timeout_ms)};`,
          `const outputPath = ${JSON.stringify(destinationPath)};`,
          `const archiveFormat = ${JSON.stringify(format)};`,
          "(async () => {",
          "  const requestedBackend = preferredBrowserBackend;",
          '  const effectiveBackend = requestedBackend === "camofox" && archiveFormat !== "html" ? "playwright" : requestedBackend;',
          '  const fallbackNote = requestedBackend === "camofox" && effectiveBackend !== requestedBackend',
          '    ? ("Camofox uses a Firefox-based engine, so " + archiveFormat.toUpperCase() + " export was completed with Playwright Chromium.")',
          "    : null;",
          '  const browserType = await createAgenticBrowserType(effectiveBackend, "chromium");',
          "  const browser = await browserType.launch({ headless: true });",
          "  try {",
          "    const context = await browser.newContext();",
          "    const page = await context.newPage();",
          "    await page.goto(targetUrl, { waitUntil: normalizeWaitUntil(targetWaitUntil), timeout: targetTimeoutMs });",
          '    if (archiveFormat === "pdf") {',
          '      if (typeof page.pdf !== "function") throw new Error("The active browser engine does not support PDF export.");',
          "      await page.pdf({ path: outputPath, printBackground: true, preferCSSPageSize: true });",
          '    } else if (archiveFormat === "html") {',
          '      await fs.writeFile(outputPath, await page.content(), "utf8");',
          "    } else {",
          '      if (typeof context.newCDPSession !== "function") throw new Error("The active browser engine does not support MHTML export.");',
          "      const client = await context.newCDPSession(page);",
          '      const snapshot = await client.send("Page.captureSnapshot", { format: "mhtml" });',
          '      await fs.writeFile(outputPath, snapshot.data, "utf8");',
          "    }",
          "    console.log(JSON.stringify({ success: true, outputPath, format: archiveFormat, requestedBackend, effectiveBackend, engine: browserType.engine, note: fallbackNote || undefined }, null, 2));",
          "    await context.close();",
          "  } finally {",
          "    await browser.close();",
          "  }",
          "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });",
        ].join("\n");
        const result = await executeConfiguredBrowserNodeScript(script, Math.max(timeoutMs, timeout_ms as number), preferredBrowserBackend);
        return buildCommandResponse(`node archive page ${url as string}`, result);
      }
      if (selectedAction === "firecrawl_scrape") {
        const formats = JSON.parse(formats_json as string);
        if (!Array.isArray(formats)) throw new Error("formats_json must be a JSON array.");
        const options = parseJsonObject(options_json as string, "options_json");
        const schema = String(schema_json || "").trim() ? parseJsonObject(schema_json as string, "schema_json") : null;
        const body = mergeDefined(options, {
          url,
          formats: (() => {
            const current: unknown[] = [...formats];
            if (schema || String(extraction_prompt || "").trim()) {
              current.push(mergeDefined<Record<string, unknown>>({ type: "json", prompt: String(extraction_prompt || "").trim() || "Extract the requested structured data from the page." }, schema ? { schema } : {}));
            }
            return current;
          })(),
        });
        const response = await firecrawlApiRequest(ctl, "/v2/scrape", "POST", body, timeout_ms as number);
        if (String(output_path || "").trim()) {
          const targetPath = resolveInsideWorkspace(workspaceRoot, output_path as string);
          await fsp.mkdir(path.dirname(targetPath), { recursive: true });
          await fsp.writeFile(targetPath, JSON.stringify(response, null, 2), "utf8");
        }
        if (detailLevel === "max") return json(response);
        const reportPath = await maybeWriteToolOutputToFile(workspaceRoot, createReportPath("as_web_extract", selectedAction), response);
        return json({
          action: selectedAction,
          detail: detailLevel,
          reportPath,
          reportReadGuidance: REPORT_READ_GUIDANCE,
          id: response.id || response.jobId || response.scrapeId || null,
          status: response.status || (response.success === true ? "success" : null),
        });
      }
      if (selectedAction === "firecrawl_map") {
        const response = await firecrawlApiRequest(ctl, "/v2/map", "POST", mergeDefined(parseJsonObject(options_json as string, "options_json"), { url, search: String(query || "").trim() || undefined }), timeout_ms as number);
        if (detailLevel === "max") return json(response);
        const links = Array.isArray(response.links) ? response.links : Array.isArray(response.data) ? response.data : [];
        return json(await compactCollectionPayload("as_web_extract", detailLevel, { action: selectedAction, url }, "links", links, compactSearchRecord));
      }
      if (selectedAction === "firecrawl_search") {
        const response = await firecrawlApiRequest(ctl, "/v2/search", "POST", mergeDefined(parseJsonObject(options_json as string, "options_json"), { query }), timeout_ms as number);
        if (detailLevel === "max") return json(response);
        const resultList = Array.isArray(response.data) ? response.data : Array.isArray(response.results) ? response.results : [];
        return json(await compactCollectionPayload("as_web_extract", detailLevel, { action: selectedAction, query, provider: "firecrawl" }, "results", resultList, compactSearchRecord));
      }
      if (selectedAction === "firecrawl_crawl") {
        const started = await firecrawlApiRequest(ctl, "/v2/crawl", "POST", mergeDefined(parseJsonObject(options_json as string, "options_json"), { url }), Math.min(wait_timeout_ms as number, 120000));
        const crawlId = String(started.id || started.jobId || (started.data as Record<string, unknown> | undefined)?.id || "");
        if (!crawlId) throw new Error("Firecrawl crawl did not return a job id.");
        const completed = await firecrawlPollUntilDone(ctl, `/v2/crawl/${crawlId}`, poll_interval_ms as number, wait_timeout_ms as number);
        const payload = mergeDefined(completed, { id: crawlId });
        if (detailLevel === "max") return json(payload);
        const reportPath = await maybeWriteToolOutputToFile(workspaceRoot, createReportPath("as_web_extract", selectedAction), payload);
        return json({ action: selectedAction, detail: detailLevel, id: crawlId, status: payload.status || null, reportPath, reportReadGuidance: REPORT_READ_GUIDANCE });
      }
      if (selectedAction === "firecrawl_agent") {
        const schema = String(schema_json || "").trim() ? parseJsonObject(schema_json as string, "schema_json") : undefined;
        const started = await firecrawlApiRequest(ctl, "/v2/agent", "POST", mergeDefined({ prompt, urls: [url], schema, maxCredits: 2500, model: "spark-1-mini" }), Math.min(wait_timeout_ms as number, 120000));
        const jobId = String(started.id || started.jobId || (started.data as Record<string, unknown> | undefined)?.id || "");
        if (!jobId) throw new Error("Firecrawl agent did not return a job id.");
        const completed = await firecrawlPollUntilDone(ctl, `/v2/agent/${jobId}`, poll_interval_ms as number, wait_timeout_ms as number);
        const payload = mergeDefined(completed, { id: jobId });
        if (detailLevel === "max") return json(payload);
        const reportPath = await maybeWriteToolOutputToFile(workspaceRoot, createReportPath("as_web_extract", selectedAction), payload);
        return json({ action: selectedAction, detail: detailLevel, id: jobId, status: payload.status || null, reportPath, reportReadGuidance: REPORT_READ_GUIDANCE });
      }
      if (selectedAction === "firecrawl_interact") {
        if (!String(prompt || "").trim() && !String(code || "").trim()) throw new Error("Provide prompt or code.");
        const scrapeResponse = await firecrawlApiRequest(ctl, "/v2/scrape", "POST", { url, formats: JSON.parse(formats_json as string) }, Math.min(timeout_ms as number, 120000));
        const scrapeData = (scrapeResponse.data as Record<string, unknown> | undefined) || {};
        const scrapeMeta = (scrapeData.metadata as Record<string, unknown> | undefined) || {};
        const scrapeId = String(scrapeResponse.id || scrapeResponse.scrapeId || scrapeData.id || scrapeData.scrapeId || scrapeMeta.scrapeId || scrapeMeta.scrape_id || "");
        if (!scrapeId) throw new Error("Firecrawl scrape did not return a scrapeId for interact.");
        const interactResponse = await firecrawlApiRequest(ctl, `/v2/scrape/${scrapeId}/interact`, "POST", mergeDefined({ prompt: String(prompt || "").trim() || undefined, code: String(code || "").trim() || undefined, language: "node", timeout: Math.ceil(Number(timeout_ms) / 1000) }), timeout_ms as number);
        const payload = { scrapeId, scrape: scrapeResponse, interact: interactResponse };
        if (detailLevel === "max") return json(payload);
        const reportPath = await maybeWriteToolOutputToFile(workspaceRoot, createReportPath("as_web_extract", selectedAction), payload);
        return json({ action: selectedAction, detail: detailLevel, scrapeId, reportPath, reportReadGuidance: REPORT_READ_GUIDANCE });
      }
      if (selectedAction === "browser_script") {
        requireCommandExecution();
        JSON.parse(input_json as string);
        const preferredBrowserBackend = getBrowserAutomationBackend();
        const outputDirectory = resolveInsideWorkspace(workspaceRoot, output_directory as string);
        const requestedOutputPath = String(output_path || "").trim();
        const resolvedOutputPath = requestedOutputPath ? resolveInsideWorkspace(workspaceRoot, requestedOutputPath) : "";
        await fsp.mkdir(outputDirectory, { recursive: true });
        const synthesizeBrowserScriptFromPrompt = (promptText: string) => {
          const lower = promptText.toLowerCase();
          if (/\blink(s)?\b/.test(lower)) {
            return [
              `const maxLinks = ${Math.min(Math.max(Number(limit) || 40, 1), 250)};`,
              "const links = Array.from(document.querySelectorAll('a[href]'))",
              "  .map((anchor) => ({ text: String(anchor.textContent || '').replace(/\\s+/g, ' ').trim(), url: anchor.href }))",
              "  .filter((entry) => entry.url)",
              "  .slice(0, maxLinks);",
              `return { prompt: ${JSON.stringify(promptText)}, title: document.title || '', url: location.href, linkCount: links.length, links };`,
            ].join("\n");
          }
          if (/\bimage(s)?\b/.test(lower)) {
            return [
              `const maxImages = ${Math.min(Math.max(Number(limit) || 40, 1), 250)};`,
              "const images = Array.from(document.querySelectorAll('img[src]'))",
              "  .map((image) => ({ alt: String(image.getAttribute('alt') || '').replace(/\\s+/g, ' ').trim(), src: image.src }))",
              "  .filter((entry) => entry.src)",
              "  .slice(0, maxImages);",
              `return { prompt: ${JSON.stringify(promptText)}, title: document.title || '', url: location.href, imageCount: images.length, images };`,
            ].join("\n");
          }
          if (/\bheading(s)?\b/.test(lower)) {
            return [
              "const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))",
              "  .map((heading) => ({ level: heading.tagName.toLowerCase(), text: String(heading.textContent || '').replace(/\\s+/g, ' ').trim() }))",
              "  .filter((entry) => entry.text);",
              `return { prompt: ${JSON.stringify(promptText)}, title: document.title || '', url: location.href, headings };`,
            ].join("\n");
          }
          if (/\btitle\b/.test(lower)) {
            return `return { prompt: ${JSON.stringify(promptText)}, title: document.title || '', url: location.href };`;
          }
          return `return { prompt: ${JSON.stringify(promptText)}, title: document.title || '', url: location.href, textPreview: document.body && document.body.innerText ? String(document.body.innerText).replace(/\\s+/g, ' ').trim().slice(0, 4000) : '' };`;
        };
        const suppliedScriptSource = String(script_js || code || "").trim();
        const promptScriptSource = String(prompt || "").trim() ? synthesizeBrowserScriptFromPrompt(String(prompt || "").trim()) : "";
        const effectiveScriptSource = suppliedScriptSource || promptScriptSource;
        if (!effectiveScriptSource) {
          throw new Error("browser_script requires script_js, code, or prompt.");
        }
        const script = [
          buildBrowserBackendPrelude(preferredBrowserBackend),
          'const fs = require("fs/promises");',
          'const path = require("path");',
          `const input = JSON.parse(${JSON.stringify(input_json as string)});`,
          `const outputDirectory = ${JSON.stringify(outputDirectory)};`,
          `const explicitOutputPath = ${JSON.stringify(resolvedOutputPath)};`,
          `const scriptSource = ${JSON.stringify(effectiveScriptSource)};`,
          `const targetUrl = decodeAgenticLiteral(${JSON.stringify(encodeInlineNodeLiteral(String(url)))});`,
          `const targetWaitUntil = ${JSON.stringify(wait_until)};`,
          `const targetTimeoutMs = ${Number(timeout_ms)};`,
          "const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;",
          "(async () => {",
          "  const browserType = await createAgenticBrowserType(preferredBrowserBackend, \"chromium\");",
          "  const browser = await browserType.launch({ headless: true });",
          "  try {",
          "    const context = await browser.newContext();",
          "    const page = await context.newPage();",
          "    await page.goto(targetUrl, { waitUntil: normalizeWaitUntil(targetWaitUntil), timeout: targetTimeoutMs });",
          "    const looksLikeNodeOrPlaywrightScript = /\\\\b(?:helpers|page|context|browser|chromium|firefox|webkit|require|fs|path|browserAgent)\\\\b/.test(scriptSource);",
          "    const playwrightAliases = await createAgenticPlaywrightAliases(preferredBrowserBackend);",
          "    const chromium = playwrightAliases.chromium;",
          "    const firefox = playwrightAliases.firefox;",
          "    const webkit = playwrightAliases.webkit;",
          "    const normalizeBrowserText = (value) => String(value || \"\").replace(/\\s+/g, \" \").trim();",
          "    const browserAgent = (() => {",
          "      const refSelector = (ref) => `[data-agentic-ref=\"${String(ref || \"\").replace(/\\\\/g, \"\\\\\\\\\").replace(/\"/g, '\\\\\"')}\"]`;",
          "      const describeElementRole = (tagName, role, type) => {",
          "        const normalizedRole = normalizeBrowserText(role).toLowerCase();",
          "        if (normalizedRole) return normalizedRole;",
          "        const normalizedTag = normalizeBrowserText(tagName).toLowerCase();",
          "        if (normalizedTag === \"a\") return \"link\";",
          "        if (normalizedTag === \"button\") return \"button\";",
          "        if (normalizedTag === \"select\") return \"combobox\";",
          "        if (normalizedTag === \"textarea\") return \"textbox\";",
          "        if (normalizedTag === \"summary\") return \"summary\";",
          "        if (normalizedTag === \"input\") {",
          "          const normalizedType = normalizeBrowserText(type).toLowerCase() || \"text\";",
          "          if ([\"button\", \"submit\", \"reset\"].includes(normalizedType)) return \"button\";",
          "          if ([\"checkbox\", \"radio\"].includes(normalizedType)) return normalizedType;",
          "          return normalizedType === \"search\" ? \"searchbox\" : \"textbox\";",
          "        }",
          "        return normalizedTag || \"element\";",
          "      };",
          "      const snapshotText = (elements) => elements.map((entry) => {",
          "        const label = entry.text || entry.ariaLabel || entry.placeholder || entry.href || entry.value || entry.ref;",
          "        return `[${entry.role} ${entry.ref}] ${label}`.trim();",
          "      }).join(\"\\n\");",
          "      const buildSnapshot = async (options = {}) => {",
          "        const limit = Math.min(Math.max(Number(options.limit) || 60, 1), 250);",
          "        const includeTextPreview = options.includeTextPreview !== false;",
          "        const includeHidden = options.includeHidden === true;",
          "        const raw = await page.evaluate(({ limit, includeTextPreview, includeHidden }) => {",
          "          const normalize = (value) => String(value || \"\").replace(/\\s+/g, \" \").trim();",
          "          for (const node of Array.from(document.querySelectorAll(\"[data-agentic-ref]\"))) node.removeAttribute(\"data-agentic-ref\");",
          "          const candidates = Array.from(document.querySelectorAll('a[href], button, input, textarea, select, summary, [role=\"button\"], [role=\"link\"], [role=\"textbox\"], [role=\"combobox\"], [contenteditable=\"true\"]'));",
          "          const elements = [];",
          "          const seen = new Set();",
          "          let index = 0;",
          "          for (const element of candidates) {",
          "            if (!(element instanceof HTMLElement)) continue;",
          "            const rect = element.getBoundingClientRect();",
          "            const style = window.getComputedStyle(element);",
          "            const visible = rect.width > 0 && rect.height > 0 && style.visibility !== \"hidden\" && style.display !== \"none\";",
          "            if (!includeHidden && !visible) continue;",
          "            const key = `${element.tagName}|${normalize(element.textContent || element.getAttribute(\"aria-label\") || element.getAttribute(\"placeholder\") || element.getAttribute(\"href\") || \"\")}|${Math.round(rect.x)}|${Math.round(rect.y)}`;",
          "            if (seen.has(key)) continue;",
          "            seen.add(key);",
          "            const ref = `e${++index}`;",
          "            element.setAttribute(\"data-agentic-ref\", ref);",
          "            elements.push({",
          "              ref,",
          "              tagName: element.tagName.toLowerCase(),",
          "              role: element.getAttribute(\"role\") || \"\",",
          "              type: element.getAttribute(\"type\") || \"\",",
          "              text: normalize(element.textContent || \"\"),",
          "              ariaLabel: normalize(element.getAttribute(\"aria-label\") || \"\"),",
          "              placeholder: normalize(element.getAttribute(\"placeholder\") || \"\"),",
          "              value: normalize((\"value\" in element ? element.value : \"\") || \"\"),",
          "              href: normalize(element.getAttribute(\"href\") || \"\"),",
          "              disabled: !!element.getAttribute(\"disabled\"),",
          "              bounds: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },",
          "            });",
          "            if (elements.length >= limit) break;",
          "          }",
          "          return {",
          "            url: location.href,",
          "            title: document.title || \"\",",
          "            textPreview: includeTextPreview ? normalize(document.body && document.body.innerText ? document.body.innerText : \"\").slice(0, 4000) : \"\",",
          "            elements,",
          "          };",
          "        }, { limit, includeTextPreview, includeHidden });",
          "        const elements = Array.isArray(raw && raw.elements) ? raw.elements.map((entry) => ({",
          "          ref: entry.ref,",
          "          role: describeElementRole(entry.tagName, entry.role, entry.type),",
          "          tagName: entry.tagName || null,",
          "          type: entry.type || null,",
          "          text: entry.text || null,",
          "          ariaLabel: entry.ariaLabel || null,",
          "          placeholder: entry.placeholder || null,",
          "          value: entry.value || null,",
          "          href: entry.href || null,",
          "          disabled: !!entry.disabled,",
          "          bounds: entry.bounds || null,",
          "        })) : [];",
          "        return {",
          "          url: String(raw && raw.url ? raw.url : await page.url()),",
          "          title: String(raw && raw.title ? raw.title : await page.title()),",
          "          textPreview: raw && raw.textPreview ? raw.textPreview : \"\",",
          "          elements,",
          "          snapshotText: snapshotText(elements),",
          "        };",
          "      };",
          "      const locatorForRef = (ref) => page.locator(refSelector(ref)).first();",
          "      const clickRef = async (ref, options = {}) => {",
          "        const locator = locatorForRef(ref);",
          "        await locator.click({",
          "          button: options.button || \"left\",",
          "          clickCount: Math.min(Math.max(Number(options.clickCount) || 1, 1), 3),",
          "          force: options.force === true,",
          "          timeout: Math.min(Math.max(Number(options.timeoutMs) || 15000, 1000), 120000),",
          "        });",
          "        if (Number(options.waitAfterMs) > 0) await page.waitForTimeout(Math.min(Math.max(Number(options.waitAfterMs), 1), 15000));",
          "        return { clickedRef: ref, url: page.url() };",
          "      };",
          "      const typeRef = async (ref, text, options = {}) => {",
          "        const locator = locatorForRef(ref);",
          "        const clear = options.clear !== false;",
          "        const tagName = await locator.evaluate((node) => node instanceof HTMLElement ? node.tagName.toLowerCase() : \"\").catch(() => \"\");",
          "        if (clear) {",
          "          if ([\"input\", \"textarea\"].includes(tagName)) await locator.fill(\"\");",
          "          else {",
          "            await locator.click({ timeout: Math.min(Math.max(Number(options.timeoutMs) || 15000, 1000), 120000) });",
          "            await page.keyboard.press(\"Control+A\").catch(() => {});",
          "            await page.keyboard.press(\"Meta+A\").catch(() => {});",
          "            await page.keyboard.press(\"Backspace\").catch(() => {});",
          "          }",
          "        }",
          "        if ([\"input\", \"textarea\"].includes(tagName)) await locator.fill(String(text || \"\"));",
          "        else await locator.type(String(text || \"\"), { delay: Number(options.delayMs) > 0 ? Math.min(Math.max(Number(options.delayMs), 1), 1000) : 0 });",
          "        if (options.pressEnter) await locator.press(\"Enter\").catch(async () => { await page.keyboard.press(\"Enter\"); });",
          "        if (Number(options.waitAfterMs) > 0) await page.waitForTimeout(Math.min(Math.max(Number(options.waitAfterMs), 1), 15000));",
          "        return { typedRef: ref, textLength: String(text || \"\").length, url: page.url() };",
          "      };",
          "      const navigate = async (nextUrl, options = {}) => {",
          "        await page.goto(String(nextUrl), {",
          "          waitUntil: normalizeWaitUntil(options.waitUntil || \"domcontentloaded\"),",
          "          timeout: Math.min(Math.max(Number(options.timeoutMs) || targetTimeoutMs, 1000), 180000),",
          "        });",
          "        if (Number(options.waitAfterMs) > 0) await page.waitForTimeout(Math.min(Math.max(Number(options.waitAfterMs), 1), 15000));",
          "        return { url: page.url(), title: await page.title() };",
          "      };",
          "      const scroll = async (direction = \"down\", amount = 700) => {",
          "        const delta = String(direction || \"down\").toLowerCase() === \"up\" ? -Math.abs(Number(amount) || 700) : Math.abs(Number(amount) || 700);",
          "        await page.evaluate((value) => { window.scrollBy(0, Number(value) || 0); }, delta);",
          "        return { url: page.url(), deltaY: delta };",
          "      };",
          "      const press = async (key, options = {}) => {",
          "        await page.keyboard.press(String(key || \"Enter\"));",
          "        if (Number(options.waitAfterMs) > 0) await page.waitForTimeout(Math.min(Math.max(Number(options.waitAfterMs), 1), 15000));",
          "        return { key: String(key || \"Enter\"), url: page.url() };",
          "      };",
          "      const waitForIdle = async (timeout = 10000) => {",
          "        try {",
          "          await page.waitForLoadState(\"networkidle\", { timeout: Math.min(Math.max(Number(timeout) || 10000, 1000), 120000) });",
          "        } catch {",
          "          // networkidle is best effort for busy pages.",
          "        }",
          "        return { url: page.url(), title: await page.title() };",
          "      };",
          "      return { snapshotPage: buildSnapshot, clickRef, typeRef, navigate, scroll, press, waitForIdle };",
          "    })();",
          "    let result;",
          "    if (!looksLikeNodeOrPlaywrightScript) {",
          "      result = await page.evaluate(async ({ input, scriptSource }) => {",
          "        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;",
          "        const userFn = new AsyncFunction(\"input\", \"document\", \"window\", \"location\", \"navigator\", \"localStorage\", \"sessionStorage\", \"history\", scriptSource);",
          "        return await userFn(input, document, window, location, navigator, localStorage, sessionStorage, history);",
          "      }, { input, scriptSource });",
          "    } else {",
          "      const helpers = { fs, path, outputDirectory, fetch, chromium, firefox, webkit, page, context, browser, browserEngine: browserType.engine, browserBackend: preferredBrowserBackend, browserAgent };",
          "      const userFn = new AsyncFunction(\"input\", \"helpers\", \"page\", \"context\", \"browser\", scriptSource);",
          "      result = await userFn(input, helpers, page, context, browser);",
          "    }",
          "    if (explicitOutputPath) {",
          "      await fs.mkdir(path.dirname(explicitOutputPath), { recursive: true });",
          "      const serializedResult = typeof result === \"string\" ? result : JSON.stringify(result, null, 2);",
          "      await fs.writeFile(explicitOutputPath, serializedResult, \"utf8\");",
          "    }",
          "    console.log(JSON.stringify({ success: true, mode: looksLikeNodeOrPlaywrightScript ? \"playwright_node\" : \"page_evaluate\", backend: preferredBrowserBackend, engine: browserType.engine, outputPath: explicitOutputPath || undefined, result }, null, 2));",
          "    await context.close();",
          "  } finally {",
          "    await browser.close();",
          "  }",
          "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });",
        ].join("\n");
        const result = await executeConfiguredBrowserNodeScript(script, Math.max(timeoutMs, timeout_ms as number), preferredBrowserBackend);
        if (result.exitCode !== 0 || result.error) {
          return buildCommandResponse("node web extract browser_script", result);
        }
        let parsedResult: Record<string, unknown>;
        try {
          parsedResult = JSON.parse(String(result.stdout || "{}"));
        } catch {
          return buildCommandResponse("node web extract browser_script", result);
        }
        const responseMeta = mergeDefined({
          action: selectedAction,
          detail: detailLevel,
          url,
          mode: parsedResult.mode,
          backend: parsedResult.backend,
          engine: parsedResult.engine,
          outputPath: parsedResult.outputPath ? path.relative(workspaceRoot, String(parsedResult.outputPath)) : undefined,
        });
        const browserResult = parsedResult.result;
        if (detailLevel === "max") {
          return json({ ...responseMeta, result: browserResult });
        }
        if (Array.isArray(browserResult)) {
          return json(await compactCollectionPayload("as_web_extract", detailLevel, responseMeta, "result", browserResult, compactSearchRecord));
        }
        if (typeof browserResult === "string") {
          return json(await compactTextPayload("as_web_extract", detailLevel, "result", browserResult, responseMeta));
        }
        if (browserResult && typeof browserResult === "object") {
          if (detailLevel === "full") {
            return json({ ...responseMeta, result: browserResult });
          }
          const preview = Object.fromEntries(Object.entries(browserResult as Record<string, unknown>).slice(0, 12));
          const serialized = JSON.stringify(browserResult, null, 2);
          const compactPayload: Record<string, unknown> = {
            ...responseMeta,
            resultPreview: preview,
            resultKeys: Object.keys(browserResult as Record<string, unknown>).slice(0, 30),
            resultLength: serialized.length,
          };
          if (serialized.length > TEXT_PREVIEW_CHARS) {
            compactPayload.resultReportPath = await maybeWriteToolOutputToFile(
              workspaceRoot,
              createReportPath("as_web_extract", "browser-script-result"),
              browserResult,
            );
            compactPayload.reportReadGuidance = REPORT_READ_GUIDANCE;
          }
          return json(compactPayload);
        }
        return json({ ...responseMeta, result: browserResult ?? null });
      }
      throw new Error(`Unsupported web extract action: ${selectedAction}`);
    }),
  }));

tools.push(tool({
    name: "as_multi_website_search",
    description: "Search targeted websites such as Internet Archive, Wikipedia, Reddit, Stack Overflow, Hacker News, YouTube, GitHub, npm, PyPI, arXiv, Anna's Archive, Libgen, MDN, Microsoft Learn, Slashdot, or scoped fallback domains for unsupported sites.",
    parameters: {
      website: z.enum(["archive", "internet_archive", "archive_org", "wikipedia", "reddit", "stackoverflow", "stackexchange", "wikihow", "youtube", "hackernews", "slashdot", "github", "npm", "pypi", "arxiv", "annas_archive", "libgen", "mdn", "msdn", "docs", "site", "custom", "web"]),
      query: z.string(),
      limit: z.number().int().min(1).max(100).default(10),
      language: z.string().regex(/^[a-z][a-z-]{1,11}$/i).default("en"),
      subreddit: z.string().default(""),
      sort: z.enum(["relevance", "new", "top", "comments"]).default("relevance"),
      time: z.enum(["hour", "day", "week", "month", "year", "all"]).default("week"),
      site: z.string().default(""),
      search_engine: z.enum(["auto", "searxng", "duckduckgo", "yahoo", "bing", "google", "firecrawl"]).default("auto"),
      detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
    },
    implementation: safeTool("as_multi_website_search", async ({ website, query, limit, language, subreddit, sort, time, site, search_engine, detail }) => {
      const detailLevel = normalizeDetailLevel(detail);
      const selectedWebsite = String(website);
      try {
        const specificSearch = await runSpecificWebsiteSearch(
          selectedWebsite,
          query as string,
          limit as number,
          language as string,
          subreddit as string,
          sort as string,
          time as string,
          site as string,
          search_engine as string,
        );
        if (specificSearch) {
          if (detailLevel === "max") return json({ query, website: selectedWebsite, ...specificSearch });
          return json(await compactCollectionPayload("as_multi_website_search", detailLevel, {
            query,
            website: selectedWebsite,
            provider: specificSearch.provider,
            apiUrl: specificSearch.apiUrl,
            searchUrl: specificSearch.searchUrl,
            note: specificSearch.note,
            language: specificSearch.language,
            subreddit: specificSearch.subreddit,
            stackExchangeSite: specificSearch.stackExchangeSite,
          }, "results", specificSearch.results, compactSearchRecord));
        }
      } catch (error) {
        const fallbackSiteMap: Record<string, string> = {
          archive: "archive.org",
          internet_archive: "archive.org",
          archive_org: "archive.org",
          github: "github.com",
          npm: "npmjs.com",
          arxiv: "site:arxiv.org/abs OR site:arxiv.org/pdf",
          mdn: "site:developer.mozilla.org/en-US/docs",
          msdn: "site:learn.microsoft.com/en-us",
          youtube: "youtube.com",
          slashdot: "slashdot.org",
          wikihow: "wikihow.com",
          annas_archive: "site:annas-archive.gl OR site:annas-archive.gd OR site:annas-archive.pk",
          libgen: "site:libgen.li OR site:libgen.la OR site:libgen.gl OR site:libgen.bz OR site:libgen.vg",
          pypi: "site:pypi.org/project",
        };
        const fallbackTargetSite = fallbackSiteMap[selectedWebsite];
        if (fallbackTargetSite) {
          const scopedQuery = buildScopedQuery(query as string, fallbackTargetSite);
          const fallback = await runSearchProvider(scopedQuery, limit as number, search_engine as string, { language });
          const resultList = Array.isArray(fallback.results) ? await addDownloadHintsToSearchResults(fallback.results, 5) : [];
          const unsupportedReason = specificWebsiteFallbackReason(selectedWebsite) || undefined;
          if (detailLevel === "max") {
            return json({
              query,
              website: selectedWebsite,
              provider: fallback.provider,
              mirror: fallback.mirror,
              scopedQuery,
              site: fallbackTargetSite,
              unsupportedReason,
              warning: `Site-specific search failed and fell back to a scoped web search: ${(error as Error).message}`,
              results: resultList,
            });
          }
          return json(await compactCollectionPayload("as_multi_website_search", detailLevel, {
            query,
            website: selectedWebsite,
            provider: fallback.provider,
            mirror: fallback.mirror,
            scopedQuery,
            site: fallbackTargetSite,
            unsupportedReason,
            warning: `Site-specific search failed and fell back to a scoped web search: ${(error as Error).message}`,
          }, "results", resultList, compactSearchRecord));
        }
        throw error;
      }
      const siteMap: Record<string, string> = {
        wikihow: "wikihow.com",
        pypi: "site:pypi.org/project",
        docs: String(site || "").trim(),
        site: String(site || "").trim(),
        custom: String(site || "").trim(),
        web: "",
      };
      const targetSite = siteMap[selectedWebsite] || String(site || "").trim();
      if ((selectedWebsite === "site" || selectedWebsite === "custom" || selectedWebsite === "docs") && !String(targetSite || "").trim()) {
        throw new Error("site is required when website is docs, site, or custom.");
      }
      const scopedQuery = buildScopedQuery(query as string, targetSite);
      const { provider, results, mirror } = await runSearchProvider(scopedQuery, limit as number, search_engine as string, { language });
      const resultList = Array.isArray(results) ? await addDownloadHintsToSearchResults(results, 5) : results;
      const unsupportedReason = specificWebsiteFallbackReason(selectedWebsite);
      if (detailLevel === "max") {
        return json({ query, website: selectedWebsite, provider, mirror, scopedQuery, site: targetSite || null, unsupportedReason: unsupportedReason || undefined, results: resultList });
      }
      return json(await compactCollectionPayload("as_multi_website_search", detailLevel, { query, website: selectedWebsite, provider, mirror, scopedQuery, site: targetSite || null, unsupportedReason: unsupportedReason || undefined }, "results", Array.isArray(resultList) ? resultList : [], compactSearchRecord));
    }),
  }));

tools.push(tool({
    name: "as_torrent_controller",
    description: "Control qBittorrent torrents and call Seerr-compatible request APIs for media request workflows.",
    parameters: {
      action: z.enum([
        "status", "list", "add", "remove", "pause", "resume", "recheck", "reannounce", "files", "properties", "trackers",
        "set_options", "search_start", "search_status", "search_results", "search_delete", "search_plugins",
        "seerr_status", "seerr_search", "seerr_requests", "seerr_request", "seerr_raw",
      ]).default("status"),
      qbittorrent_url: z.string().default(""),
      qbittorrent_username: z.string().default(""),
      qbittorrent_password: z.string().default(""),
      source: z.string().default(""),
      torrent_file: z.string().default(""),
      save_path: z.string().default(""),
      category: z.string().default(""),
      tags: z.string().default(""),
      hashes: z.string().default(""),
      delete_files: z.boolean().default(false),
      paused: z.boolean().default(false),
      sequential_download: z.boolean().default(false),
      first_last_piece_priority: z.boolean().default(false),
      filter: z.string().default(""),
      sort: z.string().default(""),
      reverse: z.boolean().default(false),
      limit: z.number().int().min(1).max(10000).default(100),
      offset: z.number().int().min(0).default(0),
      options_json: z.string().default("{}"),
      search_query: z.string().default(""),
      search_plugins: z.string().default("enabled"),
      search_category: z.string().default("all"),
      search_id: z.number().int().min(0).default(0),
      seerr_url: z.string().default(""),
      seerr_api_key: z.string().default(""),
      seerr_endpoint: z.string().default(""),
      seerr_method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
      media_type: z.enum(["movie", "tv"]).default("movie"),
      media_id: z.number().int().min(0).default(0),
      detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
      timeout_ms: z.number().int().min(1000).max(3600000).default(120000),
    },
    implementation: safeTool("as_torrent_controller", async ({
      action,
      qbittorrent_url,
      qbittorrent_username,
      qbittorrent_password,
      source,
      torrent_file,
      save_path,
      category,
      tags,
      hashes,
      delete_files,
      paused,
      sequential_download,
      first_last_piece_priority,
      filter,
      sort,
      reverse,
      limit,
      offset,
      options_json,
      search_query,
      search_plugins,
      search_category,
      search_id,
      seerr_url,
      seerr_api_key,
      seerr_endpoint,
      seerr_method,
      media_type,
      media_id,
      detail,
      timeout_ms,
    }) => {
      const selectedAction = String(action);
      const detailLevel = normalizeDetailLevel(detail);
      const opts = parseJsonObject(options_json as string, "options_json");
      const hasSearchId = search_id !== undefined && search_id !== null && String(search_id).trim() !== "" && Number.isFinite(Number(search_id));
      const compactJsonPayload = async (backend: string, payload: unknown) => {
        if (detailLevel === "max") return json(payload);
        if (Array.isArray(payload)) {
          return json(await compactCollectionPayload("as_torrent_controller", detailLevel, { action: selectedAction, backend }, "results", payload, compactTorrentRecord));
        }
        if (payload && typeof payload === "object") {
          const objectPayload = payload as Record<string, unknown>;
          if (Array.isArray(objectPayload.files)) {
            const files = (objectPayload.files as Array<Record<string, unknown>>).map((entry) => compactTorrentFileRecord(entry));
            if (detailLevel === "compact") {
              return json({
                detail: detailLevel,
                fileCount: files.length,
                files: files.slice(0, 10),
              });
            }
            return json({
              action: selectedAction,
              backend,
              detail: detailLevel,
              fileCount: files.length,
              files: files.slice(0, 50),
              truncated: files.length > 50,
              note: files.length > 50 ? "Call again with detail=max to retrieve the full file list." : undefined,
            });
          }
          for (const key of ["results", "torrents", "files", "trackers", "plugins", "status", "search"]) {
            if (Array.isArray(objectPayload[key])) {
              return json(await compactCollectionPayload("as_torrent_controller", detailLevel, { action: selectedAction, backend }, key, objectPayload[key] as unknown[], compactTorrentRecord));
            }
          }
          if (detailLevel === "full") return json(objectPayload);
          const reportPath = await maybeWriteToolOutputToFile(workspaceRoot, createReportPath("as_torrent_controller", selectedAction), objectPayload);
          return json({ action: selectedAction, backend, detail: detailLevel, reportPath, reportReadGuidance: REPORT_READ_GUIDANCE, keys: Object.keys(objectPayload).slice(0, 20) });
        }
        return json(payload);
      };

      if (selectedAction.startsWith("seerr_")) {
        const baseUrl = seerrBaseUrl(seerr_url as string);
        const apiKey = seerrToken(seerr_api_key as string);
        if (selectedAction === "seerr_status") {
          return await compactJsonPayload("seerr", await seerrApiRequest(baseUrl, apiKey, "/api/v1/status", "GET", null, timeout_ms as number));
        }
        if (selectedAction === "seerr_search") {
          if (!String(search_query || "").trim()) throw new Error("search_query is required for seerr_search.");
          return await compactJsonPayload("seerr", await seerrApiRequest(baseUrl, apiKey, `/api/v1/search?query=${encodeURIComponent(search_query as string)}`, "GET", null, timeout_ms as number));
        }
        if (selectedAction === "seerr_requests") {
          return await compactJsonPayload("seerr", await seerrApiRequest(baseUrl, apiKey, `/api/v1/request?take=${Number(limit)}&skip=${Number(offset)}`, "GET", null, timeout_ms as number));
        }
        if (selectedAction === "seerr_request") {
          if (!Number(media_id)) throw new Error("media_id is required for seerr_request.");
          return await compactJsonPayload("seerr", await seerrApiRequest(baseUrl, apiKey, "/api/v1/request", "POST", mergeDefined(opts, {
            mediaId: Number(media_id),
            mediaType: media_type,
          }), timeout_ms as number));
        }
        if (selectedAction === "seerr_raw") {
          if (!String(seerr_endpoint || "").trim()) throw new Error("seerr_endpoint is required for seerr_raw.");
          return await compactJsonPayload("seerr", await seerrApiRequest(baseUrl, apiKey, seerr_endpoint as string, seerr_method as string, opts, timeout_ms as number));
        }
      }

      const baseUrl = qbtBaseUrl(qbittorrent_url as string);
      const username = qbtUsername(qbittorrent_username as string);
      const password = qbtPassword(qbittorrent_password as string);

      if (selectedAction === "add") {
        const authContext = await resolveQbtAuthContext(baseUrl, username, password);
        const cookie = String(authContext.cookie || "");
        const form = new FormData();
        if (String(torrent_file || "").trim()) {
          const torrentPath = resolveInsideWorkspace(workspaceRoot, torrent_file as string);
          const bytes = await fsp.readFile(torrentPath);
          form.append("torrents", new Blob([bytes], { type: "application/x-bittorrent" }), path.basename(torrentPath));
        } else if (String(source || "").trim()) {
          form.append("urls", String(source));
        } else {
          throw new Error("Provide source as a magnet/URL or torrent_file as a workspace path.");
        }
        if (String(save_path || "").trim()) form.append("savepath", String(save_path));
        if (String(category || "").trim()) form.append("category", String(category));
        if (String(tags || "").trim()) form.append("tags", String(tags));
        form.append("paused", String(Boolean(paused)));
        form.append("sequentialDownload", String(Boolean(sequential_download)));
        form.append("firstLastPiecePrio", String(Boolean(first_last_piece_priority)));
        for (const [key, value] of Object.entries(opts)) {
          if (value !== undefined && value !== null) form.append(key, String(value));
        }
        const added = await qbtApiRequest(baseUrl, cookie, "/torrents/add", form);
        return json(mergeDefined({ success: true, backend: "qbittorrent", action: selectedAction, authMode: authContext.authMode, warning: authContext.warning, response: added }));
      }

      const { client: qbt, authContext } = await connectOrBypassQbt(baseUrl, username, password);
      const selectedHashes = String(hashes || "").trim();
      if (["remove", "pause", "resume", "recheck", "reannounce", "files", "properties", "trackers", "set_options"].includes(selectedAction) && !selectedHashes) {
        throw new Error("hashes is required for this qBittorrent action.");
      }

      if (selectedAction === "status") {
        const [appVersion, apiVersion, transferInfo, defaultSavePath] = await Promise.all([
          qbt.appVersion(),
          qbt.apiVersion(),
          qbt.transferInfo(),
          qbt.defaultSavePath().catch(() => ""),
        ]);
        return await compactJsonPayload("qbittorrent", mergeDefined({ backend: "qbittorrent", baseUrl, authMode: authContext.authMode, warning: authContext.warning, appVersion, apiVersion, transferInfo, defaultSavePath }));
      }
      if (selectedAction === "list") {
        return await compactJsonPayload("qbittorrent", mergeDefined({ backend: "qbittorrent", authMode: authContext.authMode, warning: authContext.warning, torrents: await qbt.torrents(filter || undefined, category || undefined, sort || undefined, reverse as boolean, limit as number, offset as number, selectedHashes || undefined) }));
      }
      if (selectedAction === "remove") {
        await qbt.deleteTorrents(selectedHashes, delete_files as boolean);
        return json(mergeDefined({ success: true, backend: "qbittorrent", action: selectedAction, authMode: authContext.authMode, warning: authContext.warning, hashes: selectedHashes, deleteFiles: delete_files }));
      }
      if (selectedAction === "pause") {
        await qbt.pauseTorrents(selectedHashes);
        return json(mergeDefined({ success: true, backend: "qbittorrent", action: selectedAction, authMode: authContext.authMode, warning: authContext.warning, hashes: selectedHashes }));
      }
      if (selectedAction === "resume") {
        await qbt.resumeTorrents(selectedHashes);
        return json(mergeDefined({ success: true, backend: "qbittorrent", action: selectedAction, authMode: authContext.authMode, warning: authContext.warning, hashes: selectedHashes }));
      }
      if (selectedAction === "recheck") {
        await qbt.recheckTorrents(selectedHashes);
        return json(mergeDefined({ success: true, backend: "qbittorrent", action: selectedAction, authMode: authContext.authMode, warning: authContext.warning, hashes: selectedHashes }));
      }
      if (selectedAction === "reannounce") {
        await qbt.reannounceTorrents(selectedHashes);
        return json(mergeDefined({ success: true, backend: "qbittorrent", action: selectedAction, authMode: authContext.authMode, warning: authContext.warning, hashes: selectedHashes }));
      }
      if (selectedAction === "files") return await compactJsonPayload("qbittorrent", mergeDefined({ backend: "qbittorrent", authMode: authContext.authMode, warning: authContext.warning, hashes: selectedHashes, files: await qbt.files(selectedHashes) }));
      if (selectedAction === "properties") return await compactJsonPayload("qbittorrent", mergeDefined({ backend: "qbittorrent", authMode: authContext.authMode, warning: authContext.warning, hashes: selectedHashes, properties: await qbt.properties(selectedHashes) }));
      if (selectedAction === "trackers") return await compactJsonPayload("qbittorrent", mergeDefined({ backend: "qbittorrent", authMode: authContext.authMode, warning: authContext.warning, hashes: selectedHashes, trackers: await qbt.trackers(selectedHashes) }));
      if (selectedAction === "set_options") {
        const applied: string[] = [];
        if (String(save_path || opts.save_path || "").trim()) {
          await qbt.setLocation(selectedHashes, String(save_path || opts.save_path));
          applied.push("location");
        }
        if (String(category || opts.category || "").trim()) {
          await qbt.setCategory(selectedHashes, String(category || opts.category));
          applied.push("category");
        }
        if (typeof opts.download_limit === "number") {
          await qbt.setDownloadLimit(selectedHashes, Number(opts.download_limit));
          applied.push("download_limit");
        }
        if (typeof opts.upload_limit === "number") {
          await qbt.setUploadLimit(selectedHashes, Number(opts.upload_limit));
          applied.push("upload_limit");
        }
        if (typeof opts.ratio_limit === "number" || typeof opts.seeding_time_limit === "number") {
          await qbt.setShareLimit(selectedHashes, typeof opts.ratio_limit === "number" ? Number(opts.ratio_limit) : -2, typeof opts.seeding_time_limit === "number" ? Number(opts.seeding_time_limit) : -2);
          applied.push("share_limit");
        }
        if (typeof opts.force_start === "boolean") {
          await qbt.setForceStart(selectedHashes, Boolean(opts.force_start));
          applied.push("force_start");
        }
        if (typeof opts.super_seeding === "boolean") {
          await qbt.setSuperSeeding(selectedHashes, Boolean(opts.super_seeding));
          applied.push("super_seeding");
        }
        if (sequential_download) {
          await qbt.toggleSequentialDownload(selectedHashes);
          applied.push("toggle_sequential_download");
        }
        if (first_last_piece_priority) {
          await qbt.toggleFirstLastPiecePrio(selectedHashes);
          applied.push("toggle_first_last_piece_priority");
        }
        return json(mergeDefined({ success: true, backend: "qbittorrent", action: selectedAction, authMode: authContext.authMode, warning: authContext.warning, hashes: selectedHashes, applied }));
      }
      if (selectedAction === "search_plugins") return await compactJsonPayload("qbittorrent", mergeDefined({ backend: "qbittorrent", authMode: authContext.authMode, warning: authContext.warning, plugins: await qbt.searchPlugins() }));
      if (selectedAction === "search_start") {
        if (!String(search_query || "").trim()) throw new Error("search_query is required for search_start.");
        const search = await qbt.startSearch(search_query as string, search_plugins as string, search_category as string);
        const startedSearchId = Number((search as Record<string, unknown>)?.id);
        if (Number.isFinite(startedSearchId) && String(authContext.cookie || "").trim()) {
          await persistQbtSearchSession(baseUrl, startedSearchId, String(authContext.cookie || ""));
        }
        return await compactJsonPayload("qbittorrent", mergeDefined({ backend: "qbittorrent", authMode: authContext.authMode, warning: authContext.warning, search }));
      }
      if (selectedAction === "search_status") {
        const sessionCookie = await loadQbtSearchSessionCookie(baseUrl, hasSearchId ? Number(search_id) : undefined);
        const sessionClient = sessionCookie
          ? await createQbtHttpClient(baseUrl, mergeDefined(authContext, { cookie: sessionCookie }))
          : qbt;
        return await compactJsonPayload("qbittorrent", mergeDefined({ backend: "qbittorrent", authMode: authContext.authMode, warning: authContext.warning, status: await sessionClient.searchStatus(hasSearchId ? Number(search_id) : undefined) }));
      }
      if (selectedAction === "search_results") {
        if (!hasSearchId) throw new Error("search_id is required for search_results.");
        const sessionCookie = await loadQbtSearchSessionCookie(baseUrl, Number(search_id));
        const sessionClient = sessionCookie
          ? await createQbtHttpClient(baseUrl, mergeDefined(authContext, { cookie: sessionCookie }))
          : qbt;
        return await compactJsonPayload("qbittorrent", mergeDefined({ backend: "qbittorrent", authMode: authContext.authMode, warning: authContext.warning, results: await sessionClient.searchResults(Number(search_id), Number(limit), Number(offset)) }));
      }
      if (selectedAction === "search_delete") {
        if (!hasSearchId) throw new Error("search_id is required for search_delete.");
        const sessionCookie = await loadQbtSearchSessionCookie(baseUrl, Number(search_id));
        const sessionClient = sessionCookie
          ? await createQbtHttpClient(baseUrl, mergeDefined(authContext, { cookie: sessionCookie }))
          : qbt;
        await sessionClient.deleteSearch(Number(search_id));
        await clearQbtSearchSession(baseUrl, Number(search_id));
        return json(mergeDefined({ success: true, backend: "qbittorrent", action: selectedAction, authMode: authContext.authMode, warning: authContext.warning, searchId: Number(search_id) }));
      }
      throw new Error(`Unsupported torrent controller action: ${selectedAction}`);
    }),
  }));

tools.push(tool({
    name: "as_deno_run_script",
    description: "Run an inline Deno script or one or more Deno/TypeScript files with network, file, and environment permissions.",
    parameters: {
      script_ts: z.string().default(""),
      script_path: z.string().default(""),
      ...batchFileSelectionParameters(z),
      working_directory: z.string().default("."),
      timeout_ms: z.number().int().min(1000).max(3600000).default(300000),
    },
    implementation: safeTool("as_deno_run_script", async (params) => {
      requireCommandExecution();
      const { script_ts, script_path, working_directory, timeout_ms } = params;
      const denoExecutable = await getDenoExecutablePath(ctl);
      const cwd = resolveInsideWorkspace(workspaceRoot, working_directory as string);
      const hasFileTargets = String(script_path || "").trim()
        || (Array.isArray(params.file_list) && params.file_list.length > 0)
        || (Array.isArray(params.folder_list) && params.folder_list.length > 0);
      const runScriptFile = async (scriptFilePath: string, label: string) => {
        const allowRead = `${cwd},${scriptFilePath}`;
        const command = `${quote(denoExecutable)} run --allow-net --allow-read=${quote(allowRead)} --allow-write=${quote(cwd)} --allow-env ${quote(scriptFilePath)}`;
        const result = await executeManagedCommand(ctl, command, { cwd, shell, env }, Math.max(timeoutMs, timeout_ms as number), maxOutputBytes);
        return {
          script: label,
          ...buildCommandResponsePayload(command, result),
        };
      };
      if (hasFileTargets) {
        const targets = await resolveBatchFileTargets({
          workspaceRoot,
          resolvePath: resolveInsideWorkspace,
          primaryPath: script_path,
          primaryPathName: "script_path",
          fileList: params.file_list,
          folderList: params.folder_list,
          filePattern: params.file_pattern,
          filePatternFlags: params.file_pattern_flags,
          folderRecursive: params.folder_recursive,
          includeHidden: params.include_hidden,
          fileLimit: params.file_limit,
          requireFiles: true,
        });
        const results = [];
        for (const target of targets) {
          results.push(await runScriptFile(target.fullPath, target.relativePath));
        }
        return json(results.length === 1 ? results[0] : { count: results.length, results });
      }
      if (!String(script_ts || "").trim()) {
        throw new Error("Provide script_ts or script_path/file_list/folder_list.");
      }
      const runnerDir = await fsp.mkdtemp(path.join(os.tmpdir(), "mc-deno-"));
      try {
        const tempScriptPath = path.join(runnerDir, "runner.ts");
        await fsp.writeFile(tempScriptPath, script_ts as string, "utf8");
        return json(await runScriptFile(tempScriptPath, "inline_script"));
      } finally {
        await fsp.rm(runnerDir, { recursive: true, force: true });
      }
    }),
  }));

tools.push(tool({
    name: "as_web_search",
    description: "Search the web using Firecrawl, SearxNG mirrors from searx.space, or open HTML fallbacks such as Yahoo, Bing, DuckDuckGo, and Google.",
    parameters: {
      query: z.string().default(""),
      search_engine: z.enum(["auto", "searxng", "duckduckgo", "yahoo", "bing", "google", "firecrawl"]).default("auto"),
      site: z.string().default(""),
      limit: z.number().int().min(1).max(50).default(10),
      searxng_list_mirrors: z.boolean().default(false),
      searxng_mirror_index: z.number().int().min(0).default(0),
      searxng_mirror_max: z.number().int().min(1).max(25).default(DEFAULT_SEARCH_PAGE_SIZE),
      searxng_mirror_url: z.string().default(""),
      detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
    },
    implementation: safeTool("as_web_search", async ({ query, search_engine, site, limit, searxng_list_mirrors, searxng_mirror_index, searxng_mirror_max, searxng_mirror_url, detail }) => {
      const detailLevel = normalizeDetailLevel(detail);
      if (searxng_list_mirrors) {
        const mirrorList = await listSearxMirrors(searxng_mirror_index as number, searxng_mirror_max as number);
        return json(mirrorList);
      }
      if (!String(query || "").trim()) {
        throw new Error("query is required unless searxng_list_mirrors=true.");
      }
      const scopedQuery = buildScopedQuery(query as string, site as string);
      const searchResult = await runSearchProvider(scopedQuery, limit as number, search_engine as string, {
        language: "all",
        searxng_mirror_index,
        searxng_mirror_max,
        searxng_mirror_url,
      });
      if (detailLevel === "max") {
        return json({
          query,
          scopedQuery: scopedQuery !== query ? scopedQuery : undefined,
          site: String(site || "").trim() || undefined,
          provider: searchResult.provider,
          mirror: searchResult.mirror,
          warning: searchResult.warning,
          results: searchResult.results,
        });
      }
      return json(await compactCollectionPayload("as_web_search", detailLevel, {
        query,
        scopedQuery: scopedQuery !== query ? scopedQuery : undefined,
        site: String(site || "").trim() || undefined,
        provider: searchResult.provider,
        mirror: searchResult.mirror,
        warning: searchResult.warning,
      }, "results", Array.isArray(searchResult.results) ? searchResult.results : [], compactSearchRecord));
    }),
  }));

tools.push(tool({
    name: "as_web_image_search",
    description: "Search for image results using a local web fallback.",
    parameters: {
      query: z.string(),
      limit: z.number().int().min(1).max(50).default(12),
      detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
    },
    implementation: safeTool("as_web_image_search", async ({ query, limit, detail }) => {
      const detailLevel = normalizeDetailLevel(detail);
      const results = await fallbackImageSearch(query as string, limit as number);
      if (detailLevel === "max") return json({ query, provider: "bing_images_html", results });
      return json(await compactCollectionPayload("as_web_image_search", detailLevel, { query, provider: "bing_images_html" }, "results", results, compactSearchRecord));
    }),
  }));

}
