import { promises as fsp } from "fs";
import * as path from "path";
import { pluginDataDirectory } from "./providerState";
import { expandEnvironmentPath } from "./providerUtils";
import type {
  ConversationStorageContext,
  FileWatcherDefinition,
  FileWatcherSnapshotEntry,
} from "./providerTypes";

export async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fsp.stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function pathIsDirectory(targetPath: string): Promise<boolean> {
  try {
    const stat = await fsp.stat(targetPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export function resolveInsideWorkspace(root: string, requestedPath: string, allowFullFilesystemAccessMode: boolean): string {
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

export function resolveInsideDirectory(baseDirectory: string, requestedPath: string): string {
  const resolved = path.resolve(baseDirectory, requestedPath);
  const base = path.resolve(baseDirectory);
  const lowerResolved = resolved.toLowerCase();
  const lowerBase = base.toLowerCase();
  if (!lowerResolved.startsWith(lowerBase + path.sep) && lowerResolved !== lowerBase) {
    throw new Error(`Access denied: '${requestedPath}' is outside the expected directory.`);
  }
  return resolved;
}

export async function collectToolSourceFiles(
  rootDirectory: string,
  relativeSubdir: string,
  out: string[],
  maxFiles: number,
): Promise<void> {
  if (out.length >= maxFiles) return;
  const base = path.join(rootDirectory, relativeSubdir);
  const entries = await fsp.readdir(base, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (out.length >= maxFiles) break;
    const fullPath = path.join(base, entry.name);
    if (entry.isDirectory()) {
      await collectToolSourceFiles(rootDirectory, path.join(relativeSubdir, entry.name), out, maxFiles);
      continue;
    }
    if (!/\.(ts|js)$/i.test(entry.name)) continue;
    out.push(fullPath);
  }
}

export function unifiedDiff(oldText: string, newText: string, label = "file"): string {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: string[] = [`--- a/${label}`, `+++ b/${label}`];
  let i = 0;
  let j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (oldLines[i] === newLines[j]) {
      result.push(` ${oldLines[i] ?? ""}`);
      i++;
      j++;
      continue;
    }
    if (i < oldLines.length) result.push(`-${oldLines[i++]}`);
    if (j < newLines.length) result.push(`+${newLines[j++]}`);
  }
  return result.join("\n");
}

export async function collectFiles(directory: string, limit: number, out: string[] = [], recursive = true): Promise<string[]> {
  if (out.length >= limit) return out;
  const entries = await fsp.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (out.length >= limit) break;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (recursive) {
        await collectFiles(fullPath, limit, out, recursive);
      }
    } else {
      out.push(fullPath);
    }
  }
  return out;
}

export async function collectDirectories(directory: string, limit: number, out: string[] = [], recursive = true): Promise<string[]> {
  if (out.length >= limit) return out;
  const entries = await fsp.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (out.length >= limit) break;
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(directory, entry.name);
    out.push(fullPath);
    if (recursive) {
      await collectDirectories(fullPath, limit, out, recursive);
    }
  }
  return out;
}

export type BatchFileTargetSource = "path" | "file_list" | "folder_list" | "legacy_list";

export type BatchFileTarget = {
  fullPath: string;
  relativePath: string;
  requestedPath: string;
  source: BatchFileTargetSource;
  baseDirectory?: string;
  relativeToBase?: string;
};

export type BatchFileSelectionOptions = {
  workspaceRoot: string;
  resolvePath: (root: string, requestedPath: string) => string;
  primaryPath?: unknown;
  primaryPathName?: string;
  fileList?: unknown;
  folderList?: unknown;
  legacyList?: unknown;
  legacyListName?: string;
  filePattern?: unknown;
  filePatternFlags?: unknown;
  folderRecursive?: unknown;
  includeHidden?: unknown;
  fileLimit?: unknown;
  mustExist?: boolean;
  requireFiles?: boolean;
  includeDirectories?: boolean;
  allowEmpty?: boolean;
};

export function batchFileSelectionParameters(z: any): Record<string, unknown> {
  return {
    file_list: z.array(z.string()).default([]),
    folder_list: z.array(z.string()).default([]),
    file_pattern: z.string().default(""),
    file_pattern_flags: z.string().default(""),
    folder_recursive: z.boolean().default(true),
    include_hidden: z.boolean().default(false),
    file_limit: z.number().int().min(1).max(20000).default(5000),
  };
}

