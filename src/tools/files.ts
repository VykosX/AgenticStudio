// @ts-nocheck
import type { ToolModuleContext } from "../shared/toolModule";

const pendingEmbedCleanup = new Map<string, NodeJS.Timeout>();

export function registerFilesTools(ctx: ToolModuleContext, tools: any[]): void {
  const { tool, z, safeTool, workspaceRoot, resolveInsideWorkspace, resolveInsideDirectory, unifiedDiff, batchFileSelectionParameters, resolveBatchFileTargets, collectFiles, collectDirectories, describePath, classifyFileCategory, normalizeSuggestedName, buildDirectoryTree, pathIsDirectory, workspaceTrashDirectory, reorgPlansDirectory, fileWatchersDirectory, appendOperationLog, readOperationLog, overwriteMove, captureDirectorySnapshot, readWatcher, writeWatcher, countDescendants, movePathToWorkspaceTrash, fileExists, getWatcherDefaultLimit, getDirectoryDeleteConfirmationCount, getFileDeletionMode, requireCommandExecution, resolveExecutablePath, executeManagedCommand, quote, ctl, env, shell, timeoutMs, maxOutputBytes, computeFuzzyScore, resolveCommandPolicy, process, os, path, fsp, json } = ctx as any;

  const isTestMode = () => Boolean(resolveCommandPolicy(ctl).testMode);
  const dryRunResponse = (toolName: string, operation: string, details: Record<string, unknown> = {}) => json({
    success: true,
    testMode: true,
    dryRun: true,
    tool: toolName,
    operation,
    message: `Test Mode is enabled. ${operation} would have been performed, but no files were changed.`,
    ...details,
  });
  const fileSelectionParameters = batchFileSelectionParameters(z);
  const hasBatchSelection = (params: Record<string, unknown>) =>
    Array.isArray(params.file_list) && params.file_list.length > 0
    || Array.isArray(params.folder_list) && params.folder_list.length > 0
    || String(params.file_pattern || "").trim();
  const normalizeFsLookup = (value: string) => {
    const normalized = path.normalize(String(value || ""));
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
  };
  const scheduleEmbedCleanup = async (workspaceFilePath: string) => {
    const embedCacheDirectory = path.join(workspaceRoot, ".lmstudio-embed-cache");
    const normalizedCacheDir = normalizeFsLookup(embedCacheDirectory);
    const normalizedTarget = normalizeFsLookup(workspaceFilePath);
    if (!normalizedTarget.startsWith(`${normalizedCacheDir}${path.sep}`) && normalizedTarget !== normalizedCacheDir) {
      return;
    }
    if (pendingEmbedCleanup.has(workspaceFilePath)) {
      clearInterval(pendingEmbedCleanup.get(workspaceFilePath)!);
      pendingEmbedCleanup.delete(workspaceFilePath);
    }
    const initialStat = await fsp.lstat(workspaceFilePath).catch(() => null);
    if (!initialStat || !initialStat.isFile()) {
      return;
    }
    const initialAccessTime = initialStat ? Math.max(initialStat.atimeMs || 0, initialStat.mtimeMs || 0) : 0;
    const startedAt = Date.now();
    let accessObserved = false;
    const timer = setInterval(async () => {
      try {
        const currentStat = await fsp.lstat(workspaceFilePath).catch(() => null);
        if (!currentStat) {
          clearInterval(timer);
          pendingEmbedCleanup.delete(workspaceFilePath);
          return;
        }
        if (!currentStat.isFile()) {
          clearInterval(timer);
          pendingEmbedCleanup.delete(workspaceFilePath);
          return;
        }
        if ((currentStat.atimeMs || 0) > initialAccessTime) {
          accessObserved = true;
        }
        if (!accessObserved && Date.now() - startedAt < 60000) {
          return;
        }
        try {
          await fsp.unlink(workspaceFilePath);
          clearInterval(timer);
          pendingEmbedCleanup.delete(workspaceFilePath);
        } catch {
          if (Date.now() - startedAt > 10 * 60 * 1000) {
            clearInterval(timer);
            pendingEmbedCleanup.delete(workspaceFilePath);
          }
        }
      } catch {
        clearInterval(timer);
        pendingEmbedCleanup.delete(workspaceFilePath);
      }
    }, 2000);
    pendingEmbedCleanup.set(workspaceFilePath, timer);
  };
  const resolveTargets = (params: Record<string, unknown>, options: Record<string, unknown> = {}) => resolveBatchFileTargets({
    workspaceRoot,
    resolvePath: resolveInsideWorkspace,
    primaryPath: params.path,
    fileList: params.file_list,
    folderList: params.folder_list,
    filePattern: params.file_pattern,
    filePatternFlags: params.file_pattern_flags,
    folderRecursive: params.folder_recursive,
    includeHidden: params.include_hidden,
    fileLimit: params.file_limit,
    ...options,
  });
  const normalizeLmStudioLocalPath = (value: unknown) => {
    let raw = String(value || "").trim();
    if (!raw || /^https?:\/\//i.test(raw)) return raw;
    raw = raw.replace(/%5C/gi, "/").replace(/%2F/gi, "/");
    try {
      raw = decodeURIComponent(raw);
    } catch {}
    raw = raw.replace(/%5C/gi, "/").replace(/%2F/gi, "/").replace(/\\/g, "/");
    if (process.platform === "win32" && raw.startsWith("/") && !/^[A-Za-z]:\//.test(raw)) {
      const drive = path.parse(workspaceRoot).root.replace(/[\\/]+$/, "");
      if (drive) raw = `${drive}${raw}`;
    }
    return raw;
  };
  const normalizeDetailLevel = (value: unknown) => {
    const normalized = String(value || "compact").trim().toLowerCase();
    if (normalized === "maximum") return "max";
    return normalized === "full" || normalized === "max" ? normalized : "compact";
  };
  const compactFileEntry = (baseDirectory: string, currentPath: string, entry: any) => ({
    path: path.relative(baseDirectory, currentPath) || ".",
    name: entry.name,
    type: entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "file",
  });
  const compactPathDescription = (description: Record<string, unknown>) => Object.fromEntries(
    Object.entries({
      path: description.path,
      name: description.name,
      type: description.type,
      fileCategory: description.fileCategory,
      sizeBytes: description.sizeBytes,
      modified: description.modified,
      mimeType: description.mimeType,
    }).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );

tools.push(tool({
    name: "as_file_tree",
    description: "Return a lightweight directory tree for a workspace folder.",
    parameters: {
      directory: z.string().default("."),
      folder_list: z.array(z.string()).default([]),
      max_depth: z.number().int().min(1).max(8).default(3),
      max_entries: z.number().int().min(1).max(500).default(100),
      detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
    },
    implementation: safeTool("as_file_tree", async ({ directory, folder_list, max_depth, max_entries, detail }) => {
      const directories = Array.isArray(folder_list) && folder_list.length > 0 ? folder_list : [directory];
      const results = [];
      const detailLevel = normalizeDetailLevel(detail);
      for (const entry of directories) {
        const startDir = resolveInsideWorkspace(workspaceRoot, entry as string);
        if (!await pathIsDirectory(startDir)) {
          throw new Error("The requested path is not a directory.");
        }
        const treeLines = await buildDirectoryTree(
          startDir,
          workspaceRoot,
          max_depth as number,
          max_entries as number,
          detailLevel === "compact" ? startDir : workspaceRoot,
        );
        results.push({
          directory: path.relative(workspaceRoot, startDir) || ".",
          maxDepth: max_depth,
          maxEntries: max_entries,
          detail: detailLevel,
          entriesReturned: treeLines.length,
          tree: treeLines,
        });
      }
      return json(results.length === 1 ? results[0] : { count: results.length, results });
    }),
  }));

tools.push(tool({
    name: "as_file_list",
    description: "List files and folders in a directory with metadata, optionally recursively.",
    parameters: {
      directory: z.string().default("."),
      folder_list: z.array(z.string()).default([]),
      recursive: z.boolean().default(false),
      limit: z.number().int().min(1).max(5000).default(200),
      detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
    },
    implementation: safeTool("as_file_list", async ({ directory, folder_list, recursive, limit, detail }) => {
      const directories = Array.isArray(folder_list) && folder_list.length > 0 ? folder_list : [directory];
      const detailLevel = normalizeDetailLevel(detail);
      const results: Array<Record<string, unknown>> = [];
      const visit = async (baseDir: string, currentDir: string): Promise<void> => {
        if (results.length >= (limit as number)) return;
        const entries = await fsp.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= (limit as number)) break;
          const fullPath = path.join(currentDir, entry.name);
          if (detailLevel === "compact") {
            results.push(compactFileEntry(baseDir, fullPath, entry));
          } else {
            results.push(await describePath(fullPath, workspaceRoot));
          }
          if (recursive && entry.isDirectory()) {
            await visit(baseDir, fullPath);
          }
        }
      };
      const listedDirectories = [];
      for (const entry of directories) {
        if (results.length >= (limit as number)) break;
        const startDir = String(entry) === ":workspace_trash:"
          ? workspaceTrashDirectory(workspaceRoot)
          : resolveInsideWorkspace(workspaceRoot, entry as string);
        if (!await pathIsDirectory(startDir)) {
          throw new Error("The requested path is not a directory.");
        }
        listedDirectories.push(String(entry) === ":workspace_trash:" ? ":workspace_trash:" : (path.relative(workspaceRoot, startDir) || "."));
        await visit(startDir, startDir);
      }
      return json({
        directory: listedDirectories[0] || ".",
        directories: listedDirectories,
        recursive,
        limit,
        detail: detailLevel,
        count: results.length,
        entries: results,
      });
    }),
  }));

tools.push(tool({
    name: "as_file_metadata",
    description: "Return rich metadata for one or more files or directories. Prefer the default parameters unless a task explicitly needs something else. Use detailed=true only when you specifically need extra exiftool metadata.",
    parameters: {
      path: z.string().default(""),
      ...fileSelectionParameters,
      detailed: z.boolean().default(false),
      detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
    },
    implementation: safeTool("as_file_metadata", async (params) => {
      const detailLevel = normalizeDetailLevel(params.detail);
      const targets = await resolveTargets(params, { requireFiles: false, includeDirectories: true });
      const results = [];
      const fullDescriptions = [];
      for (const target of targets) {
        const description = await describePath(target.fullPath, workspaceRoot);
        fullDescriptions.push(description);
        results.push(detailLevel === "compact" ? compactPathDescription(description) : description);
      }
      if (params.detailed) {
        requireCommandExecution();
        const fileTargets = targets.filter((target, index) => Boolean(fullDescriptions[index]?.isFile));
        let enrichedCount = 0;
        if (fileTargets.length > 0) {
          let exiftoolPath: string | null = null;
          try {
            exiftoolPath = await resolveExecutablePath(ctl, env, "exiftoolPath", "exiftool");
          } catch {
            exiftoolPath = null;
          }
          if (exiftoolPath) {
            const command = `${quote(exiftoolPath)} -json ${fileTargets.map((target) => quote(target.fullPath)).join(" ")}`;
            const exifResult = await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
            if (!exifResult.error && exifResult.stdout) {
              const parsed = JSON.parse(exifResult.stdout);
              const bySource = new Map<string, Record<string, unknown>>();
              for (const entry of Array.isArray(parsed) ? parsed : []) {
                const source = typeof entry?.SourceFile === "string" ? entry.SourceFile : "";
                if (source) bySource.set(normalizeFsLookup(source), entry);
              }
              for (const result of results) {
                if (detailLevel === "compact") continue;
                const source = normalizeFsLookup(String(result.absolutePath || ""));
                const extra = bySource.get(source);
                if (!extra) continue;
                enrichedCount += 1;
                for (const [key, value] of Object.entries(extra)) {
                  if (key === "SourceFile" || key in result) continue;
                  result[key] = value;
                }
                result.exiftoolEnriched = true;
              }
              for (const result of results) {
                if (detailLevel === "compact") continue;
                if (!("exiftoolEnriched" in result)) result.exiftoolEnriched = false;
              }
            } else {
              for (const result of results) {
                if (detailLevel === "compact") continue;
                result.exiftoolEnriched = false;
                result.exiftoolWarning = exifResult.error || exifResult.stderr || "exiftool did not return metadata.";
              }
            }
          } else {
            for (const result of results) {
              if (detailLevel === "compact") continue;
              result.exiftoolEnriched = false;
              result.exiftoolWarning = "exiftool is not available, so detailed metadata enrichment was skipped.";
            }
          }
          for (const result of results) {
            result.detailedRequested = true;
            if (detailLevel !== "compact") {
              result.exiftoolMatchCount = enrichedCount;
            }
          }
        } else {
          for (const result of results) {
            result.detailedRequested = true;
            if (detailLevel !== "compact") {
              result.exiftoolEnriched = false;
              result.exiftoolWarning = "detailed=true was requested, but no regular file targets were available for exiftool enrichment.";
            }
          }
        }
      }
      return json(results.length === 1 ? { detail: detailLevel, ...results[0] } : { detail: detailLevel, count: results.length, results });
    }),
  }));

