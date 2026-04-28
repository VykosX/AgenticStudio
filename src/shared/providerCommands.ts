import type { ToolsProviderController } from "@lmstudio/sdk";
import { exec, type ExecOptions } from "child_process";
import { promises as fsp } from "fs";
import * as os from "os";
import * as path from "path";
import { configSchematics } from "../config";
import { fileExists } from "./providerFilesystem";
import { lmStudioInternalDirectory } from "./providerState";
import type { CommandPolicy, CommandResult } from "./providerTypes";
import { json, mergeDefined, normalize, parseJsonArrayOfStrings, parseJsonObject, quote, splitCommandList, truncateOutput } from "./providerUtils";

const COMMAND_INLINE_PREVIEW_BYTES = 1800;
const COMMAND_INLINE_PREVIEW_LINES = 40;
const LOG_READ_GUIDANCE = "Full output spilled to disk. Do not read whole log by default. First narrow with as_file_search_text on error codes, stack frames, filenames, URLs, ids, or keywords. Then use as_file_read with offset/length only on the matching regions you actually need.";

function sanitizeLogStem(value: string): string {
  const cleaned = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "command";
}

function relativePathIfPossible(basePath: string, targetPath: string): string {
  const relative = path.relative(basePath, targetPath);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative.replace(/\\/g, "/");
  }
  return targetPath.replace(/\\/g, "/");
}

async function writeCommandOutputLog(
  cwd: string,
  command: string,
  streamName: "stdout" | "stderr",
  contents: string,
): Promise<string> {
  const outputDirectory = path.join(cwd, "reports", "command-outputs");
  await fsp.mkdir(outputDirectory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `${stamp}-${sanitizeLogStem(getCommandHead(command) || "command")}-${streamName}.log`;
  const logPath = path.join(outputDirectory, baseName);
  await fsp.writeFile(logPath, contents, "utf8");
  return relativePathIfPossible(cwd, logPath);
}

async function compactCommandStream(
  cwd: string,
  command: string,
  streamName: "stdout" | "stderr",
  rawText: string,
  maxOutputBytes: number,
): Promise<Partial<Pick<CommandResult, "stdout" | "stderr" | "stdoutBytes" | "stderrBytes" | "stdoutLines" | "stderrLines" | "stdoutPath" | "stderrPath" | "stdoutTruncated" | "stderrTruncated">>> {
  const text = String(rawText || "").trim();
  const bytes = Buffer.byteLength(text, "utf8");
  const lines = text ? text.split(/\r?\n/).length : 0;
  const clippedForSafety = truncateOutput(text, maxOutputBytes);
  const preview = truncateOutput(text, COMMAND_INLINE_PREVIEW_BYTES);
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

export function getShell(ctl: ToolsProviderController): string {
  const configured = (ctl.getPluginConfig(configSchematics).get("shellPath") as string | undefined)?.trim();
  if (configured) return configured;
  return process.platform === "win32" ? "cmd.exe" : "/bin/bash";
}

export function getPython(ctl: ToolsProviderController): string {
  const configured = (ctl.getPluginConfig(configSchematics).get("pythonInterpreter") as string | undefined)?.trim();
  return configured || "python";
}

export function getTimeoutMs(ctl: ToolsProviderController): number {
  return (ctl.getPluginConfig(configSchematics).get("defaultTimeoutMs") as number | undefined) ?? 30000;
}

export function getMaxOutputBytes(ctl: ToolsProviderController): number {
  return (ctl.getPluginConfig(configSchematics).get("maxOutputBytes") as number | undefined) ?? 100000;
}

export function getFileDeletionMode(ctl: ToolsProviderController): "trash" | "permanent" {
  return ((ctl.getPluginConfig(configSchematics).get("fileDeletionMode") as string | undefined) === "permanent")
    ? "permanent"
    : "trash";
}

export function getDirectoryDeleteConfirmationCount(ctl: ToolsProviderController): number {
  return (ctl.getPluginConfig(configSchematics).get("directoryDeleteConfirmationCount") as number | undefined) ?? 10;
}

export function getZstdCompressionLevel(ctl: ToolsProviderController): number {
  return (ctl.getPluginConfig(configSchematics).get("zstdCompressionLevel") as number | undefined) ?? 10;
}

export function getCommandOverride(ctl: ToolsProviderController, fieldName: string, fallback: string): string {
  const configured = (ctl.getPluginConfig(configSchematics).get(fieldName as any) as string | undefined)?.trim();
  return configured || fallback;
}

function executableCandidatesForField(fieldName: string): string[] {
  if (process.platform !== "win32") return [];
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

async function extraExecutableCandidateForField(fieldName: string): Promise<string | null> {
  if (process.platform !== "win32") return null;
  if (fieldName !== "autoHotkeyPath") return null;
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
    if (!await fileExists(root)) continue;
    for (const name of preferredNames) {
      const direct = path.join(root, name);
      if (await fileExists(direct)) return direct;
    }
    try {
      const entries = await fsp.readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        for (const name of preferredNames) {
          const nested = path.join(root, entry.name, name);
          if (await fileExists(nested)) return nested;
        }
      }
    } catch {}
  }
  return null;
}

export async function resolveExecutablePath(
  ctl: ToolsProviderController,
  env: NodeJS.ProcessEnv,
  fieldName: string,
  fallback: string,
): Promise<string> {
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
        if (await fileExists(candidate)) return candidate;
      }
    }
  }
  for (const candidate of executableCandidatesForField(fieldName)) {
    if (await fileExists(candidate)) return candidate;
  }
  const extraCandidate = await extraExecutableCandidateForField(fieldName);
  if (extraCandidate) return extraCandidate;
  return configured;
}