function normalizePathList(value: unknown, fieldName: string): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry, index) => {
        if (typeof entry !== "string") {
          throw new Error(`${fieldName}[${index}] must be a string path.`);
        }
        return entry.trim();
      })
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch (error) {
        throw new Error(`${fieldName} must be a JSON array of path strings: ${(error as Error).message}`);
      }
      return normalizePathList(parsed, fieldName);
    }
    return [trimmed];
  }
  throw new Error(`${fieldName} must be a path string or an array of path strings.`);
}

function normalizeRegexFlags(value: unknown): string {
  const rawFlags = String(value || "");
  if (!/^[dgimsuy]*$/.test(rawFlags)) {
    throw new Error("file_pattern_flags may only contain JavaScript RegExp flags: d, g, i, m, s, u, y.");
  }
  return Array.from(new Set(rawFlags.split(""))).join("");
}

export async function resolveBatchFileTargets(options: BatchFileSelectionOptions): Promise<BatchFileTarget[]> {
  const {
    workspaceRoot,
    resolvePath,
    primaryPath,
    primaryPathName = "path",
    fileList,
    folderList,
    legacyList,
    legacyListName = "paths_json",
    filePattern,
    filePatternFlags,
    folderRecursive = true,
    includeHidden = false,
    fileLimit = 5000,
    mustExist = true,
    requireFiles = true,
    includeDirectories = false,
    allowEmpty = false,
  } = options;

  const limit = Math.max(1, Math.min(20000, Number(fileLimit) || 5000));
  const explicitPaths = [
    ...normalizePathList(primaryPath, primaryPathName).map((requestedPath) => ({ requestedPath, source: "path" as BatchFileTargetSource })),
    ...normalizePathList(fileList, "file_list").map((requestedPath) => ({ requestedPath, source: "file_list" as BatchFileTargetSource })),
    ...normalizePathList(legacyList, legacyListName).map((requestedPath) => ({ requestedPath, source: "legacy_list" as BatchFileTargetSource })),
  ];
  const folders = normalizePathList(folderList, "folder_list");
  const flags = normalizeRegexFlags(filePatternFlags);
  const patternText = String(filePattern || "").trim();
  const pattern = patternText ? new RegExp(patternText, flags) : null;
  const seen = new Set<string>();
  const targets: BatchFileTarget[] = [];

  const isHiddenPath = (relativePath: string): boolean => relativePath.split(/[\\/]+/).some((part) => part.startsWith("."));
  const patternMatches = (target: BatchFileTarget): boolean => {
    if (!pattern) return true;
    const candidates = [
      target.relativePath,
      path.basename(target.fullPath),
      target.relativeToBase || "",
    ].filter(Boolean);
    for (const candidate of candidates) {
      pattern.lastIndex = 0;
      if (pattern.test(candidate)) {
        pattern.lastIndex = 0;
        return true;
      }
    }
    pattern.lastIndex = 0;
    return false;
  };

  const addTarget = async (
    requestedPath: string,
    source: BatchFileTargetSource,
    baseDirectory?: string,
  ): Promise<void> => {
    if (targets.length >= limit) return;
    const fullPath = resolvePath(workspaceRoot, requestedPath);
    const relativePath = path.relative(workspaceRoot, fullPath) || ".";
    if (!includeHidden && source === "folder_list" && isHiddenPath(relativePath)) return;
    const stat = await fsp.lstat(fullPath).catch((error) => {
      if (mustExist) throw error;
      return null;
    });
    if (stat?.isDirectory() && !includeDirectories) {
      if (source === "folder_list") return;
      throw new Error(`${source === "path" ? primaryPathName : "file_list"} target is a directory: ${requestedPath}`);
    }
    if (stat && requireFiles && !stat.isFile() && !stat.isSymbolicLink()) {
      if (source === "folder_list") return;
      throw new Error(`${source === "path" ? primaryPathName : "file_list"} target is not a file: ${requestedPath}`);
    }
    const relativeToBase = baseDirectory ? path.relative(baseDirectory, fullPath) || "." : undefined;
    const target: BatchFileTarget = {
      fullPath,
      relativePath,
      requestedPath,
      source,
      baseDirectory,
      relativeToBase,
    };
    if (!patternMatches(target)) return;
    const key = process.platform === "win32" ? fullPath.toLowerCase() : fullPath;
    if (seen.has(key)) return;
    seen.add(key);
    targets.push(target);
  };

  for (const entry of explicitPaths) {
    await addTarget(entry.requestedPath, entry.source);
  }

  const visitFolder = async (folderPath: string, currentPath: string): Promise<void> => {
    if (targets.length >= limit) return;
    const entries = await fsp.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (targets.length >= limit) break;
      if (!includeHidden && entry.name.startsWith(".")) continue;
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (Boolean(folderRecursive)) await visitFolder(folderPath, fullPath);
        continue;
      }
      await addTarget(path.relative(workspaceRoot, fullPath), "folder_list", folderPath);
    }
  };

  for (const requestedFolder of folders) {
    if (targets.length >= limit) break;
    const folderPath = resolvePath(workspaceRoot, requestedFolder);
    if (!await pathIsDirectory(folderPath)) {
      throw new Error(`folder_list entry is not a directory: ${requestedFolder}`);
    }
    await visitFolder(folderPath, folderPath);
  }

  if (targets.length === 0 && !allowEmpty) {
    throw new Error(`No file targets were resolved. Provide ${primaryPathName}, file_list, or folder_list; file_pattern only filters resolved targets.`);
  }
  return targets;
}