tools.push(tool({
    name: "as_file_mkdir",
    description: "Create a directory and any missing parent directories.",
    parameters: {
      path: z.string(),
    },
    implementation: safeTool("as_file_mkdir", async ({ path: relPath }) => {
      const fullPath = resolveInsideWorkspace(workspaceRoot, relPath as string);
      if (isTestMode()) {
        return dryRunResponse("as_file_mkdir", "Create directory", {
          path: path.relative(workspaceRoot, fullPath),
        });
      }
      await fsp.mkdir(fullPath, { recursive: true });
      return json({ success: true, path: path.relative(workspaceRoot, fullPath) });
    }),
  }));

tools.push(tool({
    name: "as_file_copy",
    description: "Copy one or more files or directories within the workspace.",
    parameters: {
      source: z.string().default(""),
      destination: z.string(),
      overwrite: z.boolean().default(false),
      ...fileSelectionParameters,
    },
    implementation: safeTool("as_file_copy", async (params) => {
      const { source, destination, overwrite } = params;
      const sources = await resolveBatchFileTargets({
        workspaceRoot,
        resolvePath: resolveInsideWorkspace,
        primaryPath: source,
        primaryPathName: "source",
        fileList: params.file_list,
        folderList: params.folder_list,
        filePattern: params.file_pattern,
        filePatternFlags: params.file_pattern_flags,
        folderRecursive: params.folder_recursive,
        includeHidden: params.include_hidden,
        fileLimit: params.file_limit,
        requireFiles: false,
        includeDirectories: true,
      });
      const destinationPath = resolveInsideWorkspace(workspaceRoot, destination as string);
      const batchMode = sources.length > 1 || hasBatchSelection(params);
      if (batchMode && await fileExists(destinationPath) && !await pathIsDirectory(destinationPath)) {
        throw new Error("Destination must be a directory when copying multiple sources.");
      }
      if (isTestMode()) {
        return dryRunResponse("as_file_copy", "Copy file or directory", {
          count: sources.length,
          sources: sources.map((entry) => entry.relativePath),
          destination: path.relative(workspaceRoot, destinationPath),
          overwrite: overwrite as boolean,
        });
      }
      const results = [];
      for (const target of sources) {
        const targetDestination = batchMode ? path.join(destinationPath, path.basename(target.fullPath)) : destinationPath;
        if (await fileExists(targetDestination) && !overwrite) {
          results.push({ source: target.relativePath, destination: path.relative(workspaceRoot, targetDestination), status: "skipped", reason: "Destination exists." });
          continue;
        }
        await fsp.mkdir(path.dirname(targetDestination), { recursive: true });
        await fsp.cp(target.fullPath, targetDestination, { recursive: true, force: overwrite as boolean, errorOnExist: !(overwrite as boolean) });
        await appendOperationLog(workspaceRoot, {
          tool: "as_file_copy",
          source: target.relativePath,
          destination: path.relative(workspaceRoot, targetDestination),
          overwrite: overwrite as boolean,
          undo: {
            strategy: "delete_destination",
            destination: path.relative(workspaceRoot, targetDestination),
          },
        });
        results.push({ source: target.relativePath, destination: path.relative(workspaceRoot, targetDestination), status: "copied" });
      }
      return json({
        success: true,
        count: results.length,
        results,
      });
    }),
  }));

tools.push(tool({
    name: "as_file_move",
    description: "Move or rename one or more files or directories within the workspace.",
    parameters: {
      source: z.string().default(""),
      destination: z.string(),
      overwrite: z.boolean().default(false),
      ...fileSelectionParameters,
    },
    implementation: safeTool("as_file_move", async (params) => {
      const { source, destination, overwrite } = params;
      const sources = await resolveBatchFileTargets({
        workspaceRoot,
        resolvePath: resolveInsideWorkspace,
        primaryPath: source,
        primaryPathName: "source",
        fileList: params.file_list,
        folderList: params.folder_list,
        filePattern: params.file_pattern,
        filePatternFlags: params.file_pattern_flags,
        folderRecursive: params.folder_recursive,
        includeHidden: params.include_hidden,
        fileLimit: params.file_limit,
        requireFiles: false,
        includeDirectories: true,
      });
      const destinationPath = resolveInsideWorkspace(workspaceRoot, destination as string);
      const batchMode = sources.length > 1 || hasBatchSelection(params);
      if (batchMode && await fileExists(destinationPath) && !await pathIsDirectory(destinationPath)) {
        throw new Error("Destination must be a directory when moving multiple sources.");
      }
      if (isTestMode()) {
        return dryRunResponse("as_file_move", "Move or rename file or directory", {
          count: sources.length,
          sources: sources.map((entry) => entry.relativePath),
          destination: path.relative(workspaceRoot, destinationPath),
          overwrite: overwrite as boolean,
        });
      }
      const results = [];
      for (const target of sources) {
        const targetDestination = batchMode ? path.join(destinationPath, path.basename(target.fullPath)) : destinationPath;
        if (await fileExists(targetDestination)) {
          if (!overwrite) {
            results.push({ source: target.relativePath, destination: path.relative(workspaceRoot, targetDestination), status: "skipped", reason: "Destination exists." });
            continue;
          }
          await fsp.rm(targetDestination, { recursive: true, force: true });
        }
        await fsp.mkdir(path.dirname(targetDestination), { recursive: true });
        await fsp.rename(target.fullPath, targetDestination);
        await appendOperationLog(workspaceRoot, {
          tool: "as_file_move",
          source: target.relativePath,
          destination: path.relative(workspaceRoot, targetDestination),
          overwrite: overwrite as boolean,
          undo: {
            strategy: "move_back",
            source: path.relative(workspaceRoot, targetDestination),
            destination: target.relativePath,
          },
        });
        results.push({ source: target.relativePath, destination: path.relative(workspaceRoot, targetDestination), status: "moved" });
      }
      return json({
        success: true,
        count: results.length,
        results,
      });
    }),
  }));

tools.push(tool({
    name: "as_file_set_times",
    description: "Set access and modification times on one or more files or directories.",
    parameters: {
      path: z.string().default(""),
      modified_iso: z.string().default(""),
      accessed_iso: z.string().default(""),
      ...fileSelectionParameters,
    },
    implementation: safeTool("as_file_set_times", async (params) => {
      const { modified_iso, accessed_iso } = params;
      const targets = await resolveTargets(params, { requireFiles: false, includeDirectories: true });
      const planned = [];
      for (const target of targets) {
        const currentStat = await fsp.stat(target.fullPath);
        const modified = modified_iso ? new Date(modified_iso as string) : currentStat.mtime;
        const accessed = accessed_iso ? new Date(accessed_iso as string) : currentStat.atime;
        if (Number.isNaN(modified.getTime()) || Number.isNaN(accessed.getTime())) {
          throw new Error("Invalid ISO timestamp.");
        }
        planned.push({ target, modified, accessed });
      }
      if (isTestMode()) {
        return dryRunResponse("as_file_set_times", "Set file or directory timestamps", {
          count: planned.length,
          targets: planned.map((entry) => ({
            path: entry.target.relativePath,
            modified: entry.modified.toISOString(),
            accessed: entry.accessed.toISOString(),
          })),
        });
      }
      const results = [];
      for (const entry of planned) {
        await fsp.utimes(entry.target.fullPath, entry.accessed, entry.modified);
        results.push({
          path: entry.target.relativePath,
          modified: entry.modified.toISOString(),
          accessed: entry.accessed.toISOString(),
        });
      }
      return json({
        success: true,
        count: results.length,
        results,
      });
    }),
  }));

tools.push(tool({
    name: "as_file_link",
    description: "Create one or more symlinks, hardlinks, or NTFS junctions inside the workspace.",
    parameters: {
      target: z.string().default(""),
      link_path: z.string(),
      link_type: z.enum(["symlink", "hardlink", "junction"]).default("symlink"),
      ...fileSelectionParameters,
    },
    implementation: safeTool("as_file_link", async (params) => {
      const { target, link_path, link_type } = params;
      const targets = await resolveBatchFileTargets({
        workspaceRoot,
        resolvePath: resolveInsideWorkspace,
        primaryPath: target,
        primaryPathName: "target",
        fileList: params.file_list,
        folderList: params.folder_list,
        filePattern: params.file_pattern,
        filePatternFlags: params.file_pattern_flags,
        folderRecursive: params.folder_recursive,
        includeHidden: params.include_hidden,
        fileLimit: params.file_limit,
        requireFiles: link_type === "hardlink",
        includeDirectories: link_type !== "hardlink",
      });
      const linkPath = resolveInsideWorkspace(workspaceRoot, link_path as string);
      const batchMode = targets.length > 1 || hasBatchSelection(params);
      if (batchMode && await fileExists(linkPath) && !await pathIsDirectory(linkPath)) {
        throw new Error("link_path must be a directory when creating links for multiple targets.");
      }
      if (isTestMode()) {
        return dryRunResponse("as_file_link", "Create filesystem link", {
          count: targets.length,
          targets: targets.map((entry) => entry.relativePath),
          linkPath: path.relative(workspaceRoot, linkPath),
          linkType: link_type,
        });
      }
      const results = [];
      for (const entry of targets) {
        const destinationLink = batchMode ? path.join(linkPath, path.basename(entry.fullPath)) : linkPath;
        if (await fileExists(destinationLink)) {
          results.push({ target: entry.relativePath, link: path.relative(workspaceRoot, destinationLink), status: "skipped", reason: "Link path already exists." });
          continue;
        }
        await fsp.mkdir(path.dirname(destinationLink), { recursive: true });
        if (link_type === "hardlink") {
          const targetStat = await fsp.stat(entry.fullPath);
          if (!targetStat.isFile()) {
            throw new Error("Hardlinks are only supported for files.");
          }
          await fsp.link(entry.fullPath, destinationLink);
        } else {
          const symlinkType = link_type === "junction"
            ? "junction"
            : ((await pathIsDirectory(entry.fullPath)) ? "dir" : "file");
          await fsp.symlink(entry.fullPath, destinationLink, symlinkType as any);
        }
        results.push({ target: entry.relativePath, link: path.relative(workspaceRoot, destinationLink), linkType: link_type, status: "linked" });
      }
      return json({
        success: true,
        count: results.length,
        results,
      });
    }),
  }));

tools.push(tool({
    name: "as_file_delete",
    description: "Delete or trash one or more files or directories. Large directory deletions require confirmed=true.",
    parameters: {
      path: z.string().default(""),
      recursive: z.boolean().default(true),
      confirmed: z.boolean().default(false),
      ...fileSelectionParameters,
    },
    implementation: safeTool("as_file_delete", async (params) => {
      const { recursive, confirmed } = params;
      const targets = await resolveTargets(params, { requireFiles: false, includeDirectories: true });
      const deletionMode = getFileDeletionMode(ctl);
      const planned = [];
      for (const target of targets) {
        const stat = await fsp.lstat(target.fullPath);
        if (stat.isDirectory() && !recursive) {
          throw new Error(`Target is a directory and recursive is false: ${target.relativePath}`);
        }
        let descendantCount = 0;
        if (stat.isDirectory()) {
          descendantCount = await countDescendants(target.fullPath, getDirectoryDeleteConfirmationCount(ctl));
          if (descendantCount >= getDirectoryDeleteConfirmationCount(ctl) && !confirmed) {
            return json({
              success: false,
              requiresConfirmation: true,
              deletionMode,
              path: target.relativePath,
              descendantCount,
              threshold: getDirectoryDeleteConfirmationCount(ctl),
              message: "Directory deletion threshold reached. Re-run with confirmed=true to proceed.",
            });
          }
        }
        planned.push({ target, stat, descendantCount });
      }
      if (isTestMode()) {
        return dryRunResponse("as_file_delete", deletionMode === "trash" ? "Move file or directory to workspace trash" : "Delete file or directory", {
          count: planned.length,
          paths: planned.map((entry) => entry.target.relativePath),
          recursive,
          confirmed,
          deletionMode,
        });
      }
      const results = [];
      for (const entry of planned) {
        let trashedTo: string | null = null;
        let trashName: string | null = null;
        if (deletionMode === "trash") {
          trashedTo = await movePathToWorkspaceTrash(entry.target.fullPath, workspaceRoot);
          trashName = path.basename(trashedTo);
        } else {
          await fsp.rm(entry.target.fullPath, { recursive: true, force: true });
        }
        await appendOperationLog(workspaceRoot, {
          tool: "as_file_delete",
          path: entry.target.relativePath,
          deletionMode,
          trashedTo: trashName,
          descendantCount: entry.descendantCount,
          undo: trashedTo ? {
            strategy: "restore_from_trash",
            trashName,
            destination: entry.target.relativePath,
          } : null,
        });
        results.push({
          path: entry.target.relativePath,
          deletionMode,
          trashName,
          descendantCount: entry.descendantCount,
        });
      }
      return json({
        success: true,
        count: results.length,
        deletionMode,
        results,
      });
    }),
  }));