export function getAllowAutoExecution(ctl: ToolsProviderController): boolean {
  return (ctl.getPluginConfig(configSchematics).get("allowAutoExecution") as boolean | undefined) ?? true;
}

export function getWatcherDefaultLimit(ctl: ToolsProviderController): number {
  return (ctl.getPluginConfig(configSchematics).get("watcherDefaultLimit") as number | undefined) ?? 5000;
}

export function getScreenshotDirectorySetting(ctl: ToolsProviderController): string {
  return (ctl.getPluginConfig(configSchematics).get("screenshotDirectory") as string | undefined)?.trim() || "";
}

export function getAllowFullFilesystemAccess(ctl: ToolsProviderController): boolean {
  return (ctl.getPluginConfig(configSchematics).get("allowFullFilesystemAccess") as boolean | undefined) ?? false;
}

export function getConfiguredExecutable(ctl: ToolsProviderController, fieldName: string): string {
  return (ctl.getPluginConfig(configSchematics).get(fieldName as any) as string | undefined)?.trim() || "";
}

export function getFirecrawlApiKey(ctl: ToolsProviderController): string {
  return (ctl.getPluginConfig(configSchematics).get("firecrawlApiKey") as string | undefined)?.trim() || "";
}

export function getFirecrawlBaseUrl(ctl: ToolsProviderController): string {
  const configured = (ctl.getPluginConfig(configSchematics).get("firecrawlBaseUrl") as string | undefined)?.trim();
  return (configured || "https://api.firecrawl.dev").replace(/\/+$/, "");
}

export function getCommandPolicy(ctl: ToolsProviderController): CommandPolicy {
  const config = ctl.getPluginConfig(configSchematics);
  return {
    executionPolicy: ((config.get("executionPolicy") as string | undefined) === "allow_only" ? "allow_only" : "allow_all"),
    allowedCommands: splitCommandList(config.get("allowedCommands") as string | undefined),
    forbiddenCommands: splitCommandList(config.get("forbiddenCommands") as string | undefined),
    disableBlacklistCommands: splitCommandList(config.get("disableBlacklistCommands") as string | undefined),
    testMode: (config.get("testMode") as boolean | undefined) ?? false,
  };
}

export function buildEnv(ctl: ToolsProviderController): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const extra = (ctl.getPluginConfig(configSchematics).get("additionalSearchPaths") as string | undefined)?.trim();
  if (!extra) return env;
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") || (process.platform === "win32" ? "Path" : "PATH");
  const suffix = splitCommandList(extra).join(path.delimiter);
  env[pathKey] = `${env[pathKey] || ""}${path.delimiter}${suffix}`;
  return env;
}

export async function runCommand(
  command: string,
  options: ExecOptions,
  timeoutMs: number,
  maxOutputBytes: number,
): Promise<CommandResult> {
  return await new Promise((resolve) => {
    exec(command, { ...options, timeout: timeoutMs }, async (error, stdout, stderr) => {
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
        exitCode: typeof (error as any)?.code === "number" ? (error as any).code : 0,
        error: error ? error.message : null,
      });
    });
  });
}