function workspaceTrashDirectory(_root: string): string {
  return path.join(pluginDataDirectory(), "trash");
}

function operationsLogPath(_root: string): string {
  return path.join(pluginDataDirectory(), "logs", "file-operations.jsonl");
}

function fileWatchersDirectory(_root: string): string {
  return path.join(pluginDataDirectory(), "watchers");
}

export async function buildDirectoryTree(
  directory: string,
  root: string,
  maxDepth: number,
  maxEntries: number,
  relativeRoot = root,
  depth = 0,
  lines: string[] = [],
): Promise<string[]> {
  if (lines.length >= maxEntries) return lines;
  const entries = (await fsp.readdir(directory, { withFileTypes: true }))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (lines.length >= maxEntries) break;
    const fullPath = path.join(directory, entry.name);
    const relPath = path.relative(relativeRoot, fullPath) || ".";
    const prefix = "  ".repeat(depth);
    lines.push(`${prefix}${entry.isDirectory() ? "[D]" : "[F]"} ${relPath}`);
    if (entry.isDirectory() && depth + 1 < maxDepth) {
      await buildDirectoryTree(fullPath, root, maxDepth, maxEntries, relativeRoot, depth + 1, lines);
    }
  }
  return lines;
}

function toIsoOrNull(value: Date | undefined): string | null {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null;
}

function octalMode(mode: number): string {
  return `0${(mode & 0o777).toString(8).padStart(3, "0")}`;
}

function rwxTriplet(bits: number): string {
  return `${bits & 4 ? "r" : "-"}${bits & 2 ? "w" : "-"}${bits & 1 ? "x" : "-"}`;
}

function describePermissions(mode: number): Record<string, unknown> {
  return {
    octal: octalMode(mode),
    owner: rwxTriplet((mode >> 6) & 0b111),
    group: rwxTriplet((mode >> 3) & 0b111),
    others: rwxTriplet(mode & 0b111),
    setuid: Boolean(mode & 0o4000),
    setgid: Boolean(mode & 0o2000),
    sticky: Boolean(mode & 0o1000),
  };
}