tools.push(tool({
    name: "as_file_trash_list",
    description: "List items currently stored in agentic-studio workspace trash.",
    parameters: {
      limit: z.number().int().min(1).max(1000).default(200),
    },
    implementation: safeTool("as_file_trash_list", async ({ limit }) => {
      const trashDir = workspaceTrashDirectory(workspaceRoot);
      if (!await fileExists(trashDir)) {
        return json({ items: [] });
      }
      const entries = await fsp.readdir(trashDir, { withFileTypes: true });
      const items = [];
      for (const entry of entries.slice(0, limit as number)) {
        const fullPath = path.join(trashDir, entry.name);
        const description = await describePath(fullPath, workspaceRoot);
        items.push({ ...description, trashName: entry.name });
      }
      return json({ trashDirectory: trashDir, items });
    }),
  }));

tools.push(tool({
    name: "as_file_trash_restore",
    description: "Restore an item from workspace trash to a destination path.",
    parameters: {
      trash_name: z.string(),
      destination: z.string(),
      overwrite: z.boolean().default(false),
    },
    implementation: safeTool("as_file_trash_restore", async ({ trash_name, destination, overwrite }) => {
      const trashPath = resolveInsideDirectory(workspaceTrashDirectory(workspaceRoot), trash_name as string);
      if (!await fileExists(trashPath)) throw new Error("Trash item not found.");
      const destinationPath = resolveInsideWorkspace(workspaceRoot, destination as string);
      if (await fileExists(destinationPath) && !overwrite) {
        throw new Error("Destination already exists and overwrite is false.");
      }
      if (isTestMode()) {
        return dryRunResponse("as_file_trash_restore", "Restore item from workspace trash", {
          trashName: trash_name,
          destination: path.relative(workspaceRoot, destinationPath),
          overwrite: overwrite as boolean,
        });
      }
      if (await fileExists(destinationPath) && overwrite) {
        await fsp.rm(destinationPath, { recursive: true, force: true });
      }
      await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
      await fsp.rename(trashPath, destinationPath);
      await appendOperationLog(workspaceRoot, {
        tool: "as_file_trash_restore",
        trashName: trash_name,
        destination: path.relative(workspaceRoot, destinationPath),
        undo: {
          strategy: "move_to_trash_name",
          source: path.relative(workspaceRoot, destinationPath),
          trashName: trash_name,
        },
      });
      return json({
        success: true,
        destination: path.relative(workspaceRoot, destinationPath),
      });
    }),
  }));

tools.push(tool({
    name: "as_file_operations_log",
    description: "Read recent agentic-studio file operation log entries.",
    parameters: {
      limit: z.number().int().min(1).max(2000).default(200),
    },
    implementation: safeTool("as_file_operations_log", async ({ limit }) => {
      const entries = await readOperationLog(workspaceRoot, limit as number);
      return json({ entries });
    }),
  }));

tools.push(tool({
    name: "as_file_undo",
    description: "Undo one or more supported file operations from agentic-studio history by index, where 0 is the most recent undoable operation.",
    parameters: {
      index: z.number().int().min(0).max(999).default(0),
      indexes: z.array(z.number().int().min(0).max(999)).default([]),
    },
    implementation: safeTool("as_file_undo", async ({ index, indexes }) => {
      const entries = await readOperationLog(workspaceRoot, 100);
      const undoableEntries = [...entries].reverse().filter((entry) => entry.undo && typeof entry.undo === "object");
      const requestedIndexes = Array.from(new Set((Array.isArray(indexes) && indexes.length > 0 ? indexes : [index]).map((value) => Number(value))));
      if (requestedIndexes.length === 0) {
        return json({ success: false, undoableCount: undoableEntries.length, message: "Provide index or indexes." });
      }
      const selectedEntries = requestedIndexes.map((requestedIndex) => ({
        index: requestedIndex,
        entry: undoableEntries[requestedIndex],
      }));
      const missingIndexes = selectedEntries.filter((item) => !item.entry).map((item) => item.index);
      if (missingIndexes.length > 0) {
        return json({
          success: false,
          indexes: requestedIndexes,
          missingIndexes,
          undoableCount: undoableEntries.length,
          message: "One or more requested undo indexes were not found.",
        });
      }

      const applyUndo = async (historyIndex: number, last: Record<string, unknown>) => {
        const undo = last.undo as Record<string, unknown>;
        const strategy = String(undo.strategy || "");
        if (isTestMode()) {
          return {
            success: true,
            dryRun: true,
            index: historyIndex,
            reversedTool: last.tool || null,
            strategy,
          };
        }
        if (strategy === "move_back") {
          const sourcePath = resolveInsideWorkspace(workspaceRoot, String(undo.source || ""));
          const destinationPath = resolveInsideWorkspace(workspaceRoot, String(undo.destination || ""));
          if (!await fileExists(sourcePath)) throw new Error("Undo source path no longer exists.");
          await overwriteMove(sourcePath, destinationPath);
        } else if (strategy === "delete_destination") {
          const destinationPath = resolveInsideWorkspace(workspaceRoot, String(undo.destination || ""));
          if (await fileExists(destinationPath)) {
            await fsp.rm(destinationPath, { recursive: true, force: true });
          }
        } else if (strategy === "restore_from_trash") {
          const legacyTrashPath = String(undo.trashPath || "");
          const trashName = String(undo.trashName || (legacyTrashPath ? path.basename(legacyTrashPath) : ""));
          const trashPath = resolveInsideDirectory(workspaceTrashDirectory(workspaceRoot), trashName);
          const destinationPath = resolveInsideWorkspace(workspaceRoot, String(undo.destination || ""));
          if (!await fileExists(trashPath)) throw new Error("Trash source for undo no longer exists.");
          await overwriteMove(trashPath, destinationPath);
        } else if (strategy === "move_to_trash_name") {
          const sourcePath = resolveInsideWorkspace(workspaceRoot, String(undo.source || ""));
          const trashPath = resolveInsideDirectory(workspaceTrashDirectory(workspaceRoot), String(undo.trashName || ""));
          if (!await fileExists(sourcePath)) throw new Error("Undo source path no longer exists.");
          await overwriteMove(sourcePath, trashPath);
        } else if (strategy === "reverse_moves") {
          const moves = Array.isArray(undo.moves) ? undo.moves as Array<Record<string, unknown>> : [];
          const applied: Array<Record<string, unknown>> = [];
          for (const move of moves) {
            const sourcePath = resolveInsideWorkspace(workspaceRoot, String(move.source || ""));
            const destinationPath = resolveInsideWorkspace(workspaceRoot, String(move.destination || ""));
            if (!await fileExists(sourcePath)) continue;
            await overwriteMove(sourcePath, destinationPath);
            applied.push({
              source: path.relative(workspaceRoot, sourcePath),
              destination: path.relative(workspaceRoot, destinationPath),
            });
          }
          await appendOperationLog(workspaceRoot, {
            tool: "as_file_undo",
            index: historyIndex,
            reversedTool: last.tool || null,
            strategy,
            applied,
          });
          return { success: true, index: historyIndex, reversedTool: last.tool || null, strategy, applied };
        } else if (strategy === "reverse_batch_rename") {
          const renames = Array.isArray(undo.renames) ? undo.renames as Array<Record<string, unknown>> : [];
          const reversed: Array<Record<string, unknown>> = [];
          for (const rename of renames) {
            const currentPath = resolveInsideWorkspace(workspaceRoot, String(rename.current || ""));
            const previousPath = resolveInsideWorkspace(workspaceRoot, String(rename.previous || ""));
            if (!await fileExists(currentPath)) continue;
            await overwriteMove(currentPath, previousPath);
            reversed.push({
              from: path.relative(workspaceRoot, currentPath),
              to: path.relative(workspaceRoot, previousPath),
            });
          }
          await appendOperationLog(workspaceRoot, {
            tool: "as_file_undo",
            index: historyIndex,
            reversedTool: last.tool || null,
            strategy,
            reversed,
          });
          return { success: true, index: historyIndex, reversedTool: last.tool || null, strategy, reversed };
        } else {
          return { success: false, index: historyIndex, reversedTool: last.tool || null, strategy, message: `Undo strategy '${strategy}' is not supported.` };
        }
        await appendOperationLog(workspaceRoot, {
          tool: "as_file_undo",
          index: historyIndex,
          reversedTool: last.tool || null,
          strategy,
        });
        return { success: true, index: historyIndex, reversedTool: last.tool || null, strategy };
      };

      const results = [];
      for (const selected of selectedEntries) {
        results.push(await applyUndo(selected.index, selected.entry as Record<string, unknown>));
      }
      return json({
        success: results.every((entry) => entry.success !== false),
        count: results.length,
        indexes: requestedIndexes,
        results,
      });
    }),
  }));