async function runPowerShellScriptFileForProviderCommands(
  scriptContents: string,
  prefix: string,
  timeoutMs: number,
  maxOutputBytes: number,
): Promise<CommandResult> {
  const tempDirectory = path.join(os.tmpdir(), "agentic-studio-tool-temp");
  await fsp.mkdir(tempDirectory, { recursive: true });
  const scriptPath = path.join(tempDirectory, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ps1`);
  await fsp.writeFile(scriptPath, scriptContents, "utf8");
  const command = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ${quote(scriptPath)}`;
  try {
    return await runCommand(command, { cwd: process.cwd(), shell: "cmd.exe", env: process.env }, timeoutMs, maxOutputBytes);
  } finally {
    await fsp.rm(scriptPath, { force: true }).catch(() => {});
  }
}

export async function refreshProcessEnvironmentFromWindowsRegistry(): Promise<Record<string, string>> {
  if (process.platform !== "win32") return {};
  const script = [
    "$machine = [Environment]::GetEnvironmentVariables('Machine')",
    "$user = [Environment]::GetEnvironmentVariables('User')",
    "$merged = [ordered]@{}",
    "foreach ($entry in $machine.GetEnumerator()) { $merged[$entry.Key] = [string]$entry.Value }",
    "foreach ($entry in $user.GetEnumerator()) { $merged[$entry.Key] = [string]$entry.Value }",
    "$merged | ConvertTo-Json -Compress -Depth 4",
  ].join("\n");
  const result = await runPowerShellScriptFileForProviderCommands(script, "refresh-process-environment", 30000, 200000);
  if (!result.stdout) return {};
  const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
  const updates: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      process.env[key] = value;
      updates[key] = value;
    }
  }
  return updates;
}

export function escapeForPowerShellSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function powerShellCommand(script: string): string {
  const wrappedScript = [
    "$ProgressPreference = 'SilentlyContinue'",
    "$InformationPreference = 'SilentlyContinue'",
    script,
  ].join("\n");
  const encoded = Buffer.from(wrappedScript, "utf16le").toString("base64");
  return `powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encoded}`;
}

export function powerShellScript(lines: string[]): string {
  return lines.join("\n");
}