function inferMimeFromName(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".json": "application/json",
    ".jsonl": "application/x-ndjson",
    ".yaml": "application/yaml",
    ".yml": "application/yaml",
    ".csv": "text/csv",
    ".tsv": "text/tab-separated-values",
    ".xml": "application/xml",
    ".html": "text/html",
    ".htm": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".cjs": "text/javascript",
    ".ts": "text/x-typescript",
    ".tsx": "text/x-typescript",
    ".jsx": "text/jsx",
    ".py": "text/x-python",
    ".java": "text/x-java-source",
    ".c": "text/x-c",
    ".cpp": "text/x-c++",
    ".h": "text/x-c",
    ".hpp": "text/x-c++",
    ".sh": "text/x-shellscript",
    ".ps1": "text/x-powershell",
    ".bat": "application/x-bat",
    ".cmd": "application/x-bat",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".gz": "application/gzip",
    ".7z": "application/x-7z-compressed",
    ".tar": "application/x-tar",
    ".rar": "application/vnd.rar",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".exe": "application/vnd.microsoft.portable-executable",
    ".dll": "application/vnd.microsoft.portable-executable",
  };
  return map[ext] || "application/octet-stream";
}

function detectBufferType(buffer: Buffer): { detectedFileType: string | null; mimeType: string | null } {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return { detectedFileType: "png", mimeType: "image/png" };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { detectedFileType: "jpeg", mimeType: "image/jpeg" };
  if (buffer.length >= 6 && buffer.subarray(0, 6).toString("ascii") === "GIF87a") return { detectedFileType: "gif", mimeType: "image/gif" };
  if (buffer.length >= 6 && buffer.subarray(0, 6).toString("ascii") === "GIF89a") return { detectedFileType: "gif", mimeType: "image/gif" };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return { detectedFileType: "webp", mimeType: "image/webp" };
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") return { detectedFileType: "pdf", mimeType: "application/pdf" };
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) return { detectedFileType: "zip", mimeType: "application/zip" };
  if (buffer.length >= 6 && buffer[0] === 0x37 && buffer[1] === 0x7a && buffer[2] === 0xbc && buffer[3] === 0xaf && buffer[4] === 0x27 && buffer[5] === 0x1c) return { detectedFileType: "7z", mimeType: "application/x-7z-compressed" };
  if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) return { detectedFileType: "gzip", mimeType: "application/gzip" };
  if (buffer.length >= 8 && buffer.subarray(4, 8).toString("ascii") === "ftyp") return { detectedFileType: "mp4", mimeType: "video/mp4" };
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "OggS") return { detectedFileType: "ogg", mimeType: "audio/ogg" };
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "fLaC") return { detectedFileType: "flac", mimeType: "audio/flac" };
  if (buffer.length >= 3 && buffer.subarray(0, 3).toString("ascii") === "ID3") return { detectedFileType: "mp3", mimeType: "audio/mpeg" };
  return { detectedFileType: null, mimeType: null };
}

function detectEncoding(buffer: Buffer): Record<string, unknown> {
  if (buffer.length === 0) {
    return { encoding: "utf8", textLike: true, hasBom: false, lineEndings: null };
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { encoding: "utf8-bom", textLike: true, hasBom: true, lineEndings: buffer.includes(0x0d) ? "crlf_or_mixed" : "lf" };
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { encoding: "utf16le", textLike: true, hasBom: true, lineEndings: null };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return { encoding: "utf16be", textLike: true, hasBom: true, lineEndings: null };
  }
  let zeroBytes = 0;
  for (const value of buffer) {
    if (value === 0) zeroBytes += 1;
  }
  if (zeroBytes > 0) {
    return { encoding: "binary", textLike: false, hasBom: false, lineEndings: null };
  }
  const utf8Text = buffer.toString("utf8");
  const utf8RoundTrip = Buffer.from(utf8Text, "utf8");
  const utf8Exact = utf8RoundTrip.equals(buffer);
  const asciiOnly = buffer.every((value) => value === 0x09 || value === 0x0a || value === 0x0d || (value >= 0x20 && value <= 0x7e));
  return {
    encoding: asciiOnly ? "ascii" : (utf8Exact ? "utf8" : "unknown-8bit"),
    textLike: utf8Exact || asciiOnly,
    hasBom: false,
    lineEndings: buffer.includes(0x0d) ? "crlf_or_mixed" : "lf",
  };
}