tools.push(tool({
    name: "as_file_rename",
    description: "Preview or apply advanced single or batch file/folder renaming with ordered rules, recursion, filters, numbering, timestamps, case transforms, regex/string replacements, collision handling, and undo logging.",
    parameters: {
      directory: z.string().default("."),
      paths_json: z.string().default(""),
      file_list: z.array(z.string()).default([]),
      folder_list: z.array(z.string()).default([]),
      file_pattern: z.string().default(""),
      file_pattern_flags: z.string().default(""),
      folder_recursive: z.boolean().default(true),
      recursive: z.boolean().default(false),
      include_files: z.boolean().default(true),
      include_directories: z.boolean().default(false),
      include_hidden: z.boolean().default(false),
      file_extensions: z.string().default(""),
      match_pattern: z.string().default(""),
      match_regex: z.boolean().default(false),
      rules_json: z.string(),
      sort_by: z.enum(["path", "name", "created", "modified", "size"]).default("path"),
      sort_direction: z.enum(["asc", "desc"]).default("asc"),
      collision_strategy: z.enum(["error", "skip", "append_counter"]).default("error"),
      invalid_character_strategy: z.enum(["error", "unicode_variants", "replacement"]).default("error"),
      invalid_character_replacement: z.string().default("-"),
      preview: z.boolean().default(true),
      limit: z.number().int().min(1).max(20000).default(1000),
    },
    implementation: safeTool("as_file_rename", async ({ directory, paths_json, file_list, folder_list, file_pattern, file_pattern_flags, folder_recursive, recursive, include_files, include_directories, include_hidden, file_extensions, match_pattern, match_regex, rules_json, sort_by, sort_direction, collision_strategy, invalid_character_strategy, invalid_character_replacement, preview, limit }) => {
      const parseRules = (raw: string) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch (error) {
          throw new Error(`rules_json must be valid JSON: ${(error as Error).message}`);
        }
        const rules = Array.isArray(parsed) ? parsed : [parsed];
        if (rules.length === 0 || rules.some((rule) => !rule || typeof rule !== "object" || Array.isArray(rule))) {
          throw new Error("rules_json must be a rule object or a non-empty array of rule objects.");
        }
        return rules as Array<Record<string, unknown>>;
      };

      const pad = (value: number, width: number) => String(value).padStart(Math.max(0, width), "0");
      const formatDate = (date: Date, format: string) => {
        const tokens: Record<string, string> = {
          yyyy: String(date.getFullYear()),
          yy: String(date.getFullYear()).slice(-2),
          MM: pad(date.getMonth() + 1, 2),
          dd: pad(date.getDate(), 2),
          HH: pad(date.getHours(), 2),
          mm: pad(date.getMinutes(), 2),
          ss: pad(date.getSeconds(), 2),
          SSS: pad(date.getMilliseconds(), 3),
        };
        return String(format || "yyyyMMdd-HHmmss").replace(/yyyy|yy|MM|dd|HH|mm|ss|SSS/g, (token) => tokens[token] || token);
      };

      const stripDiacritics = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
      const clampIndex = (index: number, length: number) => Math.max(0, Math.min(length, Number.isFinite(index) ? index : length));
      const toWords = (value: string) => stripDiacritics(value).trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
      const caseTransform = (value: string, mode: string) => {
        if (mode === "lower") return value.toLowerCase();
        if (mode === "upper") return value.toUpperCase();
        if (mode === "title") return value.toLowerCase().replace(/\b([a-z0-9])/g, (match) => match.toUpperCase());
        if (mode === "sentence") return value.toLowerCase().replace(/^(\s*[a-z0-9])/, (match) => match.toUpperCase());
        if (mode === "camel") {
          const words = toWords(value);
          return words.map((word, index) => index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");
        }
        if (mode === "pascal") return toWords(value).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");
        if (mode === "snake") return toWords(value).map((word) => word.toLowerCase()).join("_");
        if (mode === "kebab") return toWords(value).map((word) => word.toLowerCase()).join("-");
        return value;
      };

      const normalizeName = (value: string, style: string) => {
        let next = stripDiacritics(value);
        if (style === "spaces") return next.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
        if (style === "ascii") return next.replace(/[^\x20-\x7E]+/g, "").trim();
        if (style === "lower") return next.toLowerCase();
        if (style === "safe") return next.replace(/[<>:"/\\|?*\x00-\x1F]+/g, "-").replace(/\s+/g, " ").trim();
        return next
          .toLowerCase()
          .replace(/&/g, " and ")
          .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "-")
          .replace(/[^a-z0-9._ -]+/g, "")
          .replace(/[\s_]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^[.\s-]+|[.\s-]+$/g, "");
      };

      const applyReplacement = (value: string, rule: Record<string, unknown>, replacementOverride?: string) => {
        const patternText = String(rule.pattern ?? rule.search ?? "");
        if (!patternText) return value;
        const replacementText = String(replacementOverride ?? rule.replacement ?? rule.replace ?? "");
        if (rule.regex === true) {
          const caseInsensitive = rule.case_sensitive === false ? "i" : "";
          return value.replace(new RegExp(patternText, `g${caseInsensitive}`), replacementText);
        }
        return value.split(patternText).join(replacementText);
      };

      const sanitizeInvalidFileNameCharacters = (value: string) => {
        const strategy = String(invalid_character_strategy || "error");
        if (strategy === "error") return value;
        const replacement = String(invalid_character_replacement ?? "-");
        if (strategy === "replacement") {
          const replaced = value
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, replacement)
            .replace(/[. ]+$/g, replacement);
          if (!replacement) return replaced;
          return replaced.replace(new RegExp(`${replacement.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}{2,}`, "g"), replacement);
        }
        const unicodeMap: Record<string, string> = {
          "<": "\uFF1C",
          ">": "\uFF1E",
          ":": "\uFF1A",
          "\"": "\uFF02",
          "/": "\u29F8",
          "\\": "\u29F9",
          "|": "\uFF5C",
          "?": "\uFF1F",
          "*": "\uFF0A",
        };
        return value
          .replace(/[<>:"/\\|?*]/g, (char) => unicodeMap[char] || char)
          .replace(/[\x00-\x1F]/g, "")
          .replace(/[. ]+$/g, (suffix) => suffix.replace(/\./g, "\uFF0E").replace(/ /g, "\u3000"));
      };

      const rules = parseRules(rules_json as string);
      const rootDir = resolveInsideWorkspace(workspaceRoot, directory as string);
      const extensionSet = new Set(String(file_extensions || "")
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
        .map((entry) => entry.startsWith(".") ? entry : `.${entry}`));

      const matcher = String(match_pattern || "").trim()
        ? (match_regex
          ? new RegExp(match_pattern as string)
          : null)
        : null;
      const selectionMatcher = String(file_pattern || "").trim()
        ? new RegExp(file_pattern as string, String(file_pattern_flags || "").replace(/[^dgimsuy]/g, ""))
        : null;

      const seenSources = new Set<string>();
      const candidates: Array<Record<string, any>> = [];
      const addCandidate = async (fullPath: string) => {
        const resolved = resolveInsideWorkspace(workspaceRoot, path.relative(workspaceRoot, fullPath));
        const key = resolved.toLowerCase();
        if (seenSources.has(key)) return;
        seenSources.add(key);
        const stat = await fsp.lstat(resolved);
        const isDirectory = stat.isDirectory();
        if (isDirectory && !include_directories) return;
        if (!isDirectory && !include_files) return;
        const relPath = path.relative(workspaceRoot, resolved);
        const base = path.basename(resolved);
        if (!include_hidden && base.startsWith(".")) return;
        if (!isDirectory && extensionSet.size > 0 && !extensionSet.has(path.extname(base).toLowerCase())) return;
        if (selectionMatcher) {
          const haystack = `${relPath}\n${base}`;
          selectionMatcher.lastIndex = 0;
          const matches = selectionMatcher.test(haystack);
          selectionMatcher.lastIndex = 0;
          if (!matches) return;
        }
        if (String(match_pattern || "").trim()) {
          const haystack = `${relPath}\n${base}`;
          const matches = matcher ? matcher.test(haystack) : haystack.toLowerCase().includes(String(match_pattern).toLowerCase());
          if (matcher) matcher.lastIndex = 0;
          if (!matches) return;
        }
        candidates.push({ fullPath: resolved, relPath, stat, isDirectory, base });
      };

      const hasExplicitSelection = String(paths_json || "").trim()
        || (Array.isArray(file_list) && file_list.length > 0)
        || (Array.isArray(folder_list) && folder_list.length > 0);
      if (hasExplicitSelection) {
        const selectedTargets = await resolveBatchFileTargets({
          workspaceRoot,
          resolvePath: resolveInsideWorkspace,
          fileList: file_list,
          folderList: folder_list,
          legacyList: paths_json,
          legacyListName: "paths_json",
          filePattern: file_pattern,
          filePatternFlags: file_pattern_flags,
          folderRecursive: folder_recursive,
          includeHidden: include_hidden,
          fileLimit: limit,
          requireFiles: false,
          includeDirectories: true,
        });
        for (const target of selectedTargets) {
          await addCandidate(target.fullPath);
        }
      } else {
        if (!await pathIsDirectory(rootDir)) throw new Error("directory must point to an existing directory when paths_json is not provided.");
        if (include_files) {
          for (const filePath of await collectFiles(rootDir, limit as number, [], recursive as boolean)) {
            await addCandidate(filePath);
          }
        }
        if (include_directories) {
          const remaining = Math.max(0, (limit as number) - candidates.length);
          for (const directoryPath of await collectDirectories(rootDir, remaining, [], recursive as boolean)) {
            await addCandidate(directoryPath);
          }
        }
      }

      const sortMultiplier = sort_direction === "desc" ? -1 : 1;
      candidates.sort((left, right) => {
        let comparison = 0;
        if (sort_by === "name") comparison = left.base.localeCompare(right.base);
        else if (sort_by === "created") comparison = left.stat.birthtimeMs - right.stat.birthtimeMs;
        else if (sort_by === "modified") comparison = left.stat.mtimeMs - right.stat.mtimeMs;
        else if (sort_by === "size") comparison = left.stat.size - right.stat.size;
        else comparison = left.relPath.localeCompare(right.relPath);
        return comparison * sortMultiplier || left.relPath.localeCompare(right.relPath);
      });

      const renderTemplate = (template: string, candidate: Record<string, any>, sequenceIndex: number, stem: string, ext: string) => {
        const parent = path.basename(path.dirname(candidate.fullPath));
        const category = classifyFileCategory(candidate.fullPath);
        return String(template).replace(/\{([A-Za-z_]+)(?::([^}]+))?\}/g, (_match, token, arg) => {
          const key = String(token).toLowerCase();
          if (key === "index" || key === "number") {
            const width = String(arg || "").match(/\d+/)?.[0];
            return width ? pad(sequenceIndex, Number(width)) : String(sequenceIndex);
          }
          if (key === "name" || key === "base") return `${stem}${ext}`;
          if (key === "stem") return stem;
          if (key === "ext" || key === "extension") return ext;
          if (key === "parent") return parent;
          if (key === "category") return category;
          if (key === "created") return formatDate(candidate.stat.birthtime, String(arg || "yyyyMMdd-HHmmss"));
          if (key === "modified") return formatDate(candidate.stat.mtime, String(arg || "yyyyMMdd-HHmmss"));
          if (key === "accessed") return formatDate(candidate.stat.atime, String(arg || "yyyyMMdd-HHmmss"));
          if (key === "now") return formatDate(new Date(), String(arg || "yyyyMMdd-HHmmss"));
          return _match;
        });
      };

      const applyRules = (candidate: Record<string, any>, sequenceIndex: number) => {
        const parsed = path.parse(candidate.fullPath);
        let stem = candidate.isDirectory ? parsed.base : parsed.name;
        let ext = candidate.isDirectory ? "" : parsed.ext;

        const getScoped = (scope: string) => {
          if (scope === "name" || scope === "base" || scope === "full") return `${stem}${ext}`;
          if (scope === "ext" || scope === "extension") return ext.replace(/^\./, "");
          return stem;
        };
        const setScoped = (scope: string, value: string) => {
          const nextValue = String(value);
          if (scope === "ext" || scope === "extension") {
            ext = candidate.isDirectory || !nextValue ? "" : (nextValue.startsWith(".") ? nextValue : `.${nextValue}`);
            return;
          }
          if (scope === "name" || scope === "base" || scope === "full") {
            if (candidate.isDirectory) {
              stem = nextValue;
              ext = "";
            } else {
              const nextParsed = path.parse(nextValue);
              stem = nextParsed.name || nextValue;
              ext = nextParsed.ext || ext;
            }
            return;
          }
          stem = nextValue;
        };
        const transformScoped = (rule: Record<string, unknown>, transform: (value: string) => string) => {
          const scope = String(rule.scope || "stem").toLowerCase();
          setScoped(scope, transform(getScoped(scope)));
        };

        for (const rule of rules) {
          const type = String(rule.type || rule.method || "").toLowerCase().replace(/[-\s]+/g, "_");
          if (!type) throw new Error("Each rename rule must include a type or method.");
          if (type === "new_name" || type === "template" || type === "list") {
            if (type === "list") {
              const values = Array.isArray(rule.values) ? rule.values : [];
              if (sequenceIndex - 1 < values.length) setScoped("base", String(values[sequenceIndex - 1]));
            } else {
              setScoped("base", renderTemplate(String(rule.template ?? rule.value ?? ""), candidate, sequenceIndex, stem, ext));
            }
          } else if (type === "replace" || type === "regex_replace") {
            transformScoped({ ...rule, regex: type === "regex_replace" ? true : rule.regex }, (value) => applyReplacement(value, { ...rule, regex: type === "regex_replace" ? true : rule.regex }));
          } else if (type === "remove_pattern") {
            transformScoped(rule, (value) => applyReplacement(value, rule, ""));
          } else if (type === "add" || type === "prefix" || type === "suffix") {
            transformScoped({ ...rule, scope: rule.scope || "stem" }, (value) => {
              const text = renderTemplate(String(rule.text ?? rule.value ?? ""), candidate, sequenceIndex, stem, ext);
              const where = type === "prefix" ? "prefix" : type === "suffix" ? "suffix" : String(rule.where || "suffix").toLowerCase();
              return where === "prefix" ? `${text}${value}` : `${value}${text}`;
            });
          } else if (type === "insert") {
            transformScoped(rule, (value) => {
              const at = clampIndex(Number(rule.index ?? rule.position ?? value.length), value.length);
              const text = renderTemplate(String(rule.text ?? rule.value ?? ""), candidate, sequenceIndex, stem, ext);
              return `${value.slice(0, at)}${text}${value.slice(at)}`;
            });
          } else if (type === "remove") {
            transformScoped(rule, (value) => {
              const start = clampIndex(Number(rule.start ?? 0), value.length);
              const count = Number(rule.count ?? Math.max(0, Number(rule.end ?? value.length) - start));
              return `${value.slice(0, start)}${value.slice(start + Math.max(0, count))}`;
            });
          } else if (type === "move") {
            transformScoped(rule, (value) => {
              const start = clampIndex(Number(rule.start ?? 0), value.length);
              const count = Math.max(0, Number(rule.count ?? 1));
              const chunk = value.slice(start, start + count);
              const without = `${value.slice(0, start)}${value.slice(start + count)}`;
              const to = clampIndex(Number(rule.to ?? without.length), without.length);
              return `${without.slice(0, to)}${chunk}${without.slice(to)}`;
            });
          } else if (type === "swap") {
            transformScoped(rule, (value) => {
              const left = String(rule.left ?? "");
              const right = String(rule.right ?? "");
              if (!left || !right) return value;
              const marker = `__AS_SWAP_${sequenceIndex}_${Date.now()}__`;
              return value.split(left).join(marker).split(right).join(left).split(marker).join(right);
            });
          } else if (type === "case" || type === "new_case") {
            transformScoped(rule, (value) => caseTransform(value, String(rule.mode || rule.value || "lower").toLowerCase()));
          } else if (type === "trim") {
            transformScoped(rule, (value) => {
              const side = String(rule.side || "both").toLowerCase();
              const chars = String(rule.chars || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              const pattern = chars ? `[${chars}]` : "\\s";
              const left = new RegExp(`^${pattern}+`);
              const right = new RegExp(`${pattern}+$`);
              if (side === "left") return value.replace(left, "");
              if (side === "right") return value.replace(right, "");
              return value.replace(left, "").replace(right, "");
            });
          } else if (type === "number" || type === "renumber" || type === "auto_number") {
            transformScoped({ ...rule, scope: rule.scope || "stem" }, (value) => {
              const start = Number(rule.start ?? 1);
              const step = Number(rule.step ?? 1);
              const width = Number(rule.padding ?? rule.width ?? 0);
              const text = pad(start + (sequenceIndex - 1) * step, width);
              const separator = String(rule.separator ?? "");
              const where = String(rule.where || "suffix").toLowerCase();
              if (where === "replace") return text;
              return where === "prefix" ? `${text}${separator}${value}` : `${value}${separator}${text}`;
            });
          } else if (type === "timestamp" || type === "date") {
            transformScoped({ ...rule, scope: rule.scope || "stem" }, (value) => {
              const source = String(rule.source || "modified").toLowerCase();
              const date = source === "created" ? candidate.stat.birthtime : source === "accessed" ? candidate.stat.atime : source === "now" ? new Date() : candidate.stat.mtime;
              const text = formatDate(date, String(rule.format || "yyyyMMdd-HHmmss"));
              const separator = String(rule.separator ?? "");
              const where = String(rule.where || "suffix").toLowerCase();
              if (where === "replace") return text;
              return where === "prefix" ? `${text}${separator}${value}` : `${value}${separator}${text}`;
            });
          } else if (type === "extension") {
            if (!candidate.isDirectory) {
              const mode = String(rule.mode || "").toLowerCase();
              if (mode === "lower") ext = ext.toLowerCase();
              else if (mode === "upper") ext = ext.toUpperCase();
              else if (mode === "remove") ext = "";
              else setScoped("extension", String(rule.value ?? rule.text ?? ""));
            }
          } else if (type === "normalize" || type === "web_safe" || type === "sanitize") {
            transformScoped({ ...rule, scope: rule.scope || "stem" }, (value) => normalizeName(value, type === "web_safe" ? "web" : String(rule.style || "web").toLowerCase()));
          } else if (type === "parent") {
            transformScoped({ ...rule, scope: rule.scope || "stem" }, (value) => {
              const parent = path.basename(path.dirname(candidate.fullPath));
              const separator = String(rule.separator ?? "-");
              return String(rule.where || "prefix").toLowerCase() === "suffix" ? `${value}${separator}${parent}` : `${parent}${separator}${value}`;
            });
          } else if (type === "regex_extract") {
            transformScoped(rule, (value) => {
              const regex = new RegExp(String(rule.pattern || ""));
              const match = regex.exec(value);
              if (!match) return value;
              return String(match[Number(rule.group ?? 1)] ?? match[0] ?? value);
            });
          } else {
            throw new Error(`Unsupported rename rule type: ${type}`);
          }
        }

        const nextName = sanitizeInvalidFileNameCharacters(`${stem}${ext}`);
        if (!nextName || nextName === "." || nextName === "..") throw new Error(`Rule set produced an invalid empty name for ${candidate.relPath}.`);
        if (/[\/\\]/.test(nextName)) throw new Error(`Rule set produced a path separator in '${nextName}' for ${candidate.relPath}.`);
        if (/[<>:"|?*\x00-\x1F]/.test(nextName)) throw new Error(`Rule set produced Windows-invalid filename characters in '${nextName}' for ${candidate.relPath}.`);
        if (/[. ]$/.test(nextName)) throw new Error(`Rule set produced a Windows-invalid trailing dot or space in '${nextName}' for ${candidate.relPath}.`);
        const reservedWindowsName = path.parse(nextName).name.toUpperCase();
        if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(reservedWindowsName)) {
          throw new Error(`Rule set produced a Windows-reserved filename '${nextName}' for ${candidate.relPath}.`);
        }
        return nextName;
      };

      const directoryRenames: Array<Record<string, any>> = [];
      const planned: Array<Record<string, any>> = [];
      const destinationKeys = new Set<string>();
      const skipped: Array<Record<string, unknown>> = [];

      const uniqueDestination = async (destinationPath: string, sourcePath: string) => {
        let nextPath = destinationPath;
        const parsed = path.parse(destinationPath);
        let suffix = 1;
        const sourceKey = sourcePath.toLowerCase();
        while ((await fileExists(nextPath) && nextPath.toLowerCase() !== sourceKey) || destinationKeys.has(nextPath.toLowerCase())) {
          if (collision_strategy === "error") throw new Error(`Destination already exists: ${path.relative(workspaceRoot, nextPath)}`);
          if (collision_strategy === "skip") return null;
          nextPath = path.join(parsed.dir, `${parsed.name} (${suffix})${parsed.ext}`);
          suffix += 1;
        }
        destinationKeys.add(nextPath.toLowerCase());
        return nextPath;
      };

      for (const [index, candidate] of candidates.entries()) {
        const nextName = applyRules(candidate, index + 1);
        if (nextName === candidate.base) continue;
        const destinationPath = await uniqueDestination(path.join(path.dirname(candidate.fullPath), nextName), candidate.fullPath);
        if (!destinationPath) {
          skipped.push({ path: candidate.relPath, reason: "destination exists" });
          continue;
        }
        const rename = {
          current: candidate.relPath,
          next: path.relative(workspaceRoot, destinationPath),
          final: path.relative(workspaceRoot, destinationPath),
          type: candidate.isDirectory ? "directory" : "file",
          sourcePath: candidate.fullPath,
          destinationPath,
          isDirectory: candidate.isDirectory,
        };
        planned.push(rename);
        if (candidate.isDirectory) directoryRenames.push(rename);
      }

      const directoryMoves = directoryRenames
        .map((rename) => ({ sourcePath: rename.sourcePath, destinationPath: rename.destinationPath }))
        .sort((left, right) => left.sourcePath.length - right.sourcePath.length);
      const adjusted = planned.map((rename) => {
        let finalPath = rename.destinationPath;
        for (const move of directoryMoves) {
          if (move.sourcePath === rename.sourcePath) continue;
          const sourcePrefix = `${move.sourcePath}${path.sep}`.toLowerCase();
          if (finalPath.toLowerCase().startsWith(sourcePrefix)) {
            finalPath = path.join(move.destinationPath, finalPath.slice(move.sourcePath.length + 1));
          }
        }
        return { ...rename, final: path.relative(workspaceRoot, finalPath), finalPath };
      });
      const nestedDirectoryRename = adjusted.find((rename) => rename.isDirectory && adjusted.some((other) => (
        other.sourcePath !== rename.sourcePath
        && other.sourcePath.toLowerCase().startsWith(`${rename.sourcePath}${path.sep}`.toLowerCase())
      )));
      if (!preview && nestedDirectoryRename) {
        throw new Error(`Cannot safely apply nested directory and child renames in one operation because undo would be ambiguous. Preview is available; apply file and directory renames in separate passes. First nested directory: ${nestedDirectoryRename.current}`);
      }

      if (!preview && isTestMode()) {
        return dryRunResponse("as_file_rename", "Rename files or directories", {
          preview: false,
          directory: path.relative(workspaceRoot, rootDir) || ".",
          scanned: candidates.length,
          count: adjusted.length,
          skipped,
          renames: adjusted.map((rename) => ({
            current: rename.current,
            next: rename.next,
            final: rename.final,
            type: rename.type,
          })),
        });
      }

      if (!preview) {
        const applyOrder = [...adjusted].sort((left, right) => right.sourcePath.length - left.sourcePath.length);
        const applied: Array<Record<string, unknown>> = [];
        const appliedRenames: Array<Record<string, any>> = [];
        for (const rename of applyOrder) {
          if (!await fileExists(rename.sourcePath)) {
            skipped.push({ path: rename.current, reason: "source missing at apply time" });
            continue;
          }
          await fsp.mkdir(path.dirname(rename.destinationPath), { recursive: true });
          await fsp.rename(rename.sourcePath, rename.destinationPath);
          applied.push({
            current: rename.current,
            next: rename.next,
            final: rename.final,
            type: rename.type,
          });
          appliedRenames.push(rename);
        }
        const undoRenames = [...appliedRenames]
          .sort((left, right) => String(left.current).length - String(right.current).length)
          .map((rename) => ({
            current: rename.final,
            previous: rename.current,
          }));
        await appendOperationLog(workspaceRoot, {
          tool: "as_file_rename",
          directory: path.relative(workspaceRoot, rootDir) || ".",
          recursive: recursive as boolean,
          count: applied.length,
          rules,
          renames: applied,
          skipped,
          undo: {
            strategy: "reverse_batch_rename",
            renames: undoRenames,
          },
        });
      }

      return json({
        success: true,
        preview,
        directory: path.relative(workspaceRoot, rootDir) || ".",
        scanned: candidates.length,
        count: adjusted.length,
        skipped,
        renames: adjusted.map((rename) => ({
          current: rename.current,
          next: rename.next,
          final: rename.final,
          type: rename.type,
        })),
      });
    }),
  }));

tools.push(tool({
    name: "as_file_watch_create",
    description: "Create a file watcher snapshot for a directory so later scans can report added, removed, or modified files.",
    parameters: {
      watch_id: z.string(),
      directory: z.string().default("."),
      recursive: z.boolean().default(true),
      include_hidden: z.boolean().default(false),
      limit: z.number().int().min(1).max(100000).default(getWatcherDefaultLimit(ctl)),
    },
    implementation: safeTool("as_file_watch_create", async ({ watch_id, directory, recursive, include_hidden, limit }) => {
      const targetDir = resolveInsideWorkspace(workspaceRoot, directory as string);
      const snapshot = await captureDirectorySnapshot(targetDir, workspaceRoot, recursive as boolean, include_hidden as boolean, limit as number);
      const watcher: FileWatcherDefinition = {
        id: watch_id as string,
        directory: path.relative(workspaceRoot, targetDir) || ".",
        recursive: recursive as boolean,
        includeHidden: include_hidden as boolean,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        snapshot,
      };
      if (isTestMode()) {
        return dryRunResponse("as_file_watch_create", "Create watcher snapshot", {
          watcherId: watcher.id,
          directory: watcher.directory,
          trackedEntries: snapshot.length,
        });
      }
      await writeWatcher(workspaceRoot, watcher);
      return json({ success: true, watcherId: watcher.id, directory: watcher.directory, trackedEntries: snapshot.length });
    }),
  }));

tools.push(tool({
    name: "as_file_watch_list",
    description: "List saved file watchers and the directories they monitor.",
    parameters: {},
    implementation: safeTool("as_file_watch_list", async () => {
      const dir = fileWatchersDirectory(workspaceRoot);
      if (!await fileExists(dir)) return json({ watchers: [] });
      const entries = await fsp.readdir(dir);
      const watchers = [];
      for (const entry of entries) {
        if (!entry.endsWith(".json")) continue;
        try {
          const watcher = JSON.parse(await fsp.readFile(path.join(dir, entry), "utf8")) as FileWatcherDefinition;
          watchers.push({
            id: watcher.id,
            directory: watcher.directory,
            recursive: watcher.recursive,
            includeHidden: watcher.includeHidden,
            trackedEntries: watcher.snapshot.length,
            updatedAt: watcher.updatedAt,
          });
        } catch {
          continue;
        }
      }
      return json({ watchers });
    }),
  }));

tools.push(tool({
    name: "as_file_watch_scan",
    description: "Compare a saved watcher snapshot against the current directory state.",
    parameters: {
      watch_id: z.string(),
      refresh_snapshot: z.boolean().default(true),
      limit: z.number().int().min(1).max(100000).default(getWatcherDefaultLimit(ctl)),
    },
    implementation: safeTool("as_file_watch_scan", async ({ watch_id, refresh_snapshot, limit }) => {
      const watcher = await readWatcher(workspaceRoot, watch_id as string);
      const currentSnapshot = await captureDirectorySnapshot(
        resolveInsideWorkspace(workspaceRoot, watcher.directory),
        workspaceRoot,
        watcher.recursive,
        watcher.includeHidden,
        limit as number,
      );
      const previous = new Map(watcher.snapshot.map((entry) => [entry.path, entry]));
      const current = new Map(currentSnapshot.map((entry) => [entry.path, entry]));
      const added: FileWatcherSnapshotEntry[] = [];
      const removed: FileWatcherSnapshotEntry[] = [];
      const modified: Array<Record<string, unknown>> = [];
      for (const [filePath, entry] of current) {
        const oldEntry = previous.get(filePath);
        if (!oldEntry) {
          added.push(entry);
          continue;
        }
        if (oldEntry.modifiedMs !== entry.modifiedMs || oldEntry.sizeBytes !== entry.sizeBytes || oldEntry.type !== entry.type) {
          modified.push({ path: filePath, previous: oldEntry, current: entry });
        }
      }
      for (const [filePath, entry] of previous) {
        if (!current.has(filePath)) removed.push(entry);
      }
      if (refresh_snapshot && isTestMode()) {
        return dryRunResponse("as_file_watch_scan", "Refresh watcher snapshot", {
          watcherId: watcher.id,
          refreshSnapshot: refresh_snapshot,
          counts: { added: added.length, removed: removed.length, modified: modified.length },
          added,
          removed,
          modified,
        });
      }
      if (refresh_snapshot) {
        watcher.snapshot = currentSnapshot;
        watcher.updatedAt = new Date().toISOString();
        await writeWatcher(workspaceRoot, watcher);
      }
      return json({
        success: true,
        watcherId: watcher.id,
        refreshSnapshot: refresh_snapshot,
        counts: { added: added.length, removed: removed.length, modified: modified.length },
        added,
        removed,
        modified,
      });
    }),
  }));

tools.push(tool({
    name: "as_file_watch_remove",
    description: "Delete a saved watcher definition.",
    parameters: {
      watch_id: z.string(),
    },
    implementation: safeTool("as_file_watch_remove", async ({ watch_id }) => {
      const watcherPath = resolveInsideDirectory(fileWatchersDirectory(workspaceRoot), `${watch_id as string}.json`);
      if (isTestMode()) {
        return dryRunResponse("as_file_watch_remove", "Delete watcher definition", {
          watcherId: watch_id,
        });
      }
      await fsp.rm(watcherPath, { force: true });
      return json({ success: true, watcherId: watch_id });
    }),
  }));

tools.push(tool({
    name: "as_file_plan_reorganization",
    description: "Create a suggested file reorganization plan for a directory.",
    parameters: {
      source_directory: z.string().default("."),
      destination_root: z.string().default("."),
      limit: z.number().int().min(1).max(5000).default(500),
      plan_name: z.string().default(""),
    },
    implementation: safeTool("as_file_plan_reorganization", async ({ source_directory, destination_root, limit, plan_name }) => {
      const sourceDir = resolveInsideWorkspace(workspaceRoot, source_directory as string);
      const destinationRoot = resolveInsideWorkspace(workspaceRoot, destination_root as string);
      const files = await collectFiles(sourceDir, limit as number);
      const planEntries: ReorgPlanEntry[] = [];
      for (const filePath of files) {
        const stat = await fsp.stat(filePath);
        if (!stat.isFile()) continue;
        const relativeSource = path.relative(workspaceRoot, filePath);
        const category = classifyFileCategory(filePath);
        const suggestedName = normalizeSuggestedName(filePath);
        const destination = path.join(destinationRoot, category, suggestedName);
        const relativeDestination = path.relative(workspaceRoot, destination);
        if (relativeSource === relativeDestination) continue;
        planEntries.push({
          source: relativeSource,
          destination: relativeDestination,
          category,
          reason: `Classified as ${category} and normalized filename.`,
        });
      }
      const planId = (plan_name as string).trim() || `plan-${Date.now()}`;
      const planPath = resolveInsideDirectory(reorgPlansDirectory(workspaceRoot), `${planId}.json`);
      if (isTestMode()) {
        return dryRunResponse("as_file_plan_reorganization", "Write reorganization plan file", {
          planId,
          planPath: path.relative(workspaceRoot, planPath),
          entries: planEntries,
        });
      }
      await fsp.mkdir(path.dirname(planPath), { recursive: true });
      await fsp.writeFile(planPath, JSON.stringify({
        id: planId,
        sourceDirectory: path.relative(workspaceRoot, sourceDir) || ".",
        destinationRoot: path.relative(workspaceRoot, destinationRoot) || ".",
        createdAt: new Date().toISOString(),
        entries: planEntries,
      }, null, 2), "utf8");
      await appendOperationLog(workspaceRoot, {
        tool: "as_file_plan_reorganization",
        planId,
        sourceDirectory: path.relative(workspaceRoot, sourceDir) || ".",
        destinationRoot: path.relative(workspaceRoot, destinationRoot) || ".",
        entryCount: planEntries.length,
      });
      return json({
        success: true,
        planId,
        planPath: path.relative(workspaceRoot, planPath),
        entries: planEntries,
      });
    }),
  }));

tools.push(tool({
    name: "as_file_list_reorganization_plans",
    description: "List saved file reorganization plans.",
    parameters: {},
    implementation: safeTool("as_file_list_reorganization_plans", async () => {
      const plansDir = reorgPlansDirectory(workspaceRoot);
      if (!await fileExists(plansDir)) return json({ plans: [] });
      const entries = await fsp.readdir(plansDir);
      const plans = [];
      for (const entry of entries) {
        if (!entry.endsWith(".json")) continue;
        try {
          const plan = JSON.parse(await fsp.readFile(path.join(plansDir, entry), "utf8"));
          plans.push({
            id: plan.id,
            createdAt: plan.createdAt,
            sourceDirectory: plan.sourceDirectory,
            destinationRoot: plan.destinationRoot,
            entryCount: Array.isArray(plan.entries) ? plan.entries.length : 0,
          });
        } catch {
          continue;
        }
      }
      plans.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return json({ plans });
    }),
  }));

tools.push(tool({
    name: "as_file_preview_moves",
    description: "Preview the entries of a saved reorganization plan.",
    parameters: {
      plan_id: z.string(),
      limit: z.number().int().min(1).max(5000).default(500),
    },
    implementation: safeTool("as_file_preview_moves", async ({ plan_id, limit }) => {
      const planPath = resolveInsideDirectory(reorgPlansDirectory(workspaceRoot), `${plan_id as string}.json`);
      if (!await fileExists(planPath)) throw new Error("Plan not found.");
      const plan = JSON.parse(await fsp.readFile(planPath, "utf8"));
      return json({
        id: plan.id,
        createdAt: plan.createdAt,
        sourceDirectory: plan.sourceDirectory,
        destinationRoot: plan.destinationRoot,
        entryCount: Array.isArray(plan.entries) ? plan.entries.length : 0,
        entries: Array.isArray(plan.entries) ? plan.entries.slice(0, limit as number) : [],
      });
    }),
  }));

tools.push(tool({
    name: "as_file_apply_reorganization",
    description: "Apply a saved reorganization plan by moving files into planned destinations.",
    parameters: {
      plan_id: z.string(),
      overwrite: z.boolean().default(false),
      limit: z.number().int().min(1).max(5000).default(5000),
    },
    implementation: safeTool("as_file_apply_reorganization", async ({ plan_id, overwrite, limit }) => {
      const planPath = resolveInsideDirectory(reorgPlansDirectory(workspaceRoot), `${plan_id as string}.json`);
      if (!await fileExists(planPath)) throw new Error("Plan not found.");
      const plan = JSON.parse(await fsp.readFile(planPath, "utf8"));
      const entries: ReorgPlanEntry[] = Array.isArray(plan.entries) ? plan.entries.slice(0, limit as number) : [];
      const testMode = isTestMode();
      const applied: Array<Record<string, unknown>> = [];
      const skipped: Array<Record<string, unknown>> = [];
      for (const entry of entries) {
        const sourcePath = resolveInsideWorkspace(workspaceRoot, entry.source);
        const destinationPath = resolveInsideWorkspace(workspaceRoot, entry.destination);
        if (!await fileExists(sourcePath)) {
          skipped.push({ source: entry.source, reason: "Source missing." });
          continue;
        }
        if (await fileExists(destinationPath)) {
          if (!overwrite) {
            skipped.push({ source: entry.source, destination: entry.destination, reason: "Destination exists." });
            continue;
          }
          if (!testMode) {
            await fsp.rm(destinationPath, { recursive: true, force: true });
          }
        }
        if (!testMode) {
          await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
          await fsp.rename(sourcePath, destinationPath);
        }
        applied.push({ source: entry.source, destination: entry.destination, category: entry.category, status: testMode ? "would_move" : "moved" });
      }
      if (testMode) {
        return dryRunResponse("as_file_apply_reorganization", "Apply reorganization plan", {
          planId: plan_id,
          applied,
          skipped,
          overwrite: overwrite as boolean,
        });
      }
      await appendOperationLog(workspaceRoot, {
        tool: "as_file_apply_reorganization",
        planId: plan_id,
        appliedCount: applied.length,
        skippedCount: skipped.length,
        applied,
        undo: {
          strategy: "reverse_moves",
          moves: applied.map((entry) => ({
            source: String((entry as Record<string, unknown>).destination || ""),
            destination: String((entry as Record<string, unknown>).source || ""),
          })),
        },
      });
      return json({
        success: true,
        planId: plan_id,
        applied,
        skipped,
      });
    }),
  }));

tools.push(tool({
    name: "as_file_resolve_duplicates",
    description: "Resolve a duplicate group by keeping one canonical file and moving or deleting the others.",
    parameters: {
      files_json: z.string().default(""),
      ...fileSelectionParameters,
      keep_path: z.string(),
      action: z.enum(["trash", "delete", "move"]).default("trash"),
      destination_directory: z.string().default(""),
      overwrite: z.boolean().default(false),
      confirmed: z.boolean().default(false),
    },
    implementation: safeTool("as_file_resolve_duplicates", async ({ files_json, file_list, folder_list, file_pattern, file_pattern_flags, folder_recursive, include_hidden, file_limit, keep_path, action, destination_directory, overwrite, confirmed }) => {
      const files = (await resolveBatchFileTargets({
        workspaceRoot,
        resolvePath: resolveInsideWorkspace,
        fileList: file_list,
        folderList: folder_list,
        legacyList: files_json,
        legacyListName: "files_json",
        filePattern: file_pattern,
        filePatternFlags: file_pattern_flags,
        folderRecursive: folder_recursive,
        includeHidden: include_hidden,
        fileLimit: file_limit,
        requireFiles: true,
      })).map((target) => target.relativePath);
      const normalizeDuplicatePath = (value: string) => String(value || "").replace(/\\/g, "/").trim();
      const keepSet = new Set([normalizeDuplicatePath(String(keep_path))]);
      const targets = files.filter((value: string) => !keepSet.has(normalizeDuplicatePath(value)));
      if (isTestMode()) {
        const dryRunResults: Array<Record<string, unknown>> = [];
        for (const relPath of targets) {
          const sourcePath = resolveInsideWorkspace(workspaceRoot, relPath);
          if (!await fileExists(sourcePath)) {
            dryRunResults.push({ path: relPath, status: "missing" });
            continue;
          }
          if (action === "move") {
            const destinationDir = resolveInsideWorkspace(workspaceRoot, destination_directory as string);
            const destinationPath = path.join(destinationDir, path.basename(sourcePath));
            if (await fileExists(destinationPath) && !overwrite) {
              dryRunResults.push({ path: relPath, status: "skipped", reason: "Destination exists." });
              continue;
            }
            dryRunResults.push({ path: relPath, status: "would_move", destination: path.relative(workspaceRoot, destinationPath) });
            continue;
          }
          if (action === "delete" && !confirmed) {
            dryRunResults.push({ path: relPath, status: "skipped", reason: "confirmed=true required for permanent delete." });
            continue;
          }
          dryRunResults.push({ path: relPath, status: action === "trash" ? "would_trash" : "would_delete" });
        }
        return dryRunResponse("as_file_resolve_duplicates", "Resolve duplicate files", {
          keepPath: keep_path,
          action,
          results: dryRunResults,
        });
      }
      const results: Array<Record<string, unknown>> = [];
      for (const relPath of targets) {
        const sourcePath = resolveInsideWorkspace(workspaceRoot, relPath);
        if (!await fileExists(sourcePath)) {
          results.push({ path: relPath, status: "missing" });
          continue;
        }
        if (action === "move") {
          const destinationDir = resolveInsideWorkspace(workspaceRoot, destination_directory as string);
          const destinationPath = path.join(destinationDir, path.basename(sourcePath));
          if (await fileExists(destinationPath) && !overwrite) {
            results.push({ path: relPath, status: "skipped", reason: "Destination exists." });
            continue;
          }
          await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
          if (await fileExists(destinationPath) && overwrite) {
            await fsp.rm(destinationPath, { recursive: true, force: true });
          }
          await fsp.rename(sourcePath, destinationPath);
          results.push({ path: relPath, status: "moved", destination: path.relative(workspaceRoot, destinationPath) });
          continue;
        }
        if (action === "delete" && !confirmed) {
          results.push({ path: relPath, status: "skipped", reason: "confirmed=true required for permanent delete." });
          continue;
        }
        if (action === "trash") {
          const trashedTo = await movePathToWorkspaceTrash(sourcePath, workspaceRoot);
          results.push({ path: relPath, status: "trashed", trashName: path.basename(trashedTo) });
        } else {
          await fsp.rm(sourcePath, { force: true });
          results.push({ path: relPath, status: "deleted" });
        }
      }
      await appendOperationLog(workspaceRoot, {
        tool: "as_file_resolve_duplicates",
        keepPath: keep_path,
        action,
        affectedCount: results.length,
      });
      return json({
        success: true,
        keepPath: keep_path,
        action,
        results,
      });
    }),
  }));

tools.push(tool({
    name: "as_file_patch",
    description: "Preview or apply multi-file text/code edits with exact replacements, regex replacements, append/prepend/write/insert/delete operations, encoding control, and diffs.",
    parameters: {
      path: z.string().default(""),
      ...fileSelectionParameters,
      operation: z.enum(["replace", "regex_replace", "append", "prepend", "write", "insert", "delete_range"]).default("replace"),
      old_text: z.string().default(""),
      new_text: z.string().default(""),
      pattern: z.string().default(""),
      replacement: z.string().default(""),
      content: z.string().default(""),
      patches_json: z.string().default(""),
      preview: z.boolean().default(true),
      encoding: z.string().default("utf8"),
      newline: z.enum(["preserve", "lf", "crlf"]).default("preserve"),
      create_if_missing: z.boolean().default(false),
      replace_all: z.boolean().default(false),
      case_sensitive: z.boolean().default(true),
      line: z.number().int().min(1).default(1),
      start_line: z.number().int().min(1).default(1),
      end_line: z.number().int().min(1).default(1),
      ensure_final_newline: z.boolean().default(false),
    },
    implementation: safeTool("as_file_patch", async ({ path: relPath, file_list, folder_list, file_pattern, file_pattern_flags, folder_recursive, include_hidden, file_limit, operation, old_text, new_text, pattern, replacement, content, patches_json, preview, encoding, newline, create_if_missing, replace_all, case_sensitive, line, start_line, end_line, ensure_final_newline }) => {
      const inferNewline = (text: string) => text.includes("\r\n") ? "\r\n" : "\n";
      const normalizeOutputNewline = (text: string, original: string) => {
        const target = newline === "crlf" ? "\r\n" : newline === "lf" ? "\n" : inferNewline(original);
        return text.replace(/\r?\n/g, target);
      };
      const simplePatch = {
        path: relPath,
        operation,
        old_text,
        new_text,
        pattern,
        replacement,
        content,
        replace_all,
        case_sensitive,
        line,
        start_line,
        end_line,
        create_if_missing,
        ensure_final_newline,
      };
      const hasTargetSelection = String(relPath || "").trim()
        || (Array.isArray(file_list) && file_list.length > 0)
        || (Array.isArray(folder_list) && folder_list.length > 0);
      const selectedSimplePatches = hasTargetSelection
        ? (await resolveBatchFileTargets({
            workspaceRoot,
            resolvePath: resolveInsideWorkspace,
            primaryPath: relPath,
            fileList: file_list,
            folderList: folder_list,
            filePattern: file_pattern,
            filePatternFlags: file_pattern_flags,
            folderRecursive: folder_recursive,
            includeHidden: include_hidden,
            fileLimit: file_limit,
            mustExist: !create_if_missing,
            requireFiles: true,
          })).map((target) => ({ ...simplePatch, path: target.relativePath }))
        : [];
      const explicitPatches = String(patches_json || "").trim()
        ? (() => {
            const parsed = JSON.parse(patches_json as string);
            if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("patches_json must be a non-empty JSON array.");
            return parsed;
          })()
        : [];
      const patches = [...explicitPatches, ...selectedSimplePatches];
      if (patches.length === 0) throw new Error("Provide path, file_list, folder_list, or patches_json.");
      const byPath = new Map<string, Array<Record<string, unknown>>>();
      for (const [index, rawPatch] of patches.entries()) {
        if (!rawPatch || typeof rawPatch !== "object" || Array.isArray(rawPatch)) throw new Error(`Patch ${index + 1} must be an object.`);
        const patch = rawPatch as Record<string, unknown>;
        const patchPath = String(patch.path || relPath || "").trim();
        if (!patchPath) throw new Error(`Patch ${index + 1} is missing path.`);
        if (!byPath.has(patchPath)) byPath.set(patchPath, []);
        byPath.get(patchPath)!.push(patch);
      }
      const results: Array<Record<string, unknown>> = [];
      for (const [patchPath, filePatches] of byPath.entries()) {
        const fullPath = resolveInsideWorkspace(workspaceRoot, patchPath);
        const exists = await fileExists(fullPath);
        if (!exists && !filePatches.some((patch) => patch.create_if_missing === true || create_if_missing)) {
          throw new Error(`File does not exist and create_if_missing is false: ${patchPath}`);
        }
        const original = exists ? await fsp.readFile(fullPath, encoding as BufferEncoding) : "";
        let next = String(original);
        const applied: Array<Record<string, unknown>> = [];
        for (const [index, patch] of filePatches.entries()) {
          const op = String(patch.operation || operation || "replace");
          if (op === "replace") {
            const oldText = String(patch.old_text ?? patch.oldText ?? old_text ?? "");
            const newText = String(patch.new_text ?? patch.newText ?? new_text ?? "");
            if (!oldText) throw new Error(`Patch ${index + 1} old_text must not be empty.`);
            const count = next.split(oldText).length - 1;
            if (count === 0) throw new Error(`Patch ${index + 1} old_text not found in ${patchPath}.`);
            const all = Boolean(patch.replace_all ?? replace_all);
            if (!all && count !== 1) throw new Error(`Patch ${index + 1} matched ${count} times in ${patchPath}; make it unique or set replace_all=true.`);
            next = all ? next.split(oldText).join(newText) : next.replace(oldText, newText);
            applied.push({ index: index + 1, operation: op, replacements: all ? count : 1 });
            continue;
          }
          if (op === "regex_replace") {
            const regexPattern = String(patch.pattern ?? pattern ?? "");
            if (!regexPattern) throw new Error(`Patch ${index + 1} pattern must not be empty.`);
            const flags = `g${(patch.case_sensitive ?? case_sensitive) === false ? "i" : ""}${String(patch.flags || "").replace(/[^imsuy]/g, "")}`;
            const regexFlags = Array.from(new Set(flags.split(""))).join("");
            const regex = new RegExp(regexPattern, regexFlags);
            const matches = next.match(regex) || [];
            if (matches.length === 0) throw new Error(`Patch ${index + 1} pattern did not match ${patchPath}.`);
            if (!Boolean(patch.replace_all ?? replace_all) && matches.length !== 1) throw new Error(`Patch ${index + 1} matched ${matches.length} times in ${patchPath}; make it unique or set replace_all=true.`);
            const repl = String(patch.replacement ?? replacement ?? "");
            next = Boolean(patch.replace_all ?? replace_all) ? next.replace(regex, repl) : next.replace(new RegExp(regexPattern, regexFlags.replace("g", "")), repl);
            applied.push({ index: index + 1, operation: op, replacements: Boolean(patch.replace_all ?? replace_all) ? matches.length : 1 });
            continue;
          }
          if (op === "append" || op === "prepend" || op === "write") {
            const patchContent = String(patch.content ?? content ?? "");
            if (op === "write") next = patchContent;
            else if (op === "prepend") next = patchContent + next;
            else {
              const addNewline = patch.add_newline !== false && next.length > 0 && !next.endsWith("\n") && !patchContent.startsWith("\n");
              next = `${next}${addNewline ? "\n" : ""}${patchContent}`;
            }
            applied.push({ index: index + 1, operation: op, characters: patchContent.length });
            continue;
          }
          if (op === "insert") {
            const insertLine = Number(patch.line ?? line ?? 1);
            const patchContent = String(patch.content ?? content ?? "");
            const lines = next.split(/\r?\n/);
            lines.splice(Math.max(0, Math.min(lines.length, insertLine - 1)), 0, patchContent);
            next = lines.join("\n");
            applied.push({ index: index + 1, operation: op, line: insertLine, characters: patchContent.length });
            continue;
          }
          if (op === "delete_range") {
            const start = Number(patch.start_line ?? start_line ?? 1);
            const end = Number(patch.end_line ?? end_line ?? start);
            if (end < start) throw new Error(`Patch ${index + 1} end_line must be >= start_line.`);
            const lines = next.split(/\r?\n/);
            const removed = lines.splice(Math.max(0, start - 1), Math.max(0, end - start + 1));
            next = lines.join("\n");
            applied.push({ index: index + 1, operation: op, startLine: start, endLine: end, removedLines: removed.length });
            continue;
          }
          throw new Error(`Unsupported file patch operation: ${op}`);
        }
        if (filePatches.some((patch) => patch.ensure_final_newline === true) || ensure_final_newline) {
          if (next.length > 0 && !next.endsWith("\n")) next += "\n";
        }
        next = normalizeOutputNewline(next, original);
        const diff = unifiedDiff(original, next, path.relative(workspaceRoot, fullPath));
        const effectivePreview = preview || isTestMode();
        if (!effectivePreview && next !== original) {
          await fsp.mkdir(path.dirname(fullPath), { recursive: true });
          await fsp.writeFile(fullPath, next, encoding as BufferEncoding);
        }
        results.push({ path: path.relative(workspaceRoot, fullPath), changed: next !== original, preview: effectivePreview, patches: applied, diff });
      }
      const effectivePreview = preview || isTestMode();
      if (!effectivePreview) {
        await appendOperationLog(workspaceRoot, {
          tool: "as_file_patch",
          fileCount: results.length,
          changedCount: results.filter((entry) => entry.changed).length,
          paths: results.map((entry) => entry.path),
        });
      }
      return json({
        success: true,
        preview: effectivePreview,
        testMode: isTestMode() ? true : undefined,
        dryRun: isTestMode() && !preview ? true : undefined,
        message: isTestMode() && !preview ? "Test Mode is enabled. Patch changes were computed but not written." : undefined,
        fileCount: results.length,
        changedCount: results.filter((entry) => entry.changed).length,
        results,
      });
    }),
  }));

tools.push(tool({
    name: "as_file_exists",
    description: "Check whether one or more files or directories exist and return metadata.",
    parameters: {
      path: z.string().default(""),
      ...fileSelectionParameters,
    },
    implementation: safeTool("as_file_exists", async (params) => {
      const targets = await resolveTargets(params, { mustExist: false, requireFiles: false, includeDirectories: true });
      const results = [];
      for (const target of targets) {
        if (!await fileExists(target.fullPath)) {
          results.push({ exists: false, path: target.relativePath });
          continue;
        }
        const stat = await fsp.stat(target.fullPath);
        results.push({
          exists: true,
          path: path.relative(workspaceRoot, target.fullPath),
          type: stat.isDirectory() ? "directory" : "file",
          sizeBytes: stat.size,
          modified: stat.mtime.toISOString(),
        });
      }
      return json(results.length === 1 ? results[0] : { count: results.length, results });
    }),
  }));

tools.push(tool({
    name: "as_file_hash",
    description: "Hash one or more files using a standard digest algorithm.",
    parameters: {
      path: z.string().default(""),
      algorithm: z.enum(["md5", "sha1", "sha256", "sha512"]).default("sha256"),
      ...fileSelectionParameters,
    },
    implementation: safeTool("as_file_hash", async (params) => {
      const { algorithm } = params;
      const targets = await resolveTargets(params, { requireFiles: true });
      const crypto = await import("crypto");
      const results = [];
      for (const target of targets) {
        const content = await fsp.readFile(target.fullPath);
        const digest = crypto.createHash(algorithm as string).update(content).digest("hex");
        results.push({
          path: target.relativePath,
          algorithm,
          digest,
          sizeBytes: content.length,
        });
      }
      return json(results.length === 1 ? results[0] : { count: results.length, algorithm, results });
    }),
  }));

tools.push(tool({
    name: "as_file_fuzzy_find",
    description: "Find likely matching files by fuzzy similarity when the exact path is unknown.",
    parameters: {
      query: z.string(),
      directory: z.string().default("."),
      ...fileSelectionParameters,
      limit: z.number().int().min(1).max(100).default(20),
      extensions: z.string().default(""),
    },
    implementation: safeTool("as_file_fuzzy_find", async ({ query, directory, file_list, folder_list, file_pattern, file_pattern_flags, folder_recursive, include_hidden, file_limit, limit, extensions }) => {
      const startDir = resolveInsideWorkspace(workspaceRoot, directory as string);
      const extSet = new Set(
        String(extensions || "")
          .split(",")
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean),
      );
      const files = (Array.isArray(file_list) && file_list.length > 0) || (Array.isArray(folder_list) && folder_list.length > 0)
        ? (await resolveBatchFileTargets({
            workspaceRoot,
            resolvePath: resolveInsideWorkspace,
            fileList: file_list,
            folderList: folder_list,
            filePattern: file_pattern,
            filePatternFlags: file_pattern_flags,
            folderRecursive: folder_recursive,
            includeHidden: include_hidden,
            fileLimit: file_limit,
            requireFiles: true,
          })).map((target) => target.fullPath)
        : await collectFiles(startDir, 5000);
      const ranked = [];
      for (const filePath of files) {
        const rel = path.relative(workspaceRoot, filePath);
        if (extSet.size > 0 && !extSet.has(path.extname(rel).toLowerCase())) continue;
        const score = Math.max(computeFuzzyScore(query as string, path.basename(rel)), computeFuzzyScore(query as string, rel));
        if (score <= 0.15) continue;
        const stat = await fsp.stat(filePath);
        ranked.push({
          path: rel,
          score,
          sizeBytes: stat.size,
          modified: stat.mtime.toISOString(),
        });
      }
      ranked.sort((a, b) => b.score - a.score || a.path.length - b.path.length);
      return json({ query, totalMatches: ranked.length, results: ranked.slice(0, limit as number) });
    }),
  }));

tools.push(tool({
    name: "as_file_find_duplicates",
    description: "Find duplicate files by size and hash within one or more explicit files or directory trees.",
    parameters: {
      directory: z.string().default("."),
      ...fileSelectionParameters,
      algorithm: z.enum(["sha256", "sha512"]).default("sha256"),
      limit: z.number().int().min(1).max(5000).default(1000),
    },
    implementation: safeTool("as_file_find_duplicates", async ({ directory, file_list, folder_list, file_pattern, file_pattern_flags, folder_recursive, include_hidden, file_limit, algorithm, limit }) => {
      const startDir = resolveInsideWorkspace(workspaceRoot, directory as string);
      const files = (Array.isArray(file_list) && file_list.length > 0) || (Array.isArray(folder_list) && folder_list.length > 0)
        ? (await resolveBatchFileTargets({
            workspaceRoot,
            resolvePath: resolveInsideWorkspace,
            fileList: file_list,
            folderList: folder_list,
            filePattern: file_pattern,
            filePatternFlags: file_pattern_flags,
            folderRecursive: folder_recursive,
            includeHidden: include_hidden,
            fileLimit: file_limit || limit,
            requireFiles: true,
          })).map((target) => target.fullPath)
        : await collectFiles(startDir, limit as number);
      const crypto = await import("crypto");
      const bySize = new Map<number, string[]>();
      for (const filePath of files) {
        const stat = await fsp.stat(filePath);
        if (!stat.isFile()) continue;
        const existing = bySize.get(stat.size) || [];
        existing.push(filePath);
        bySize.set(stat.size, existing);
      }
      const duplicates: Array<{ sizeBytes: number; digest: string; files: string[] }> = [];
      for (const [sizeBytes, sameSizeFiles] of bySize.entries()) {
        if (sameSizeFiles.length < 2) continue;
        const byHash = new Map<string, string[]>();
        for (const filePath of sameSizeFiles) {
          const content = await fsp.readFile(filePath);
          const digest = crypto.createHash(algorithm as string).update(content).digest("hex");
          const existing = byHash.get(digest) || [];
          existing.push(path.relative(workspaceRoot, filePath));
          byHash.set(digest, existing);
        }
        for (const [digest, dupFiles] of byHash.entries()) {
          if (dupFiles.length > 1) {
            duplicates.push({ sizeBytes, digest, files: dupFiles });
          }
        }
      }
      return json({
        directory: path.relative(workspaceRoot, startDir) || ".",
        algorithm,
        groups: duplicates,
      });
    }),
  }));

tools.push(tool({
    name: "as_file_search_text",
    description: "Search text content across explicit files, file lists, or directory trees.",
    parameters: {
      query: z.string(),
      directory: z.string().default("."),
      ...fileSelectionParameters,
      regex: z.boolean().default(false),
      case_sensitive: z.boolean().default(false),
      limit: z.number().int().min(1).max(1000).default(100),
    },
    implementation: safeTool("as_file_search_text", async ({ query, directory, file_list, folder_list, file_pattern, file_pattern_flags, folder_recursive, include_hidden, file_limit, regex, case_sensitive, limit }) => {
      const startDir = resolveInsideWorkspace(workspaceRoot, directory as string);
      const files = (Array.isArray(file_list) && file_list.length > 0) || (Array.isArray(folder_list) && folder_list.length > 0)
        ? (await resolveBatchFileTargets({
            workspaceRoot,
            resolvePath: resolveInsideWorkspace,
            fileList: file_list,
            folderList: folder_list,
            filePattern: file_pattern,
            filePatternFlags: file_pattern_flags,
            folderRecursive: folder_recursive,
            includeHidden: include_hidden,
            fileLimit: file_limit,
            requireFiles: true,
          })).map((target) => target.fullPath)
        : await collectFiles(startDir, 5000);
      const flags = case_sensitive ? "g" : "gi";
      const pattern = regex ? new RegExp(query as string, flags) : null;
      const results: Array<Record<string, unknown>> = [];
      for (const filePath of files) {
        if (results.length >= (limit as number)) break;
        try {
          const content = await fsp.readFile(filePath, "utf8");
          let matchIndex = -1;
          let preview = "";
          if (pattern) {
            pattern.lastIndex = 0;
            const match = pattern.exec(content);
            if (match) {
              matchIndex = match.index;
              preview = content.slice(Math.max(0, match.index - 80), Math.min(content.length, match.index + 160));
            }
          } else {
            const haystack = case_sensitive ? content : content.toLowerCase();
            const needle = case_sensitive ? String(query) : String(query).toLowerCase();
            matchIndex = haystack.indexOf(needle);
            if (matchIndex >= 0) {
              preview = content.slice(Math.max(0, matchIndex - 80), Math.min(content.length, matchIndex + 160));
            }
          }
          if (matchIndex >= 0) {
            results.push({
              path: path.relative(workspaceRoot, filePath),
              matchIndex,
              preview,
            });
          }
        } catch {
          continue;
        }
      }
      return json({
        query,
        directory: path.relative(workspaceRoot, startDir) || ".",
        results,
      });
    }),
  }));


tools.push(tool({
    name: "as_file_embed",
    description: "Embed supported files directly in the conversation using markdown syntax. Images are embedded as ![Name](path), markdown/plaintext files have their content included inline, and unsupported files get direct file links. After calling this tool, you must write the returned markdown field verbatim in your next assistant message or the embed will not render in LM Studio. Do not rebuild image links yourself and do not convert LM Studio image paths into file:// URLs.",
    parameters: {
      path: z.string().default(""),
      file_list: z.array(z.string()).default([]),
      folder_list: z.array(z.string()).default([]),
      file_pattern: z.string().default(""),
      file_pattern_flags: z.string().default(""),
      folder_recursive: z.boolean().default(true),
      include_hidden: z.boolean().default(false),
      file_limit: z.number().int().min(1).max(20000).default(5000),
      max_text_size: z.number().int().min(100).max(100000).default(5000),
    },
    implementation: safeTool("as_file_embed", async (params) => {
      const normalizedParams = {
        ...params,
        path: normalizeLmStudioLocalPath(params.path),
        file_list: Array.isArray(params.file_list) ? params.file_list.map((entry) => normalizeLmStudioLocalPath(entry)) : params.file_list,
        folder_list: Array.isArray(params.folder_list) ? params.folder_list.map((entry) => normalizeLmStudioLocalPath(entry)) : params.folder_list,
      };
      const normalizedWorkspaceRoot = normalizeFsLookup(workspaceRoot);
      const externalTargets = [];
      const externalTargetKeys = new Set<string>();
      const maybeCollectExternalFile = async (candidate: unknown) => {
        const normalizedCandidate = String(candidate || "").trim();
        if (!normalizedCandidate || /^https?:\/\//i.test(normalizedCandidate) || !path.isAbsolute(normalizedCandidate)) return false;
        const normalizedLookup = normalizeFsLookup(normalizedCandidate);
        if (normalizedLookup === normalizedWorkspaceRoot || normalizedLookup.startsWith(`${normalizedWorkspaceRoot}${path.sep}`)) return false;
        const stat = await fsp.lstat(normalizedCandidate).catch(() => null);
        if (!stat?.isFile()) return false;
        if (!externalTargetKeys.has(normalizedLookup)) {
          externalTargetKeys.add(normalizedLookup);
          externalTargets.push({
            fullPath: normalizedCandidate,
            relativePath: normalizedCandidate,
          });
        }
        return true;
      };
      const normalizedFileList = Array.isArray(normalizedParams.file_list) ? normalizedParams.file_list : [];
      const filteredFileList = [];
      for (const entry of normalizedFileList) {
        if (!await maybeCollectExternalFile(entry)) filteredFileList.push(entry);
      }
      const normalizedPrimaryPath = String(normalizedParams.path || "").trim();
      const primaryPathIsExternalFile = await maybeCollectExternalFile(normalizedPrimaryPath);
      const nonUrlFileList = Array.isArray(normalizedParams.file_list)
        ? filteredFileList.filter((entry) => !/^https?:\/\//i.test(String(entry || "").trim()))
        : [];
      const explicitUrlTargets = [
        ...(typeof normalizedParams.path === "string" && /^https?:\/\//i.test(normalizedParams.path) ? [String(normalizedParams.path).trim()] : []),
        ...(Array.isArray(normalizedFileList) ? normalizedFileList.filter((entry) => /^https?:\/\//i.test(String(entry || "").trim())).map((entry) => String(entry).trim()) : []),
      ];
      const internalTargets = await resolveTargets({
        ...normalizedParams,
        path: explicitUrlTargets.includes(String(normalizedParams.path || "").trim()) || primaryPathIsExternalFile ? "" : normalizedParams.path,
        file_list: nonUrlFileList,
      }, { requireFiles: true, allowEmpty: explicitUrlTargets.length > 0 || externalTargets.length > 0 });
      const targets = [...externalTargets, ...internalTargets];
      const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".ico"]);
      const textExtensions = new Set([".md", ".txt", ".text", ".log", ".csv", ".json", ".yaml", ".yml", ".xml", ".html", ".htm", ".css", ".js", ".ts", ".py", ".sh", ".bat", ".cmd", ".ps1", ".r", ".sql", ".ini", ".cfg", ".conf", ".toml", ".env", ".gitignore", ".dockerignore"]);
      const results = [];
      let markdownOutput = "";
      const workspaceDrive = path.parse(workspaceRoot).root.toLowerCase();
      const buildLmStudioImageUrl = (fullPath: string): string => {
        const raw = String(fullPath || "");
        let normalized = raw.replace(/%5C/gi, "/").replace(/%2F/gi, "/").replace(/\\/g, "/");
        try {
          normalized = decodeURIComponent(normalized);
        } catch {}
        normalized = normalized.replace(/%5C/gi, "/").replace(/%2F/gi, "/").replace(/\\/g, "/").replace(/\/+/g, "/");
        // LM Studio expects Windows markdown image embeds in this drive-stripped
        // form (e.g. /Users/... instead of C:/Users/...). Do not preserve the
        // drive letter here or image rendering in the app breaks. Also keep all
        // separators as forward slashes; even an encoded backslash like %5C can
        // break LM Studio embeds.
        return process.platform === "win32"
          ? normalized.replace(/^[A-Za-z]:/, "")
          : normalized;
      };
      const buildFileLinkUrl = (fullPath: string): string => `file:///${fullPath.replace(/\\/g, "/")}`;
      const embedCacheDirectory = path.join(workspaceRoot, ".lmstudio-embed-cache");

      for (const url of explicitUrlTargets) {
        markdownOutput += `[${url}](${url})\n\n`;
        results.push({
          path: url,
          type: "url",
          embedded: false,
          method: "web_link",
          markdown: `[${url}](${url})`,
        });
      }

      for (const target of targets) {
        const ext = path.extname(target.fullPath).toLowerCase();
        const basename = path.basename(target.fullPath);
        const relPath = target.relativePath;

        if (imageExtensions.has(ext)) {
          const crossDrive = path.parse(target.fullPath).root.toLowerCase() !== workspaceDrive;
          let embedSourcePath = target.fullPath;
          let stagedCopyPath: string | null = null;
          if (crossDrive) {
            await fsp.mkdir(embedCacheDirectory, { recursive: true });
            const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext || path.extname(basename)}`;
            stagedCopyPath = path.join(embedCacheDirectory, uniqueName);
            await fsp.copyFile(target.fullPath, stagedCopyPath);
            embedSourcePath = stagedCopyPath;
            await scheduleEmbedCleanup(stagedCopyPath);
          }
          const imageUrl = buildLmStudioImageUrl(embedSourcePath);
          markdownOutput += `![${basename}](${imageUrl})\n\n`;
          results.push({
            path: relPath,
            type: "image",
            embedded: true,
            method: "markdown_image",
            markdown: `![${basename}](${imageUrl})`,
            crossDrive,
            stagedCopyPath: stagedCopyPath ? path.relative(workspaceRoot, stagedCopyPath) : undefined,
            note: crossDrive ? "Cross-drive image was copied into the workspace with a unique temporary filename so LM Studio can render it, then scheduled for cleanup after access/handle release." : undefined,
          });
        } else if (textExtensions.has(ext)) {
          try {
            const maxSize = params.max_text_size as number;
            const fileContent = await fsp.readFile(target.fullPath, "utf8");

            let displayContent = fileContent;
            let truncated = false;
            if (fileContent.length > maxSize) {
              displayContent = fileContent.slice(0, maxSize);
              truncated = true;
            }

            const lang = ext.replace(".", "") || "text";
            const codeBlock = ext === ".md" ? displayContent : `\`\`\`${lang}\n${displayContent}\n\`\`\``;
            markdownOutput += `\n\n**File: ${basename}**\n\n${codeBlock}`;
            if (truncated) {
              markdownOutput += `\n\n*... (truncated at ${maxSize} characters, file contains more content)*`;
            }
            markdownOutput += "\n\n";

            results.push({
              path: relPath,
              type: "text",
              embedded: true,
              method: "inline_content",
              sizeBytes: fileContent.length,
              truncated,
            });
          } catch (error) {
            markdownOutput += `\n\n**File: ${basename}** *(error reading file: ${(error as Error).message})*\n\n`;
            results.push({
              path: relPath,
              type: "text",
              embedded: false,
              error: (error as Error).message,
            });
          }
        } else {
          const fileUrl = buildFileLinkUrl(target.fullPath);
          markdownOutput += `[${basename}](${fileUrl})\n\n`;
          results.push({
            path: relPath,
            type: "unsupported",
            embedded: false,
            method: "file_link",
            markdown: `[${basename}](${fileUrl})`,
          });
        }
      }

      const embeddedImageCount = results.filter((entry: any) => entry?.type === "image" && entry?.embedded === true).length;

      return json({
        success: true,
        count: results.length,
        markdown: markdownOutput.trim(),
        verbatimMarkdown: markdownOutput.trim(),
        results,
        doNotRewriteMarkdown: true,
        instruction: "Write the returned markdown field verbatim in your next assistant message so LM Studio renders the embed. Do not summarize it, rebuild it, normalize it, or convert image paths to file:// URLs.",
        modelReminder: "Calling as_file_embed is not enough by itself. You must emit the markdown string from this tool result exactly as returned, including LM Studio's drive-stripped /Users/... style image paths on Windows.",
        visionRecommendation: embeddedImageCount > 0 ? {
          skill: "media/vision-inspection-workflow",
          tools: ["as_vision_ocr", "as_vision_target", "as_vision_focus", "as_vision_recognize"],
          guidance: "Embedded images render in the transcript, but pixel analysis should be done with the vision tools. Use as_vision_ocr for exact text, numbers, equations, and UI readouts. Use as_vision_target when you need coordinates or bounds for buttons, sliders, icons, or crop targets. Use as_vision_focus for detailed interface-state or region-specific questions. Use as_vision_recognize for broader scene or multimedia understanding. Start with the default fast path and only retry with fast=false if the fast result is incomplete, clearly wrong, or too uncertain. Pass this markdown through embed_markdown when needed.",
          nextStep: "Call as_skill with action=\"read\" and name=\"media/vision-inspection-workflow\" for the recommended OCR, UI-reading, image-recognition, and video-frame workflow.",
        } : undefined,
      });
    }),
  }));
}