export function buildCommandResponsePayload(command: string, result: CommandResult): Record<string, unknown> {
  return mergeDefined({
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

export function buildCommandResponse(command: string, result: CommandResult): string {
  return json(buildCommandResponsePayload(command, result));
}

function getCommandHead(command: string): string {
  const trimmed = command.trim();
  const match = trimmed.match(/^"([^"]+)"|^'([^']+)'|^([^\s]+)/);
  const head = match?.[1] || match?.[2] || match?.[3] || "";
  return normalize(path.basename(head));
}

function getCommandModule(command: string): string | null {
  const trimmed = command.trim();
  const match = trimmed.match(/^(?:"[^"]+"|'[^']+'|[^\s]+)\s+-m\s+([A-Za-z0-9._-]+)/);
  return match?.[1] ? normalize(match[1]) : null;
}

function matchesCommandPrefix(command: string, prefixes: string[]): boolean {
  const normalizedCommand = normalize(command);
  return prefixes.some((prefix) => normalizedCommand === prefix || normalizedCommand.startsWith(`${prefix} `));
}

export function assertCommandAllowed(command: string, policy: CommandPolicy): void {
  const head = getCommandHead(command);
  const moduleName = getCommandModule(command);
  if (!head) {
    throw new Error("Unable to determine command name for policy validation.");
  }
  const matchesRule = (rules: string[]) =>
    matchesCommandPrefix(command, rules) ||
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

export async function executeManagedCommand(
  ctl: ToolsProviderController,
  command: string,
  options: ExecOptions,
  timeoutMs: number,
  maxOutputBytes: number,
): Promise<CommandResult> {
  const policy = getCommandPolicy(ctl);
  assertCommandAllowed(command, policy);
  if (policy.testMode) {
    return { stdout: "", stderr: "", exitCode: 0, error: null };
  }
  return runCommand(command, options, timeoutMs, maxOutputBytes);
}

export async function buildManagedCommandResponse(
  ctl: ToolsProviderController,
  command: string,
  options: ExecOptions,
  timeoutMs: number,
  maxOutputBytes: number,
): Promise<string> {
  const policy = getCommandPolicy(ctl);
  assertCommandAllowed(command, policy);
  if (policy.testMode) {
    return json({
      command,
      success: true,
      testMode: true,
      message: "Test Mode: command validated, not executed.",
    });
  }
  return buildCommandResponse(command, await runCommand(command, options, timeoutMs, maxOutputBytes));
}

export async function executeInlinePython(
  ctl: ToolsProviderController,
  pythonExecutable: string,
  script: string,
  shell: string,
  env: NodeJS.ProcessEnv,
  cwd: string,
  timeoutMs: number,
  maxOutputBytes: number,
): Promise<CommandResult> {
  const runnerDir = await fsp.mkdtemp(path.join(os.tmpdir(), "mc-inline-py-"));
  try {
    const scriptPath = path.join(runnerDir, "runner.py");
    await fsp.writeFile(scriptPath, script, "utf8");
    const command = `${quote(pythonExecutable)} ${quote(scriptPath)}`;
    return await executeManagedCommand(ctl, command, { cwd, shell, env }, timeoutMs, maxOutputBytes);
  } finally {
    await fsp.rm(runnerDir, { recursive: true, force: true });
  }
}

export async function executeInlineNodeScript(
  ctl: ToolsProviderController,
  script: string,
  shell: string,
  env: NodeJS.ProcessEnv,
  cwd: string,
  timeoutMs: number,
  maxOutputBytes: number,
  nodeExecutable?: string,
  runnerBaseDir?: string,
): Promise<CommandResult> {
  const runnerRoot = runnerBaseDir
    ? path.join(path.resolve(runnerBaseDir), ".agentic-studio-inline-node")
    : os.tmpdir();
  await fsp.mkdir(runnerRoot, { recursive: true });
  const runnerDir = await fsp.mkdtemp(path.join(runnerRoot, "mc-inline-node-"));
  try {
    const scriptPath = path.join(runnerDir, "runner.cjs");
    await fsp.writeFile(scriptPath, script, "utf8");
    const nodePath = nodeExecutable || process.execPath;
    const nodeModuleCandidates = [
      runnerBaseDir ? path.join(path.resolve(runnerBaseDir), "node_modules") : "",
      path.resolve(cwd, "node_modules"),
      path.resolve(__dirname, "..", "node_modules"),
      path.resolve(__dirname, "..", "..", "node_modules"),
    ];
    const childEnv = { ...env };
    const existingNodeModules: string[] = [];
    for (const candidate of nodeModuleCandidates) {
      if (await fileExists(candidate) && !existingNodeModules.includes(candidate)) {
        existingNodeModules.push(candidate);
      }
    }
    if (existingNodeModules.length > 0) {
      const joinedCandidates = existingNodeModules.join(path.delimiter);
      childEnv.NODE_PATH = childEnv.NODE_PATH
        ? `${joinedCandidates}${path.delimiter}${childEnv.NODE_PATH}`
        : joinedCandidates;
    }
    const command = `${quote(nodePath)} ${quote(scriptPath)}`;
    return await executeManagedCommand(ctl, command, { cwd, shell, env: childEnv }, timeoutMs, maxOutputBytes);
  } finally {
    await fsp.rm(runnerDir, { recursive: true, force: true });
  }
}

async function resolveBundledUtility(executableName: string): Promise<string | null> {
  const names = process.platform === "win32"
    ? [executableName, executableName.endsWith(".exe") ? executableName : `${executableName}.exe`]
    : [executableName.replace(/\.exe$/i, "")];
  for (const name of [...new Set(names)]) {
    const candidate = path.join(lmStudioInternalDirectory(), "utils", name);
    if (await fileExists(candidate)) return candidate;
  }
  return null;
}

export async function getNodeExecutablePath(ctl: ToolsProviderController): Promise<string> {
  const configured = getConfiguredExecutable(ctl, "nodeExecutable");
  if (configured) return configured;
  return (await resolveBundledUtility("node")) || process.execPath;
}

export async function getDenoExecutablePath(ctl: ToolsProviderController): Promise<string> {
  const configured = getConfiguredExecutable(ctl, "denoExecutable");
  if (configured) return configured;
  return (await resolveBundledUtility("deno")) || "deno";
}

export async function firecrawlApiRequest(
  ctl: ToolsProviderController,
  endpointPath: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
  timeoutOverrideMs?: number,
): Promise<Record<string, unknown>> {
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
    let parsed: unknown = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text };
    }
    if (!response.ok) {
      throw new Error(`Firecrawl request failed (${response.status} ${response.statusText}): ${typeof parsed === "object" ? JSON.stringify(parsed) : String(parsed)}`);
    }
    return (parsed && typeof parsed === "object") ? (parsed as Record<string, unknown>) : { data: parsed };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function firecrawlPollUntilDone(
  ctl: ToolsProviderController,
  endpointPath: string,
  pollIntervalMs: number,
  waitTimeoutMs: number,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + waitTimeoutMs;
  let last: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    last = await firecrawlApiRequest(ctl, endpointPath, "GET", undefined, Math.min(60000, pollIntervalMs + 5000));
    const status = String(last.status || "");
    if (!status || status === "completed" || status === "failed" || status === "cancelled") {
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return mergeDefined(last, { warning: "Timed out while polling Firecrawl job status." });
}

export { mergeDefined, parseJsonArrayOfStrings, parseJsonObject };