export async function describePath(fullPath: string, workspaceRoot: string): Promise<Record<string, unknown>> {
  const lstat = await fsp.lstat(fullPath);
  const relativePath = path.relative(workspaceRoot, fullPath) || ".";
  const basename = path.basename(fullPath);
  const extension = path.extname(fullPath).toLowerCase();
  const isSymlink = lstat.isSymbolicLink();
  const followedStat = isSymlink ? await fsp.stat(fullPath).catch(() => null) : lstat;
  const targetPath = isSymlink ? await fsp.readlink(fullPath).catch(() => null) : null;
  const effectiveStat = followedStat || lstat;
  const isDirectory = Boolean(followedStat?.isDirectory?.() || (!isSymlink && lstat.isDirectory()));
  const isFile = Boolean(followedStat?.isFile?.() || (!isSymlink && lstat.isFile()));
  const type = isDirectory ? "directory" : isSymlink ? "symlink" : isFile ? "file" : "other";
  const permissions = describePermissions(effectiveStat.mode);
  const isHidden = basename.startsWith(".");
  const readOnly = (effectiveStat.mode & 0o222) === 0;
  let preview = Buffer.alloc(0);
  if (isFile) {
    try {
      const handle = await fsp.open(fullPath, "r");
      try {
        const probe = Buffer.alloc(Math.min(8192, Math.max(1, effectiveStat.size || 8192)));
        const { bytesRead } = await handle.read(probe, 0, probe.length, 0);
        preview = probe.subarray(0, bytesRead);
      } finally {
        await handle.close();
      }
    } catch {
      preview = Buffer.alloc(0);
    }
  }
  const detected = detectBufferType(preview);
  const encoding = detectEncoding(preview);
  return {
    path: relativePath,
    absolutePath: fullPath,
    name: basename,
    stem: path.basename(fullPath, path.extname(fullPath)),
    extension,
    type,
    fileCategory: isDirectory ? "directory" : classifyFileCategory(fullPath),
    sizeBytes: effectiveStat.size,
    created: toIsoOrNull(effectiveStat.birthtime),
    modified: toIsoOrNull(effectiveStat.mtime),
    accessed: toIsoOrNull(effectiveStat.atime),
    changed: toIsoOrNull(effectiveStat.ctime),
    modifiedMs: effectiveStat.mtimeMs,
    accessedMs: effectiveStat.atimeMs,
    changedMs: effectiveStat.ctimeMs,
    createdMs: effectiveStat.birthtimeMs,
    isDirectory,
    isFile,
    isSymlink,
    isReparsePoint: process.platform === "win32" ? isSymlink : false,
    isJunction: process.platform === "win32" ? Boolean(isSymlink && followedStat?.isDirectory?.()) : false,
    isSparseFile: typeof effectiveStat.blocks === "number" ? effectiveStat.blocks * 512 < effectiveStat.size : null,
    isHardlink: effectiveStat.nlink > 1,
    hardlinkCount: effectiveStat.nlink,
    linkTarget: targetPath,
    realPath: await fsp.realpath(fullPath).catch(() => null),
    mimeType: isDirectory ? "inode/directory" : (detected.mimeType || inferMimeFromName(fullPath)),
    detectedFileType: isDirectory ? "directory" : (detected.detectedFileType || (extension ? extension.replace(/^\./, "") : (encoding.textLike ? "text" : "binary"))),
    encoding,
    permissions,
    attributes: {
      hidden: isHidden,
      readOnly,
      executable: Boolean(effectiveStat.mode & 0o111),
      archive: null,
      system: null,
      temporary: null,
      offline: null,
      notContentIndexed: null,
      encrypted: null,
      compressed: null,
    },
    os: {
      platform: process.platform,
      uid: typeof effectiveStat.uid === "number" ? effectiveStat.uid : null,
      gid: typeof effectiveStat.gid === "number" ? effectiveStat.gid : null,
      mode: effectiveStat.mode,
      device: typeof effectiveStat.dev === "number" ? effectiveStat.dev : null,
      inode: typeof effectiveStat.ino === "number" ? effectiveStat.ino : null,
      blockSize: typeof effectiveStat.blksize === "number" ? effectiveStat.blksize : null,
      blocks: typeof effectiveStat.blocks === "number" ? effectiveStat.blocks : null,
    },
  };
}

export async function countDescendants(targetPath: string, limit: number): Promise<number> {
  let count = 0;
  const visit = async (currentPath: string): Promise<void> => {
    if (count >= limit) return;
    const entries = await fsp.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (count >= limit) break;
      count += 1;
      if (entry.isDirectory()) {
        await visit(path.join(currentPath, entry.name));
      }
    }
  };
  await visit(targetPath);
  return count;
}

