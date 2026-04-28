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
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJsonObject = exports.parseJsonArrayOfStrings = exports.mergeDefined = void 0;
exports.getShell = getShell;
exports.getPython = getPython;
exports.getTimeoutMs = getTimeoutMs;
exports.getMaxOutputBytes = getMaxOutputBytes;
exports.getFileDeletionMode = getFileDeletionMode;
exports.getDirectoryDeleteConfirmationCount = getDirectoryDeleteConfirmationCount;
exports.getZstdCompressionLevel = getZstdCompressionLevel;
exports.getCommandOverride = getCommandOverride;
exports.resolveExecutablePath = resolveExecutablePath;
exports.getAllowAutoExecution = getAllowAutoExecution;
exports.getWatcherDefaultLimit = getWatcherDefaultLimit;
exports.getScreenshotDirectorySetting = getScreenshotDirectorySetting;
exports.getAllowFullFilesystemAccess = getAllowFullFilesystemAccess;
exports.getConfiguredExecutable = getConfiguredExecutable;
exports.getFirecrawlApiKey = getFirecrawlApiKey;
exports.getFirecrawlBaseUrl = getFirecrawlBaseUrl;
exports.getCommandPolicy = getCommandPolicy;
exports.buildEnv = buildEnv;
exports.runCommand = runCommand;
exports.refreshProcessEnvironmentFromWindowsRegistry = refreshProcessEnvironmentFromWindowsRegistry;
exports.escapeForPowerShellSingleQuoted = escapeForPowerShellSingleQuoted;
exports.powerShellCommand = powerShellCommand;
exports.powerShellScript = powerShellScript;
exports.buildCommandResponsePayload = buildCommandResponsePayload;
exports.buildCommandResponse = buildCommandResponse;
exports.assertCommandAllowed = assertCommandAllowed;
exports.executeManagedCommand = executeManagedCommand;
exports.buildManagedCommandResponse = buildManagedCommandResponse;
exports.executeInlinePython = executeInlinePython;
exports.executeInlineNodeScript = executeInlineNodeScript;
exports.getNodeExecutablePath = getNodeExecutablePath;
exports.getDenoExecutablePath = getDenoExecutablePath;
exports.firecrawlApiRequest = firecrawlApiRequest;
exports.firecrawlPollUntilDone = firecrawlPollUntilDone;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const config_1 = require("../config");
const providerFilesystem_1 = require("./providerFilesystem");
const providerState_1 = require("./providerState");
const providerUtils_1 = require("./providerUtils");
Object.defineProperty(exports, "mergeDefined", { enumerable: true, get: function () { return providerUtils_1.mergeDefined; } });
Object.defineProperty(exports, "parseJsonArrayOfStrings", { enumerable: true, get: function () { return providerUtils_1.parseJsonArrayOfStrings; } });
Object.defineProperty(exports, "parseJsonObject", { enumerable: true, get: function () { return providerUtils_1.parseJsonObject; } });
const COMMAND_INLINE_PREVIEW_BYTES = 1800;
const COMMAND_INLINE_PREVIEW_LINES = 40;
const LOG_READ_GUIDANCE = "Full output spilled to disk. Do not read whole log by default. First narrow with as_file_search_text on error codes, stack frames, filenames, URLs, ids, or keywords. Then use as_file_read with offset/length only on the matching regions you actually need.";
function sanitizeLogStem(value) {
    const cleaned = String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return cleaned || "command";
}
function relativePathIfPossible(basePath, targetPath) {
    const relative = path.relative(basePath, targetPath);
    if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
        return relative.replace(/\\/g, "/");
    }
    return targetPath.replace(/\\/g, "/");
}
async function writeCommandOutputLog(cwd, command, streamName, contents) {
    const outputDirectory = path.join(cwd, "reports", "command-outputs");
    await fs_1.promises.mkdir(outputDirectory, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const baseName = `${stamp}-${sanitizeLogStem(getCommandHead(command) || "command")}-${streamName}.log`;
    const logPath = path.join(outputDirectory, baseName);
    await fs_1.promises.writeFile(logPath, contents, "utf8");
    return relativePathIfPossible(cwd, logPath);
}
async function compactCommandStream(cwd, command, streamName, rawText, maxOutputBytes) {
    const text = String(rawText || "").trim();
    const bytes = Buffer.byteLength(text, "utf8");
    const lines = text ? text.split(/\r?\n/).length : 0;
    const clippedForSafety = (0, providerUtils_1.truncateOutput)(text, maxOutputBytes);
    const preview = (0, providerUtils_1.truncateOutput)(text, COMMAND_INLINE_PREVIEW_BYTES);
    const needsLogFile = bytes > COMMAND_INLINE_PREVIEW_BYTES || lines > COMMAND_INLINE_PREVIEW_LINES;
    const truncated = clippedForSafety !== text || needsLogFile;
    const logPath = needsLogFile && text
        ? await writeCommandOutputLog(cwd, command, streamName, text)
        : null;
    if (streamName === "stdout") {
        return {
            stdout: needsLogFile ? preview : clippedForSafety,
            stdoutBytes: bytes,
            stdoutLines: lines,
            stdoutPath: logPath,
            stdoutTruncated: truncated || undefined,
        };
    }
    return {
        stderr: needsLogFile ? preview : clippedForSafety,
        stderrBytes: bytes,
        stderrLines: lines,
        stderrPath: logPath,
        stderrTruncated: truncated || undefined,
    };
}
function getShell(ctl) {
    const configured = ctl.getPluginConfig(config_1.configSchematics).get("shellPath")?.trim();
    if (configured)
        return configured;
    return process.platform === "win32" ? "cmd.exe" : "/bin/bash";
}
function getPython(ctl) {
    const configured = ctl.getPluginConfig(config_1.configSchematics).get("pythonInterpreter")?.trim();
    return configured || "python";
}
function getTimeoutMs(ctl) {
    return ctl.getPluginConfig(config_1.configSchematics).get("defaultTimeoutMs") ?? 30000;
}
function getMaxOutputBytes(ctl) {
    return ctl.getPluginConfig(config_1.configSchematics).get("maxOutputBytes") ?? 100000;
}
function getFileDeletionMode(ctl) {
    return (ctl.getPluginConfig(config_1.configSchematics).get("fileDeletionMode") === "permanent")
        ? "permanent"
        : "trash";
}
function getDirectoryDeleteConfirmationCount(ctl) {
    return ctl.getPluginConfig(config_1.configSchematics).get("directoryDeleteConfirmationCount") ?? 10;
}
function getZstdCompressionLevel(ctl) {
    return ctl.getPluginConfig(config_1.configSchematics).get("zstdCompressionLevel") ?? 10;
}
function getCommandOverride(ctl, fieldName, fallback) {
    const configured = ctl.getPluginConfig(config_1.configSchematics).get(fieldName)?.trim();
    return configured || fallback;
}
function executableCandidatesForField(fieldName) {
    if (process.platform !== "win32")
        return [];
    switch (fieldName) {
        case "imageMagickPath":
            return ["C:\\Program Files\\ImageMagick\\magick.exe"];
        case "exiftoolPath":
            return ["C:\\Program Files\\ImageMagick\\exiftool.exe", "C:\\Program Files\\ExifTool\\exiftool.exe"];
        case "ytDlpPath":
            return ["C:\\Program Files\\Yt-DLP\\yt-dlp.exe", "C:\\Program Files\\yt-dlp\\yt-dlp.exe"];
        case "ffmpegPath":
            return ["C:\\Program Files\\Yt-DLP\\ffmpeg.exe", "C:\\Program Files\\FFmpeg\\bin\\ffmpeg.exe"];
        case "ffprobePath":
            return ["C:\\Program Files\\Yt-DLP\\ffprobe.exe", "C:\\Program Files\\FFmpeg\\bin\\ffprobe.exe"];
        case "mkvmergePath":
            return ["C:\\Program Files\\MKVToolNix\\mkvmerge.exe"];
        case "mkvpropeditPath":
            return ["C:\\Program Files\\MKVToolNix\\mkvpropedit.exe"];
        case "mkvextractPath":
            return ["C:\\Program Files\\MKVToolNix\\mkvextract.exe"];
        case "pdfToTextPath":
            return ["C:\\Program Files\\poppler\\Library\\bin\\pdftotext.exe"];
        case "autoHotkeyPath":
            return [
                "C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey64.exe",
                "C:\\Program Files\\AutoHotkey\\AutoHotkey64.exe",
                "C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey.exe",
                "C:\\Program Files\\AutoHotkey\\AutoHotkey.exe",
            ];
        case "libreHardwareMonitorPath":
            return [
                "C:\\Program Files\\LibreHardwareMonitor\\LibreHardwareMonitor.exe",
                "C:\\LibreHardwareMonitor\\LibreHardwareMonitor.exe",
            ];
        case "psqlPath":
            return ["C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe", "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe"];
        case "mysqlPath":
            return ["C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe"];
        case "__nvidiaSmi__":
            return ["C:\\Windows\\System32\\nvidia-smi.exe", "C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe"];
        default:
            return [];
    }
}
async function extraExecutableCandidateForField(fieldName) {
    if (process.platform !== "win32")
        return null;
    if (fieldName !== "autoHotkeyPath")
        return null;
    const roots = [
        "C:\\Program Files\\AutoHotkey",
        "C:\\Program Files\\AutoHotkey\\v2",
    ];
    const preferredNames = [
        "AutoHotkey64.exe",
        "AutoHotkey.exe",
        "AutoHotkey32.exe",
        "AutoHotkey64_UIA.exe",
    ];
    for (const root of roots) {
        if (!await (0, providerFilesystem_1.fileExists)(root))
            continue;
        for (const name of preferredNames) {
            const direct = path.join(root, name);
            if (await (0, providerFilesystem_1.fileExists)(direct))
                return direct;
        }
        try {
            const entries = await fs_1.promises.readdir(root, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory())
                    continue;
                for (const name of preferredNames) {
                    const nested = path.join(root, entry.name, name);
                    if (await (0, providerFilesystem_1.fileExists)(nested))
                        return nested;
                }
            }
        }
        catch { }
    }
    return null;
}
async function resolveExecutablePath(ctl, env, fieldName, fallback) {
    const configured = getCommandOverride(ctl, fieldName, fallback);
    if (path.isAbsolute(configured)) {
        return configured;
    }
    const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") || (process.platform === "win32" ? "Path" : "PATH");
    const envPath = String(env[pathKey] || "");
    const namesToTry = Array.from(new Set([configured, fallback].filter(Boolean)));
    const extensions = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat", ".com"] : [""];
    for (const dir of envPath.split(path.delimiter).map((entry) => entry.trim()).filter(Boolean)) {
        for (const name of namesToTry) {
            for (const ext of extensions) {
                const candidate = path.join(dir, name.endsWith(ext) ? name : `${name}${ext}`);
                if (await (0, providerFilesystem_1.fileExists)(candidate))
                    return candidate;
            }
        }
    }
    for (const candidate of executableCandidatesForField(fieldName)) {
        if (await (0, providerFilesystem_1.fileExists)(candidate))
            return candidate;
    }
    const extraCandidate = await extraExecutableCandidateForField(fieldName);
    if (extraCandidate)
        return extraCandidate;
    return configured;
}
function getAllowAutoExecution(ctl) {
    return ctl.getPluginConfig(config_1.configSchematics).get("allowAutoExecution") ?? true;
}
function getWatcherDefaultLimit(ctl) {
    return ctl.getPluginConfig(config_1.configSchematics).get("watcherDefaultLimit") ?? 5000;
}
function getScreenshotDirectorySetting(ctl) {
    return ctl.getPluginConfig(config_1.configSchematics).get("screenshotDirectory")?.trim() || "";
}
function getAllowFullFilesystemAccess(ctl) {
    return ctl.getPluginConfig(config_1.configSchematics).get("allowFullFilesystemAccess") ?? false;
}
function getConfiguredExecutable(ctl, fieldName) {
    return ctl.getPluginConfig(config_1.configSchematics).get(fieldName)?.trim() || "";
}
function getFirecrawlApiKey(ctl) {
    return ctl.getPluginConfig(config_1.configSchematics).get("firecrawlApiKey")?.trim() || "";
}
function getFirecrawlBaseUrl(ctl) {
    const configured = ctl.getPluginConfig(config_1.configSchematics).get("firecrawlBaseUrl")?.trim();
    return (configured || "https://api.firecrawl.dev").replace(/\/+$/, "");
}
function getCommandPolicy(ctl) {
    const config = ctl.getPluginConfig(config_1.configSchematics);
    return {
        executionPolicy: (config.get("executionPolicy") === "allow_only" ? "allow_only" : "allow_all"),
        allowedCommands: (0, providerUtils_1.splitCommandList)(config.get("allowedCommands")),
        forbiddenCommands: (0, providerUtils_1.splitCommandList)(config.get("forbiddenCommands")),
        disableBlacklistCommands: (0, providerUtils_1.splitCommandList)(config.get("disableBlacklistCommands")),
        testMode: config.get("testMode") ?? false,
    };
}
function buildEnv(ctl) {
    const env = { ...process.env };
    const extra = ctl.getPluginConfig(config_1.configSchematics).get("additionalSearchPaths")?.trim();
    if (!extra)
        return env;
    const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") || (process.platform === "win32" ? "Path" : "PATH");
    const suffix = (0, providerUtils_1.splitCommandList)(extra).join(path.delimiter);
    env[pathKey] = `${env[pathKey] || ""}${path.delimiter}${suffix}`;
    return env;
}
async function runCommand(command, options, timeoutMs, maxOutputBytes) {
    return await new Promise((resolve) => {
        (0, child_process_1.exec)(command, { ...options, timeout: timeoutMs }, async (error, stdout, stderr) => {
            const cwd = path.resolve(String(options.cwd || process.cwd()));
            const stdoutSummary = await compactCommandStream(cwd, command, "stdout", stdout || "", maxOutputBytes);
            const stderrSummary = await compactCommandStream(cwd, command, "stderr", stderr || "", maxOutputBytes);
            resolve({
                stdout: stdoutSummary.stdout || "",
                stderr: stderrSummary.stderr || "",
                stdoutBytes: stdoutSummary.stdoutBytes,
                stderrBytes: stderrSummary.stderrBytes,
                stdoutLines: stdoutSummary.stdoutLines,
                stderrLines: stderrSummary.stderrLines,
                stdoutPath: stdoutSummary.stdoutPath ?? null,
                stderrPath: stderrSummary.stderrPath ?? null,
                stdoutTruncated: stdoutSummary.stdoutTruncated,
                stderrTruncated: stderrSummary.stderrTruncated,
                workingDirectory: relativePathIfPossible(process.cwd(), cwd),
                exitCode: typeof error?.code === "number" ? error.code : 0,
                error: error ? error.message : null,
            });
        });
    });
}
async function runPowerShellScriptFileForProviderCommands(scriptContents, prefix, timeoutMs, maxOutputBytes) {
    const tempDirectory = path.join(os.tmpdir(), "agentic-studio-tool-temp");
    await fs_1.promises.mkdir(tempDirectory, { recursive: true });
    const scriptPath = path.join(tempDirectory, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ps1`);
    await fs_1.promises.writeFile(scriptPath, scriptContents, "utf8");
    const command = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ${(0, providerUtils_1.quote)(scriptPath)}`;
    try {
        return await runCommand(command, { cwd: process.cwd(), shell: "cmd.exe", env: process.env }, timeoutMs, maxOutputBytes);
    }
    finally {
        await fs_1.promises.rm(scriptPath, { force: true }).catch(() => { });
    }
}
async function refreshProcessEnvironmentFromWindowsRegistry() {
    if (process.platform !== "win32")
        return {};
    const script = [
        "$machine = [Environment]::GetEnvironmentVariables('Machine')",
        "$user = [Environment]::GetEnvironmentVariables('User')",
        "$merged = [ordered]@{}",
        "foreach ($entry in $machine.GetEnumerator()) { $merged[$entry.Key] = [string]$entry.Value }",
        "foreach ($entry in $user.GetEnumerator()) { $merged[$entry.Key] = [string]$entry.Value }",
        "$merged | ConvertTo-Json -Compress -Depth 4",
    ].join("\n");
    const result = await runPowerShellScriptFileForProviderCommands(script, "refresh-process-environment", 30000, 200000);
    if (!result.stdout)
        return {};
    const parsed = JSON.parse(result.stdout);
    const updates = {};
    for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") {
            process.env[key] = value;
            updates[key] = value;
        }
    }
    return updates;
}
function escapeForPowerShellSingleQuoted(value) {
    return `'${value.replace(/'/g, "''")}'`;
}
function powerShellCommand(script) {
    const wrappedScript = [
        "$ProgressPreference = 'SilentlyContinue'",
        "$InformationPreference = 'SilentlyContinue'",
        script,
    ].join("\n");
    const encoded = Buffer.from(wrappedScript, "utf16le").toString("base64");
    return `powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encoded}`;
}
function powerShellScript(lines) {
    return lines.join("\n");
}
function buildCommandResponsePayload(command, result) {
    return (0, providerUtils_1.mergeDefined)({
        command,
        success: !result.error && result.exitCode === 0,
        workingDirectory: result.workingDirectory || undefined,
        exitCode: result.exitCode,
        stdout: result.stdout || undefined,
        stdoutBytes: result.stdoutBytes,
        stdoutLines: result.stdoutLines,
        stdoutPath: result.stdoutPath || undefined,
        stdoutTruncated: result.stdoutTruncated || undefined,
        stderr: result.stderr || undefined,
        stderrBytes: result.stderrBytes,
        stderrLines: result.stderrLines,
        stderrPath: result.stderrPath || undefined,
        stderrTruncated: result.stderrTruncated || undefined,
        logReadGuidance: result.stdoutPath || result.stderrPath ? LOG_READ_GUIDANCE : undefined,
        error: result.error || undefined,
    });
}
function buildCommandResponse(command, result) {
    return (0, providerUtils_1.json)(buildCommandResponsePayload(command, result));
}
function getCommandHead(command) {
    const trimmed = command.trim();
    const match = trimmed.match(/^"([^"]+)"|^'([^']+)'|^([^\s]+)/);
    const head = match?.[1] || match?.[2] || match?.[3] || "";
    return (0, providerUtils_1.normalize)(path.basename(head));
}
function getCommandModule(command) {
    const trimmed = command.trim();
    const match = trimmed.match(/^(?:"[^"]+"|'[^']+'|[^\s]+)\s+-m\s+([A-Za-z0-9._-]+)/);
    return match?.[1] ? (0, providerUtils_1.normalize)(match[1]) : null;
}
function matchesCommandPrefix(command, prefixes) {
    const normalizedCommand = (0, providerUtils_1.normalize)(command);
    return prefixes.some((prefix) => normalizedCommand === prefix || normalizedCommand.startsWith(`${prefix} `));
}
function assertCommandAllowed(command, policy) {
    const head = getCommandHead(command);
    const moduleName = getCommandModule(command);
    if (!head) {
        throw new Error("Unable to determine command name for policy validation.");
    }
    const matchesRule = (rules) => matchesCommandPrefix(command, rules) ||
        rules.includes(head) ||
        (!!moduleName && rules.includes(moduleName)) ||
        (!!moduleName && rules.includes(`${head} -m ${moduleName}`));
    const blacklistBypassed = matchesRule(policy.disableBlacklistCommands);
    if (!blacklistBypassed && matchesRule(policy.forbiddenCommands)) {
        throw new Error(`Command '${head}' is blocked by Command Shell Blacklist.`);
    }
    if (policy.executionPolicy === "allow_only" && !matchesRule(policy.allowedCommands)) {
        throw new Error(`Command '${head}' is not in Command Shell Whitelist while Execution Policy is Allow Only.`);
    }
}
async function executeManagedCommand(ctl, command, options, timeoutMs, maxOutputBytes) {
    const policy = getCommandPolicy(ctl);
    assertCommandAllowed(command, policy);
    if (policy.testMode) {
        return { stdout: "", stderr: "", exitCode: 0, error: null };
    }
    return runCommand(command, options, timeoutMs, maxOutputBytes);
}
async function buildManagedCommandResponse(ctl, command, options, timeoutMs, maxOutputBytes) {
    const policy = getCommandPolicy(ctl);
    assertCommandAllowed(command, policy);
    if (policy.testMode) {
        return (0, providerUtils_1.json)({
            command,
            success: true,
            testMode: true,
            message: "Test Mode: command validated, not executed.",
        });
    }
    return buildCommandResponse(command, await runCommand(command, options, timeoutMs, maxOutputBytes));
}
async function executeInlinePython(ctl, pythonExecutable, script, shell, env, cwd, timeoutMs, maxOutputBytes) {
    const runnerDir = await fs_1.promises.mkdtemp(path.join(os.tmpdir(), "mc-inline-py-"));
    try {
        const scriptPath = path.join(runnerDir, "runner.py");
        await fs_1.promises.writeFile(scriptPath, script, "utf8");
        const command = `${(0, providerUtils_1.quote)(pythonExecutable)} ${(0, providerUtils_1.quote)(scriptPath)}`;
        return await executeManagedCommand(ctl, command, { cwd, shell, env }, timeoutMs, maxOutputBytes);
    }
    finally {
        await fs_1.promises.rm(runnerDir, { recursive: true, force: true });
    }
}
async function executeInlineNodeScript(ctl, script, shell, env, cwd, timeoutMs, maxOutputBytes, nodeExecutable, runnerBaseDir) {
    const runnerRoot = runnerBaseDir
        ? path.join(path.resolve(runnerBaseDir), ".agentic-studio-inline-node")
        : os.tmpdir();
    await fs_1.promises.mkdir(runnerRoot, { recursive: true });
    const runnerDir = await fs_1.promises.mkdtemp(path.join(runnerRoot, "mc-inline-node-"));
    try {
        const scriptPath = path.join(runnerDir, "runner.cjs");
        await fs_1.promises.writeFile(scriptPath, script, "utf8");
        const nodePath = nodeExecutable || process.execPath;
        const nodeModuleCandidates = [
            runnerBaseDir ? path.join(path.resolve(runnerBaseDir), "node_modules") : "",
            path.resolve(cwd, "node_modules"),
            path.resolve(__dirname, "..", "node_modules"),
            path.resolve(__dirname, "..", "..", "node_modules"),
        ];
        const childEnv = { ...env };
        const existingNodeModules = [];
        for (const candidate of nodeModuleCandidates) {
            if (await (0, providerFilesystem_1.fileExists)(candidate) && !existingNodeModules.includes(candidate)) {
                existingNodeModules.push(candidate);
            }
        }
        if (existingNodeModules.length > 0) {
            const joinedCandidates = existingNodeModules.join(path.delimiter);
            childEnv.NODE_PATH = childEnv.NODE_PATH
                ? `${joinedCandidates}${path.delimiter}${childEnv.NODE_PATH}`
                : joinedCandidates;
        }
        const command = `${(0, providerUtils_1.quote)(nodePath)} ${(0, providerUtils_1.quote)(scriptPath)}`;
        return await executeManagedCommand(ctl, command, { cwd, shell, env: childEnv }, timeoutMs, maxOutputBytes);
    }
    finally {
        await fs_1.promises.rm(runnerDir, { recursive: true, force: true });
    }
}
async function resolveBundledUtility(executableName) {
    const names = process.platform === "win32"
        ? [executableName, executableName.endsWith(".exe") ? executableName : `${executableName}.exe`]
        : [executableName.replace(/\.exe$/i, "")];
    for (const name of [...new Set(names)]) {
        const candidate = path.join((0, providerState_1.lmStudioInternalDirectory)(), "utils", name);
        if (await (0, providerFilesystem_1.fileExists)(candidate))
            return candidate;
    }
    return null;
}
async function getNodeExecutablePath(ctl) {
    const configured = getConfiguredExecutable(ctl, "nodeExecutable");
    if (configured)
        return configured;
    return (await resolveBundledUtility("node")) || process.execPath;
}
async function getDenoExecutablePath(ctl) {
    const configured = getConfiguredExecutable(ctl, "denoExecutable");
    if (configured)
        return configured;
    return (await resolveBundledUtility("deno")) || "deno";
}
async function firecrawlApiRequest(ctl, endpointPath, method, body, timeoutOverrideMs) {
    const apiKey = getFirecrawlApiKey(ctl);
    if (!apiKey) {
        throw new Error("Firecrawl API Key is not configured in agentic-studio settings.");
    }
    const controller = new AbortController();
    const timeoutMs = timeoutOverrideMs || 60000;
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${getFirecrawlBaseUrl(ctl)}${endpointPath}`, {
            method,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });
        const text = await response.text();
        let parsed = {};
        try {
            parsed = text ? JSON.parse(text) : {};
        }
        catch {
            parsed = { raw: text };
        }
        if (!response.ok) {
            throw new Error(`Firecrawl request failed (${response.status} ${response.statusText}): ${typeof parsed === "object" ? JSON.stringify(parsed) : String(parsed)}`);
        }
        return (parsed && typeof parsed === "object") ? parsed : { data: parsed };
    }
    finally {
        clearTimeout(timeoutHandle);
    }
}
async function firecrawlPollUntilDone(ctl, endpointPath, pollIntervalMs, waitTimeoutMs) {
    const deadline = Date.now() + waitTimeoutMs;
    let last = {};
    while (Date.now() < deadline) {
        last = await firecrawlApiRequest(ctl, endpointPath, "GET", undefined, Math.min(60000, pollIntervalMs + 5000));
        const status = String(last.status || "");
        if (!status || status === "completed" || status === "failed" || status === "cancelled") {
            return last;
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    return (0, providerUtils_1.mergeDefined)(last, { warning: "Timed out while polling Firecrawl job status." });
}
//# sourceMappingURL=providerCommands.js.map