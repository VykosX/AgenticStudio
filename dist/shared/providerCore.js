"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolsProvider = toolsProvider;
const sdk_1 = require("@lmstudio/sdk");
const fs_1 = require("fs");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const zod_1 = require("zod");
const yaml_1 = __importDefault(require("yaml"));
const config_1 = require("../config");
const downloadVideo_1 = require("../tools/downloadVideo");
const mathAndUnits_1 = require("../tools/mathAndUnits");
const systemInfo_1 = require("../tools/systemInfo");
const consolidated_1 = require("../tools/consolidated");
const files_1 = require("../tools/files");
const development_1 = require("../tools/development");
const web_1 = require("../tools/web");
const dataMedia_1 = require("../tools/dataMedia");
const desktopAutomation_1 = require("../tools/desktopAutomation");
const stateful_1 = require("../tools/stateful");
const meta_1 = require("../tools/meta");
const providerUtils_1 = require("./providerUtils");
const providerState_1 = require("./providerState");
const providerFilesystem_1 = require("./providerFilesystem");
const providerCommands_1 = require("./providerCommands");
const providerCatalog_1 = require("./providerCatalog");
let allowFullFilesystemAccessMode = false;
function resolveInsideWorkspace(root, requestedPath) {
    let expandedPath = (0, providerUtils_1.expandEnvironmentPath)(String(requestedPath || ""));
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
function getZstdCompressionLevel(ctl) {
    return ctl.getPluginConfig(config_1.configSchematics).get("zstdCompressionLevel") ?? 10;
}
async function commandAvailable(command, cwd, shell, env, timeoutMs, maxOutputBytes) {
    const checkCommand = process.platform === "win32" ? `where ${command}` : `command -v ${command}`;
    const result = await (0, providerCommands_1.runCommand)(checkCommand, { cwd, shell, env }, timeoutMs, maxOutputBytes);
    return !result.error && result.exitCode === 0;
}
async function pythonModuleAvailable(moduleName, cwd, pythonExecutable, shell, env, timeoutMs, maxOutputBytes) {
    const result = await (0, providerCommands_1.runCommand)(`${(0, providerUtils_1.quote)(pythonExecutable)} -m ${moduleName} --version`, { cwd, shell, env }, timeoutMs, maxOutputBytes);
    return !result.error && result.exitCode === 0;
}
function getVswherePath(ctl) {
    return (0, providerCommands_1.getConfiguredExecutable)(ctl, "vswherePath") || "C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe";
}
async function resolveWindowsVcVarsPath(ctl, cwd, shell, env, timeoutMs, maxOutputBytes) {
    if (process.platform !== "win32")
        return null;
    const configured = (0, providerCommands_1.getConfiguredExecutable)(ctl, "msvcVcVarsPath");
    if (configured && await (0, providerFilesystem_1.fileExists)(configured)) {
        return configured;
    }
    const vswherePath = getVswherePath(ctl);
    if (!(await (0, providerFilesystem_1.fileExists)(vswherePath))) {
        return null;
    }
    const query = `${(0, providerUtils_1.quote)(vswherePath)} -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -find VC\\Auxiliary\\Build\\vcvars64.bat`;
    const result = await (0, providerCommands_1.runCommand)(query, { cwd, shell, env }, timeoutMs, maxOutputBytes);
    const discovered = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
    return discovered && await (0, providerFilesystem_1.fileExists)(discovered) ? discovered : null;
}
async function resolveCompilerCandidates(ctl, cwd, shell, env, timeoutMs, maxOutputBytes, compilerPreference) {
    const preference = String(compilerPreference || "auto");
    const names = (() => {
        if (process.platform === "win32") {
            if (preference === "msvc")
                return ["cl", "clang++", "g++"];
            if (preference === "gcc")
                return ["g++", "clang++", "cl"];
            return ["clang++", "g++", "cl"];
        }
        if (preference === "gcc")
            return ["g++", "clang++"];
        return ["clang++", "g++"];
    })();
    const resolved = [];
    for (const name of names) {
        if (name === "cl") {
            if (await commandAvailable("cl", cwd, shell, env, timeoutMs, maxOutputBytes)) {
                resolved.push({ name: "cl", command: "cl", versionCommand: "cl", detectedBy: "path" });
                continue;
            }
            const vcVarsPath = await resolveWindowsVcVarsPath(ctl, cwd, shell, env, timeoutMs, maxOutputBytes);
            if (vcVarsPath) {
                const vcCommandPrefix = `call ${(0, providerUtils_1.quote)(vcVarsPath)} >nul &&`;
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
            resolved.push({ name: name, command: name, versionCommand: `${name} --version`, detectedBy: "path" });
        }
    }
    return resolved;
}
function dynamicToolsDirectory(_root) {
    return path.join((0, providerState_1.pluginDataDirectory)(), "tools");
}
function workspaceTrashDirectory(_root) {
    return path.join((0, providerState_1.pluginDataDirectory)(), "trash");
}
function operationsLogPath(_root) {
    return path.join((0, providerState_1.pluginDataDirectory)(), "operations", "operations.log");
}
function reorgPlansDirectory(_root) {
    return path.join((0, providerState_1.pluginDataDirectory)(), "plans");
}
function fileWatchersDirectory(_root) {
    return path.join((0, providerState_1.pluginDataDirectory)(), "watchers");
}
function skillsDirectory(_root) {
    return path.join((0, providerState_1.pluginDataDirectory)(), "default", "skills");
}
function screenshotsDirectory(_root) {
    return path.join((0, providerState_1.pluginDataDirectory)(), "screenshots");
}
function escapeForPowerShellSingleQuoted(value) {
    return `'${value.replace(/'/g, "''")}'`;
}
function summarizeByPlugin(docs) {
    const grouped = new Map();
    for (const doc of docs) {
        const key = doc.plugin;
        let bucket = grouped.get(key);
        if (!bucket) {
            bucket = {
                plugin: doc.plugin,
                pluginLabel: doc.pluginLabel || doc.plugin,
                liveCount: 0,
                categories: new Map(),
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
function getNormalizedLmStudioEndpoint(ctl) {
    const raw = ctl.getPluginConfig(config_1.configSchematics).get("lmStudioEndpoint")?.trim() || "http://localhost:1234/v1";
    const normalized = raw.replace(/\/+$/, "");
    return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
}
function getSubAgentPermissionLevel(ctl) {
    const value = ctl.getPluginConfig(config_1.configSchematics).get("subAgentPermissions") || "standard";
    return value === "read_only" || value === "full" ? value : "standard";
}
function getSubAgentProfiles(ctl) {
    const raw = ctl.getPluginConfig(config_1.configSchematics).get("subAgentProfiles")?.trim() || "";
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    }
    catch {
        return {};
    }
}
async function listLoadedModelsForSubAgent(endpoint) {
    try {
        const response = await fetch(`${endpoint}/models`, { signal: AbortSignal.timeout(5000) });
        if (!response.ok)
            return [];
        const data = await response.json();
        return (data.data || []).map((entry) => entry.id || "").filter(Boolean);
    }
    catch {
        return [];
    }
}
async function resolveSubAgentModel(endpoint, preferredModelId) {
    const loaded = await listLoadedModelsForSubAgent(endpoint);
    if (preferredModelId && loaded.includes(preferredModelId))
        return preferredModelId;
    if (loaded.length >= 2)
        return loaded[1];
    if (loaded.length >= 1)
        return loaded[0];
    return preferredModelId || "local-model";
}
function buildSubAgentToolDefinitions(permission) {
    const definitions = [
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
        definitions.push({
            name: "write_file",
            description: "Write content to a file in the workspace.",
            parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
        }, {
            name: "replace_text_in_file",
            description: "Replace unique text in a file.",
            parameters: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] },
        }, {
            name: "make_directory",
            description: "Create a directory.",
            parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
        }, {
            name: "copy_path",
            description: "Copy a file or directory.",
            parameters: { type: "object", properties: { source: { type: "string" }, destination: { type: "string" }, overwrite: { type: "boolean" } }, required: ["source", "destination"] },
        }, {
            name: "move_path",
            description: "Move or rename a file or directory.",
            parameters: { type: "object", properties: { source: { type: "string" }, destination: { type: "string" }, overwrite: { type: "boolean" } }, required: ["source", "destination"] },
        }, {
            name: "delete_path",
            description: "Delete or trash a file or directory.",
            parameters: { type: "object", properties: { path: { type: "string" }, recursive: { type: "boolean" }, confirmed: { type: "boolean" } }, required: ["path"] },
        });
    }
    if (permission === "full") {
        definitions.push({
            name: "run_command",
            description: "Run a shell command inside the workspace.",
            parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
        }, {
            name: "run_python_code",
            description: "Execute Python code.",
            parameters: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
        });
    }
    return definitions;
}
async function fetchWebReadableText(url, maxChars) {
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
function stripHtmlToText(html) {
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
function absolutizeUrl(candidate, baseUrl) {
    try {
        return new URL(candidate, baseUrl).toString();
    }
    catch {
        return null;
    }
}
async function fallbackWebSearch(query, limit) {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(30000),
    });
    const html = await response.text();
    const matches = [...html.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    const results = [];
    for (const match of matches) {
        const href = (match[1] || "").replace(/&amp;/g, "&");
        const title = stripHtmlToText(match[2] || "");
        if (!href || !title)
            continue;
        let finalUrl = href;
        try {
            const parsed = new URL(href, "https://duckduckgo.com");
            const uddg = parsed.searchParams.get("uddg");
            if (uddg)
                finalUrl = decodeURIComponent(uddg);
        }
        catch {
            // keep href as-is
        }
        results.push({ title, url: finalUrl });
        if (results.length >= limit)
            break;
    }
    return results;
}
async function fallbackImageSearch(query, limit) {
    const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC3`;
    const response = await fetch(bingUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(30000),
    });
    const html = await response.text();
    const matches = [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi)];
    const results = [];
    const imageCards = [...html.matchAll(/<a[^>]+class="[^"]*\biusc\b[^"]*"[^>]+m="([^"]+)"[^>]*>/gi)];
    for (const match of imageCards) {
        const rawMetadata = (match[1] || "")
            .replace(/&quot;/gi, "\"")
            .replace(/&#34;/gi, "\"")
            .replace(/&amp;/gi, "&");
        try {
            const metadata = JSON.parse(rawMetadata);
            const imageUrl = absolutizeUrl(metadata.murl || "", bingUrl);
            if (!imageUrl)
                continue;
            results.push({
                title: stripHtmlToText(metadata.t || metadata.desc || ""),
                imageUrl,
                thumbnailUrl: absolutizeUrl(metadata.turl || "", bingUrl),
                sourceUrl: absolutizeUrl(metadata.purl || "", bingUrl),
            });
            if (results.length >= limit)
                return results;
        }
        catch {
            // Fall back to img parsing below.
        }
    }
    for (const match of matches) {
        const src = absolutizeUrl(match[1] || "", bingUrl);
        if (!src || src.includes("bing.com") || src.includes("mm.bing.net"))
            continue;
        results.push({ imageUrl: src, alt: match[2] || "" });
        if (results.length >= limit)
            break;
    }
    return results;
}
async function extractPageImages(url, limit) {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30000) });
    const html = await response.text();
    const matches = [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi)];
    const results = [];
    for (const match of matches) {
        const imageUrl = absolutizeUrl(match[1] || "", response.url || url);
        if (!imageUrl)
            continue;
        results.push({ imageUrl, alt: match[2] || "" });
        if (results.length >= limit)
            break;
    }
    return results;
}
async function executeSubAgentTool(ctl, name, argsJson, context, filesModified) {
    let args;
    try {
        args = JSON.parse(argsJson || "{}");
    }
    catch {
        return `Error: invalid JSON arguments for tool ${name}.`;
    }
    const rel = (value) => path.relative(context.workspaceRoot, value) || ".";
    switch (name) {
        case "read_file": {
            const fullPath = resolveInsideWorkspace(context.cwd, String(args.path || ""));
            const text = await fs_1.promises.readFile(fullPath, "utf8");
            return (0, providerUtils_1.truncateOutput)(text, context.maxOutputBytes);
        }
        case "list_directory": {
            const dirPath = resolveInsideWorkspace(context.cwd, String(args.path || "."));
            const recursive = Boolean(args.recursive);
            const limit = Number(args.limit || 100);
            const entries = [];
            const visit = async (currentDir) => {
                if (entries.length >= limit)
                    return;
                for (const entry of await fs_1.promises.readdir(currentDir, { withFileTypes: true })) {
                    if (entries.length >= limit)
                        break;
                    const fullPath = path.join(currentDir, entry.name);
                    entries.push(await (0, providerFilesystem_1.describePath)(fullPath, context.workspaceRoot));
                    if (recursive && entry.isDirectory())
                        await visit(fullPath);
                }
            };
            await visit(dirPath);
            return (0, providerUtils_1.json)({ path: rel(dirPath), entries });
        }
        case "file_stat": {
            const fullPath = resolveInsideWorkspace(context.cwd, String(args.path || ""));
            return (0, providerUtils_1.json)(await (0, providerFilesystem_1.describePath)(fullPath, context.workspaceRoot));
        }
        case "search_text": {
            const query = String(args.query || "");
            const startDir = resolveInsideWorkspace(context.cwd, String(args.directory || "."));
            const limit = Number(args.limit || 50);
            const files = await (0, providerFilesystem_1.collectFiles)(startDir, 2000);
            const results = [];
            for (const filePath of files) {
                if (results.length >= limit)
                    break;
                try {
                    const content = await fs_1.promises.readFile(filePath, "utf8");
                    const index = content.toLowerCase().indexOf(query.toLowerCase());
                    if (index >= 0) {
                        results.push({
                            path: rel(filePath),
                            preview: content.slice(Math.max(0, index - 80), Math.min(content.length, index + 160)),
                        });
                    }
                }
                catch {
                    continue;
                }
            }
            return (0, providerUtils_1.json)({ query, results });
        }
        case "fetch_web_content": {
            return await fetchWebReadableText(String(args.url || ""), 6000);
        }
        case "write_file": {
            const fullPath = resolveInsideWorkspace(context.cwd, String(args.path || ""));
            await fs_1.promises.mkdir(path.dirname(fullPath), { recursive: true });
            await fs_1.promises.writeFile(fullPath, String(args.content || ""), "utf8");
            filesModified.push(rel(fullPath));
            return (0, providerUtils_1.json)({ success: true, path: rel(fullPath) });
        }
        case "replace_text_in_file": {
            const fullPath = resolveInsideWorkspace(context.cwd, String(args.path || ""));
            const oldText = String(args.old_text || "");
            if (!oldText)
                return "Error: old_text must not be empty.";
            const newText = String(args.new_text || "");
            const original = await fs_1.promises.readFile(fullPath, "utf8");
            const count = original.split(oldText).length - 1;
            if (count !== 1)
                return `Error: expected exactly one match, found ${count}.`;
            await fs_1.promises.writeFile(fullPath, original.replace(oldText, newText), "utf8");
            filesModified.push(rel(fullPath));
            return (0, providerUtils_1.json)({ success: true, path: rel(fullPath) });
        }
        case "make_directory": {
            const fullPath = resolveInsideWorkspace(context.cwd, String(args.path || ""));
            await fs_1.promises.mkdir(fullPath, { recursive: true });
            return (0, providerUtils_1.json)({ success: true, path: rel(fullPath) });
        }
        case "copy_path": {
            const sourcePath = resolveInsideWorkspace(context.cwd, String(args.source || ""));
            const destinationPath = resolveInsideWorkspace(context.cwd, String(args.destination || ""));
            const overwrite = Boolean(args.overwrite);
            await fs_1.promises.mkdir(path.dirname(destinationPath), { recursive: true });
            await fs_1.promises.cp(sourcePath, destinationPath, { recursive: true, force: overwrite, errorOnExist: !overwrite });
            filesModified.push(rel(destinationPath));
            return (0, providerUtils_1.json)({ success: true, source: rel(sourcePath), destination: rel(destinationPath) });
        }
        case "move_path": {
            const sourcePath = resolveInsideWorkspace(context.cwd, String(args.source || ""));
            const destinationPath = resolveInsideWorkspace(context.cwd, String(args.destination || ""));
            const overwrite = Boolean(args.overwrite);
            if (await (0, providerFilesystem_1.fileExists)(destinationPath)) {
                if (!overwrite)
                    return "Error: destination exists and overwrite is false.";
                await fs_1.promises.rm(destinationPath, { recursive: true, force: true });
            }
            await fs_1.promises.mkdir(path.dirname(destinationPath), { recursive: true });
            await fs_1.promises.rename(sourcePath, destinationPath);
            filesModified.push(rel(destinationPath));
            return (0, providerUtils_1.json)({ success: true, source: rel(sourcePath), destination: rel(destinationPath) });
        }
        case "delete_path": {
            const targetPath = resolveInsideWorkspace(context.cwd, String(args.path || ""));
            const stat = await fs_1.promises.lstat(targetPath);
            if (stat.isDirectory() && !Boolean(args.recursive))
                return "Error: recursive must be true for directories.";
            let descendantCount = 0;
            if (stat.isDirectory()) {
                descendantCount = await (0, providerFilesystem_1.countDescendants)(targetPath, (0, providerCommands_1.getDirectoryDeleteConfirmationCount)(ctl));
                if (descendantCount >= (0, providerCommands_1.getDirectoryDeleteConfirmationCount)(ctl) && !Boolean(args.confirmed)) {
                    return (0, providerUtils_1.json)({ success: false, requiresConfirmation: true, path: rel(targetPath), descendantCount });
                }
            }
            if ((0, providerCommands_1.getFileDeletionMode)(ctl) === "trash") {
                const trashedTo = await (0, providerFilesystem_1.movePathToWorkspaceTrash)(targetPath, context.workspaceRoot);
                filesModified.push(rel(targetPath));
                return (0, providerUtils_1.json)({ success: true, deletionMode: "trash", trashName: path.basename(trashedTo), path: rel(targetPath) });
            }
            await fs_1.promises.rm(targetPath, { recursive: true, force: true });
            return (0, providerUtils_1.json)({ success: true, deletionMode: "permanent", path: rel(targetPath) });
        }
        case "run_command": {
            const command = String(args.command || "");
            return await (0, providerCommands_1.buildManagedCommandResponse)(ctl, command, { cwd: context.cwd, shell: context.shell, env: context.env }, context.timeoutMs, context.maxOutputBytes);
        }
        case "run_python_code": {
            const code = String(args.code || "");
            const result = await (0, providerCommands_1.executeInlinePython)(ctl, context.pythonExecutable, code, context.shell, context.env, context.cwd, context.timeoutMs, context.maxOutputBytes);
            return (0, providerCommands_1.buildCommandResponse)("python inline", result);
        }
        default:
            return `Error: Unknown sub-agent tool ${name}.`;
    }
}
async function autoSaveSubAgentCodeBlocks(content, workingDir, workspaceRoot, filesModified) {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const matches = Array.from(content.matchAll(codeBlockRegex));
    let updated = content;
    for (const match of matches) {
        const lang = (match[1] || "").trim();
        const code = match[2];
        const header = updated.slice(Math.max(0, (match.index || 0) - 300), match.index || 0);
        const fileMatch = header.match(/([\w./\\-]+\.(?:ts|tsx|js|jsx|json|md|py|sh|yaml|yml|txt|css|html|sql|c|cpp|h|hpp))/i);
        if (!fileMatch || !code.trim())
            continue;
        const filePath = resolveInsideWorkspace(workingDir, fileMatch[1]);
        await fs_1.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs_1.promises.writeFile(filePath, code, "utf8");
        const relPath = path.relative(workspaceRoot, filePath);
        if (!filesModified.includes(relPath))
            filesModified.push(relPath);
        updated = updated.replace(match[0], `[System: Saved code block to ${relPath}${lang ? ` (${lang})` : ""}]`);
    }
    return updated;
}
async function chatCompletionForSubAgent(endpoint, model, messages, tools, timeoutMs) {
    const body = {
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
    return await response.json();
}
async function toolsProvider(ctl) {
    await (0, providerState_1.migrateMisplacedPluginDataDirectory)();
    allowFullFilesystemAccessMode = (0, providerCommands_1.getAllowFullFilesystemAccess)(ctl);
    const currentToolProfile = await (0, providerState_1.getCurrentToolProfile)(ctl);
    const allowIndividualToolRequests = (ctl.getPluginConfig(config_1.configSchematics).get("allowIndividualToolRequests") ?? true) === true;
    const currentRequestedToolNames = allowIndividualToolRequests ? await (0, providerState_1.getCurrentRequestedTools)() : [];
    const workspaceRoot = (0, providerState_1.getWorkspaceRoot)(ctl);
    const shell = (0, providerCommands_1.getShell)(ctl);
    const pythonExecutable = (0, providerCommands_1.getPython)(ctl);
    const timeoutMs = (0, providerCommands_1.getTimeoutMs)(ctl);
    const maxOutputBytes = (0, providerCommands_1.getMaxOutputBytes)(ctl);
    const env = (0, providerCommands_1.buildEnv)(ctl);
    const cavemanState = await (0, providerState_1.getCurrentCavemanState)();
    const configuredCavemanProfile = (ctl.getPluginConfig(config_1.configSchematics).get("cavemanSkillProfile") || "normal");
    const configuredCavemanifyResults = ctl.getPluginConfig(config_1.configSchematics).get("cavemanifyToolResults") ?? false;
    const cavemanControl = {
        skipNextToolPending: cavemanState.skipNextTool,
        skipTurnActive: cavemanState.skipTurnStage === "active",
        effectiveCavemanMode: cavemanState.modeOverride || configuredCavemanProfile,
    };
    const cavemanToolReminder = "Respond terse like smart caveman. Technical substance stay. Fluff die. Active every response.";
    const rawResultJson = (value) => (0, providerUtils_1.json)(value);
    const shouldBypassCavemanRewrite = (toolName, params) => {
        if (toolName === "as_skill_recommend")
            return true;
        if (toolName === "as_tool_help" && String(params.goal || "").trim())
            return true;
        return false;
    };
    const appendCavemanReminder = (value) => {
        if (typeof value === "string") {
            return value.includes(cavemanToolReminder) ? value : `${value}\n\n${cavemanToolReminder}`;
        }
        if (Array.isArray(value)) {
            return { results: value, caveman_reminder: cavemanToolReminder };
        }
        if (value && typeof value === "object") {
            return { ...value, caveman_reminder: cavemanToolReminder };
        }
        return { value, caveman_reminder: cavemanToolReminder };
    };
    const finalizeToolResult = (toolName, params, value) => {
        const shouldSkipThisTool = cavemanControl.skipNextToolPending;
        if (shouldSkipThisTool) {
            cavemanControl.skipNextToolPending = false;
            void (0, providerState_1.writeCurrentCavemanState)({ skipNextTool: false });
        }
        const cavemanModeActive = !shouldSkipThisTool
            && !cavemanControl.skipTurnActive
            && cavemanControl.effectiveCavemanMode !== "normal";
        let normalizedValue = value;
        if (typeof normalizedValue === "string") {
            try {
                normalizedValue = JSON.parse(normalizedValue);
            }
            catch {
                // Leave plain text results untouched.
            }
        }
        const shouldCavemanify = cavemanModeActive
            && configuredCavemanifyResults
            && !shouldBypassCavemanRewrite(toolName, params);
        if (shouldCavemanify) {
            normalizedValue = (0, providerUtils_1.cavemanifyToolResult)(normalizedValue);
        }
        if (cavemanModeActive) {
            normalizedValue = appendCavemanReminder(normalizedValue);
        }
        return normalizedValue;
    };
    const safeTool = (name, fn) => async (params) => {
        try {
            return finalizeToolResult(name, params, await fn(params));
        }
        catch (error) {
            return finalizeToolResult(name, params, {
                tool: name,
                success: false,
                error: error?.message ?? String(error),
            });
        }
    };
    const requireCommandExecution = () => {
        if (!(0, providerCommands_1.getAllowAutoExecution)(ctl)) {
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
    const tools = [];
    const sharedToolContext = {
        tool: sdk_1.tool,
        z: zod_1.z,
        safeTool,
        configSchematics: config_1.configSchematics,
        requireCommandExecution,
        workspaceRoot,
        allowFullFilesystemAccessMode,
        resolveInsideWorkspace,
        resolveInsideDirectory: providerFilesystem_1.resolveInsideDirectory,
        readJsonFile: providerFilesystem_1.readJsonFile,
        writeJsonFile: providerFilesystem_1.writeJsonFile,
        readMergedRecords: providerFilesystem_1.readMergedRecords,
        pluginDataDirectory: providerState_1.pluginDataDirectory,
        getConversationStorageContext: providerState_1.getConversationStorageContext,
        resolveMemoryPaths: providerState_1.resolveMemoryPaths,
        resolveTodoPaths: providerState_1.resolveTodoPaths,
        unifiedDiff: providerFilesystem_1.unifiedDiff,
        parseCsv: providerFilesystem_1.parseCsv,
        stringifyCsv: providerFilesystem_1.stringifyCsv,
        csvRowsToObjects: providerFilesystem_1.csvRowsToObjects,
        csvObjectsToRows: providerFilesystem_1.csvObjectsToRows,
        batchFileSelectionParameters: providerFilesystem_1.batchFileSelectionParameters,
        resolveBatchFileTargets: providerFilesystem_1.resolveBatchFileTargets,
        collectFiles: providerFilesystem_1.collectFiles,
        collectDirectories: providerFilesystem_1.collectDirectories,
        describePath: providerFilesystem_1.describePath,
        detectStructuredFormat: providerFilesystem_1.detectStructuredFormat,
        jsonMergePatch: providerFilesystem_1.jsonMergePatch,
        classifyFileCategory: providerFilesystem_1.classifyFileCategory,
        normalizeSuggestedName: providerFilesystem_1.normalizeSuggestedName,
        buildDirectoryTree: providerFilesystem_1.buildDirectoryTree,
        pathIsDirectory: providerFilesystem_1.pathIsDirectory,
        dynamicToolsDirectory,
        workspaceTrashDirectory,
        reorgPlansDirectory,
        fileWatchersDirectory,
        skillsDirectory,
        screenshotsDirectory,
        escapeForPowerShellSingleQuoted,
        appendOperationLog: providerFilesystem_1.appendOperationLog,
        readOperationLog: providerFilesystem_1.readOperationLog,
        overwriteMove: providerFilesystem_1.overwriteMove,
        overwriteCopy: providerFilesystem_1.overwriteCopy,
        captureDirectorySnapshot: providerFilesystem_1.captureDirectorySnapshot,
        readWatcher: providerFilesystem_1.readWatcher,
        writeWatcher: providerFilesystem_1.writeWatcher,
        countDescendants: providerFilesystem_1.countDescendants,
        movePathToWorkspaceTrash: providerFilesystem_1.movePathToWorkspaceTrash,
        fileExists: providerFilesystem_1.fileExists,
        quote: providerUtils_1.quote,
        runCommand: providerCommands_1.runCommand,
        powerShellCommand: providerCommands_1.powerShellCommand,
        powerShellScript: providerCommands_1.powerShellScript,
        buildCommandResponse: providerCommands_1.buildCommandResponse,
        buildCommandResponsePayload: providerCommands_1.buildCommandResponsePayload,
        buildManagedCommandResponse: providerCommands_1.buildManagedCommandResponse,
        executeManagedCommand: providerCommands_1.executeManagedCommand,
        commandAvailable,
        pythonModuleAvailable,
        resolveCompilerCandidates,
        executeInlinePython: providerCommands_1.executeInlinePython,
        executeInlineNodeScript: providerCommands_1.executeInlineNodeScript,
        resolveExecutablePath: providerCommands_1.resolveExecutablePath,
        getNodeExecutablePath: providerCommands_1.getNodeExecutablePath,
        getDenoExecutablePath: providerCommands_1.getDenoExecutablePath,
        getWatcherDefaultLimit: providerCommands_1.getWatcherDefaultLimit,
        getScreenshotDirectorySetting: providerCommands_1.getScreenshotDirectorySetting,
        getZstdCompressionLevel,
        getDirectoryDeleteConfirmationCount: providerCommands_1.getDirectoryDeleteConfirmationCount,
        getFileDeletionMode: providerCommands_1.getFileDeletionMode,
        getFirecrawlApiKey: providerCommands_1.getFirecrawlApiKey,
        assertCommandAllowed: providerCommands_1.assertCommandAllowed,
        refreshProcessEnvironmentFromWindowsRegistry: providerCommands_1.refreshProcessEnvironmentFromWindowsRegistry,
        getConfiguredExecutable: providerCommands_1.getConfiguredExecutable,
        getCommandOverride: providerCommands_1.getCommandOverride,
        computeFuzzyScore: providerUtils_1.computeFuzzyScore,
        escapeForPython: providerUtils_1.escapeForPython,
        indentPython: providerUtils_1.indentPython,
        parseJsonArrayOfStrings: providerUtils_1.parseJsonArrayOfStrings,
        parseJsonObject: providerUtils_1.parseJsonObject,
        mergeDefined: providerUtils_1.mergeDefined,
        firecrawlApiRequest: providerCommands_1.firecrawlApiRequest,
        firecrawlPollUntilDone: providerCommands_1.firecrawlPollUntilDone,
        stripHtmlToText,
        fallbackWebSearch,
        fallbackImageSearch,
        extractPageImages,
        discoverToolDocumentation: providerCatalog_1.discoverToolDocumentation,
        discoverPluginInventory: providerCatalog_1.discoverPluginInventory,
        filterDisabledOnly: providerCatalog_1.filterDisabledOnly,
        detectEnabledPluginsFromLmStudioState: providerState_1.detectEnabledPluginsFromLmStudioState,
        normalizeToolProfile: providerState_1.normalizeToolProfile,
        currentToolProfile,
        currentRequestedToolNames,
        allowIndividualToolRequests,
        getCurrentConversationIdFromLmStudioState: providerState_1.getCurrentConversationIdFromLmStudioState,
        writeStoredRequestedTools: providerState_1.writeStoredRequestedTools,
        writeStoredToolProfile: providerState_1.writeStoredToolProfile,
        resolveDefaultToolOutputPath: providerFilesystem_1.resolveDefaultToolOutputPath,
        maybeWriteToolOutputToFile: (root, requestedPath, payload) => (0, providerFilesystem_1.maybeWriteToolOutputToFile)(root, requestedPath, payload, resolveInsideWorkspace),
        compactToolRecord: providerCatalog_1.compactToolRecord,
        basicToolRecord: providerCatalog_1.basicToolRecord,
        standardToolRecord: providerCatalog_1.standardToolRecord,
        summarizeToolNamesByPlugin: providerCatalog_1.summarizeToolNamesByPlugin,
        findMatchingTool: providerCatalog_1.findMatchingTool,
        normalizeQueryToolList: providerCatalog_1.normalizeQueryToolList,
        findSimilarTools: providerCatalog_1.findSimilarTools,
        recommendToolsForGoal: providerCatalog_1.recommendToolsForGoal,
        runtimeToolSchema: providerCatalog_1.runtimeToolSchema,
        writeToFileParameter: providerCatalog_1.writeToFileParameter,
        dynamicToolNameSchema: providerUtils_1.dynamicToolNameSchema,
        buildEnvironment: providerCommands_1.buildEnv,
        resolveCommandPolicy: providerCommands_1.getCommandPolicy,
        currentDate: new Date().toISOString(),
        rawJson: rawResultJson,
        effectiveCavemanMode: cavemanControl.effectiveCavemanMode,
        cavemanState,
        cavemanControl,
        writeCurrentCavemanState: providerState_1.writeCurrentCavemanState,
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
        fsp: fs_1.promises,
        Buffer,
        YAML: yaml_1.default,
        json: rawResultJson,
        normalize: providerUtils_1.normalize,
        asArray: providerUtils_1.asArray,
        toNumberOrNull: providerUtils_1.toNumberOrNull,
        truncateOutput: providerUtils_1.truncateOutput,
        filterToolsByProfile: providerCatalog_1.filterToolsByProfile,
    };
    (0, meta_1.registerMetaTools)({ ...sharedToolContext, tools }, tools);
    (0, files_1.registerFilesTools)({ ...sharedToolContext, tools }, tools);
    (0, development_1.registerDevelopmentTools)({ ...sharedToolContext, tools }, tools);
    (0, web_1.registerWebTools)({ ...sharedToolContext, tools }, tools);
    (0, dataMedia_1.registerDataMediaTools)({ ...sharedToolContext, tools }, tools);
    (0, desktopAutomation_1.registerDesktopAutomationTools)({ ...sharedToolContext, tools }, tools);
    (0, stateful_1.registerStatefulTools)({ ...sharedToolContext, tools }, tools);
    (0, downloadVideo_1.registerDownloadVideoTool)({ ...sharedToolContext, tools }, tools);
    (0, mathAndUnits_1.registerMathAndUnitTools)({ ...sharedToolContext, tools }, tools);
    (0, systemInfo_1.registerSystemInfoTool)({ ...sharedToolContext, tools }, tools);
    (0, consolidated_1.registerConsolidatedTools)({ ...sharedToolContext, tools }, tools);
    const publicTools = (0, consolidated_1.finalizeConsolidatedToolSurface)(tools, ctl);
    tools.splice(0, tools.length, ...publicTools);
    return (0, providerCatalog_1.filterToolsByProfile)(tools, currentToolProfile, currentRequestedToolNames);
}
//# sourceMappingURL=providerCore.js.map