export async function movePathToWorkspaceTrash(targetPath: string, workspaceRoot: string): Promise<string> {
  const trashRoot = workspaceTrashDirectory(workspaceRoot);
  await fsp.mkdir(trashRoot, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `${stamp}-${path.basename(targetPath)}`;
  let trashDestination = path.join(trashRoot, baseName);
  let suffix = 1;
  while (await fileExists(trashDestination)) {
    trashDestination = path.join(trashRoot, `${stamp}-${suffix}-${path.basename(targetPath)}`);
    suffix += 1;
  }
  await fsp.rename(targetPath, trashDestination);
  return trashDestination;
}

export async function appendOperationLog(workspaceRoot: string, entry: Record<string, unknown>): Promise<void> {
  const logPath = operationsLogPath(workspaceRoot);
  await fsp.mkdir(path.dirname(logPath), { recursive: true });
  await fsp.appendFile(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, "utf8");
}

export async function readOperationLog(workspaceRoot: string, limit: number): Promise<Record<string, unknown>[]> {
  const logPath = operationsLogPath(workspaceRoot);
  if (!await fileExists(logPath)) return [];
  const content = await fsp.readFile(logPath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  const slice = lines.slice(-limit);
  const entries: Record<string, unknown>[] = [];
  for (const line of slice) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      continue;
    }
  }
  return entries;
}

export async function overwriteMove(sourcePath: string, destinationPath: string): Promise<void> {
  await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
  if (await fileExists(destinationPath)) {
    await fsp.rm(destinationPath, { recursive: true, force: true });
  }
  await fsp.rename(sourcePath, destinationPath);
}

export async function overwriteCopy(sourcePath: string, destinationPath: string): Promise<void> {
  await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
  if (await fileExists(destinationPath)) {
    await fsp.rm(destinationPath, { recursive: true, force: true });
  }
  await fsp.cp(sourcePath, destinationPath, { recursive: true, force: true });
}

export async function captureDirectorySnapshot(
  directory: string,
  workspaceRoot: string,
  recursive: boolean,
  includeHidden: boolean,
  limit: number,
): Promise<FileWatcherSnapshotEntry[]> {
  const entries: FileWatcherSnapshotEntry[] = [];
  const visit = async (currentPath: string): Promise<void> => {
    if (entries.length >= limit) return;
    const listing = await fsp.readdir(currentPath, { withFileTypes: true });
    for (const entry of listing) {
      if (entries.length >= limit) break;
      if (!includeHidden && entry.name.startsWith(".")) continue;
      const fullPath = path.join(currentPath, entry.name);
      const stat = await fsp.lstat(fullPath);
      entries.push({
        path: path.relative(workspaceRoot, fullPath),
        type: stat.isDirectory() ? "directory" : stat.isSymbolicLink() ? "symlink" : "file",
        sizeBytes: stat.size,
        modifiedMs: stat.mtimeMs,
      });
      if (recursive && stat.isDirectory()) {
        await visit(fullPath);
      }
    }
  };
  await visit(directory);
  return entries;
}

export async function readWatcher(workspaceRoot: string, watchId: string): Promise<FileWatcherDefinition> {
  const filePath = resolveInsideDirectory(fileWatchersDirectory(workspaceRoot), `${watchId}.json`);
  const text = await fsp.readFile(filePath, "utf8");
  return JSON.parse(text) as FileWatcherDefinition;
}

export async function writeWatcher(workspaceRoot: string, watcher: FileWatcherDefinition): Promise<void> {
  const filePath = resolveInsideDirectory(fileWatchersDirectory(workspaceRoot), `${watcher.id}.json`);
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(watcher, null, 2), "utf8");
}

export function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

export function stringifyCsv(rows: string[][], delimiter = ","): string {
  return rows
    .map((row) => row.map((field) => {
      const value = String(field ?? "");
      return /["\r\n,]/.test(value) || value.includes(delimiter)
        ? `"${value.replace(/"/g, "\"\"")}"`
        : value;
    }).join(delimiter))
    .join("\n");
}

export function csvRowsToObjects(rows: string[][], hasHeader: boolean): Record<string, string>[] {
  if (!hasHeader || rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) {
      record[header[i] || `column_${i + 1}`] = row[i] ?? "";
    }
    return record;
  });
}

export function csvObjectsToRows(records: Record<string, unknown>[], includeHeader: boolean): string[][] {
  if (records.length === 0) return [];
  const header = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
  const rows = records.map((record) => header.map((key) => String(record[key] ?? "")));
  return includeHeader ? [header, ...rows] : rows;
}

export function classifyFileCategory(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".svg"].includes(ext)) return "images";
  if ([".mp4", ".mkv", ".avi", ".mov", ".wmv", ".webm"].includes(ext)) return "videos";
  if ([".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a"].includes(ext)) return "audio";
  if ([".pdf", ".doc", ".docx", ".txt", ".md", ".rtf"].includes(ext)) return "documents";
  if ([".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz"].includes(ext)) return "archives";
  if ([".json", ".yaml", ".yml", ".csv", ".tsv", ".xml"].includes(ext)) return "data";
  if ([".exe", ".msi", ".apk", ".deb", ".rpm", ".pkg"].includes(ext)) return "installers";
  return "other";
}

export function normalizeSuggestedName(filePath: string): string {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const normalized = base.replace(/[^a-z0-9 ]+/g, "").trim().replace(/\s+/g, "-");
  return normalized ? `${normalized}${ext.toLowerCase()}` : path.basename(filePath).toLowerCase();
}

export function jsonMergePatch(target: unknown, patch: unknown): unknown {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) {
    return patch;
  }
  const base = (!target || typeof target !== "object" || Array.isArray(target))
    ? {}
    : { ...(target as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete (base as Record<string, unknown>)[key];
      continue;
    }
    (base as Record<string, unknown>)[key] = jsonMergePatch((base as Record<string, unknown>)[key], value);
  }
  return base;
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export async function readMergedRecords(readPaths: string[], keyField: string): Promise<Array<Record<string, unknown>>> {
  const merged = new Map<string, Record<string, unknown>>();
  for (const filePath of readPaths) {
    const entries = await readJsonFile<Array<Record<string, unknown>>>(filePath, []);
    for (const entry of entries) {
      const key = String(entry[keyField] || "");
      if (!key) continue;
      merged.set(key, { ...entry });
    }
  }
  return [...merged.values()];
}

export function resolveDefaultToolOutputPath(
  requestedPath: string | boolean,
  toolName: string,
  detailLevel: string,
): string {
  if (requestedPath === false) return "";
  if (requestedPath === true) {
    return path.join("reports", `${toolName}-${detailLevel}.json`);
  }
  const trimmed = String(requestedPath || "").trim();
  if (trimmed.toLowerCase() === "true") {
    return path.join("reports", `${toolName}-${detailLevel}.json`);
  }
  if (trimmed.toLowerCase() === "false") {
    return "";
  }
  if (trimmed) return trimmed;
  if (detailLevel === "standard" || detailLevel === "full") {
    return path.join("reports", `${toolName}-${detailLevel}.json`);
  }
  return "";
}

export function detectStructuredFormat(filePath: string, preferred: string): "json" | "yaml" {
  if (preferred === "json" || preferred === "yaml") return preferred;
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".yaml" || ext === ".yml" ? "yaml" : "json";
}

export async function maybeWriteToolOutputToFile(
  workspaceRoot: string,
  requestedPath: string,
  payload: unknown,
  resolveWorkspacePath: (root: string, requested: string) => string,
): Promise<string | null> {
  const trimmed = String(requestedPath || "").trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\\/g, "/");
  const targetPath = normalized === "reports" || normalized.startsWith("reports/")
    ? resolveInsideDirectory(pluginDataDirectory(), normalized)
    : resolveWorkspacePath(workspaceRoot, trimmed);
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(targetPath, JSON.stringify(payload, null, 2), "utf8");
  if (targetPath.toLowerCase().startsWith(pluginDataDirectory().toLowerCase())) {
    return path.relative(pluginDataDirectory(), targetPath) || path.basename(targetPath);
  }
  return path.relative(workspaceRoot, targetPath) || path.basename(targetPath);
}
