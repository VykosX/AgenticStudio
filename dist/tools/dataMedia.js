"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDataMediaTools = registerDataMediaTools;
function registerDataMediaTools(ctx, tools) {
    const { tool, z, safeTool, configSchematics, requireCommandExecution, workspaceRoot, allowFullFilesystemAccessMode, resolveInsideWorkspace, unifiedDiff, batchFileSelectionParameters, resolveBatchFileTargets, parseCsv, stringifyCsv, csvRowsToObjects, csvObjectsToRows, detectStructuredFormat, jsonMergePatch, fileExists, quote, buildCommandResponse, buildManagedCommandResponse, executeManagedCommand, executeInlinePython, resolveExecutablePath, getZstdCompressionLevel, escapeForPython, escapeForPowerShellSingleQuoted, powerShellCommand, maybeWriteToolOutputToFile, ctl, env, shell, timeoutMs, maxOutputBytes, pythonExecutable, process, os, path, fsp, Buffer, YAML, json } = ctx;
    const assertNoShellControlOperators = (value, fieldName) => {
        if (/[\r\n;&|`]/.test(String(value || ""))) {
            throw new Error(`${fieldName} contains shell control operators. Pass plain arguments only.`);
        }
    };
    const fileSelectionParameters = batchFileSelectionParameters(z);
    const hasBatchSelection = (params) => Array.isArray(params.file_list) && params.file_list.length > 0
        || Array.isArray(params.folder_list) && params.folder_list.length > 0
        || String(params.file_pattern || "").trim();
    const resolveTargets = (params, primaryPath, primaryPathName = "path", options = {}) => resolveBatchFileTargets({
        workspaceRoot,
        resolvePath: resolveInsideWorkspace,
        primaryPath,
        primaryPathName,
        fileList: params.file_list,
        folderList: params.folder_list,
        filePattern: params.file_pattern,
        filePatternFlags: params.file_pattern_flags,
        folderRecursive: params.folder_recursive,
        includeHidden: params.include_hidden,
        fileLimit: params.file_limit,
        ...options,
    });
    const runPowerShellScriptFile = async (scriptContents, prefix, localTimeoutMs = Math.max(timeoutMs, 120000)) => {
        const tempDirectory = path.join(workspaceRoot, "screenshots", "tool-temp");
        await fsp.mkdir(tempDirectory, { recursive: true });
        const scriptPath = path.join(tempDirectory, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ps1`);
        await fsp.writeFile(scriptPath, scriptContents, "utf8");
        const command = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ${quote(scriptPath)}`;
        try {
            return await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env }, localTimeoutMs, maxOutputBytes);
        }
        finally {
            await fsp.rm(scriptPath, { force: true }).catch(() => { });
        }
    };
    const normalizeReadOnlySql = (query, allowedPrefix, toolName) => {
        const trimmed = String(query || "").trim();
        if (!trimmed)
            throw new Error(`${toolName} query must not be empty.`);
        const withoutFinalSemicolon = trimmed.replace(/;+\s*$/, "");
        if (withoutFinalSemicolon.includes(";")) {
            throw new Error(`${toolName} only accepts one SQL statement.`);
        }
        if (!allowedPrefix.test(withoutFinalSemicolon)) {
            throw new Error(`${toolName} only allows read-only SELECT, WITH, PRAGMA, SHOW, or EXPLAIN queries as applicable.`);
        }
        if (/\b(insert|update|delete|drop|alter|create|replace|truncate|attach|detach|vacuum|reindex|grant|revoke|merge|call|copy|execute)\b/i.test(withoutFinalSemicolon)) {
            throw new Error(`${toolName} rejected a mutating SQL keyword.`);
        }
        if (/^pragma\b/i.test(withoutFinalSemicolon) && /=/.test(withoutFinalSemicolon)) {
            throw new Error(`${toolName} rejected a writable PRAGMA assignment.`);
        }
        return withoutFinalSemicolon;
    };
    const csvRecordsFromRows = (rows, hasHeader, limit) => {
        if (hasHeader) {
            return csvRowsToObjects(rows.slice(0, limit + 1), true);
        }
        return rows.slice(0, limit).map((row) => Object.fromEntries(row.map((value, index) => [`column_${index + 1}`, value])));
    };
    const normalizeDetailLevel = (value) => {
        const normalized = String(value || "compact").trim().toLowerCase();
        if (normalized === "maximum")
            return "max";
        return normalized === "full" || normalized === "max" ? normalized : "compact";
    };
    const REPORT_READ_GUIDANCE = "Report spilled to disk. Do not read whole file by default. First narrow with as_file_search_text on keys, ids, filenames, timestamps, codecs, or error text. Then use as_file_read with offset/length only on the matching regions you actually need.";
    const createReportPath = (toolName, label, extension = "json") => path.join("reports", `${toolName}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`);
    const compactRowsResult = async (toolName, detailLevel, payload, rows, rowKey = "rows", sampleSize = 20) => {
        if (detailLevel === "max")
            return payload;
        const sampledRows = rows.slice(0, sampleSize);
        const base = {
            ...payload,
            detail: detailLevel,
            [rowKey]: detailLevel === "full" ? rows : sampledRows,
            returnedRowCount: detailLevel === "full" ? rows.length : sampledRows.length,
            truncatedRows: rows.length > sampledRows.length,
        };
        if (detailLevel === "compact" && rows.length > sampledRows.length) {
            base[`${rowKey}ReportPath`] = await maybeWriteToolOutputToFile(workspaceRoot, createReportPath(toolName, rowKey), payload);
            base.reportReadGuidance = REPORT_READ_GUIDANCE;
        }
        return base;
    };
    const buildStructuredReportSummary = async (toolName, detailLevel, label, value, metadata) => {
        if (detailLevel === "max") {
            return { ...metadata, detail: detailLevel, [label]: value };
        }
        const serialized = JSON.stringify(value ?? null, null, 2);
        const reportPath = await maybeWriteToolOutputToFile(workspaceRoot, createReportPath(toolName, label), value);
        const preview = Array.isArray(value)
            ? value.slice(0, detailLevel === "full" ? 20 : 8)
            : value && typeof value === "object"
                ? Object.fromEntries(Object.entries(value).slice(0, detailLevel === "full" ? 20 : 10))
                : value;
        return {
            ...metadata,
            detail: detailLevel,
            [`${label}Preview`]: preview,
            [`${label}Length`]: serialized.length,
            reportPath,
            reportReadGuidance: REPORT_READ_GUIDANCE,
        };
    };
    const inferVisionMimeType = (filePath) => {
        const ext = path.extname(String(filePath || "")).toLowerCase();
        if (ext === ".png")
            return "image/png";
        if (ext === ".jpg" || ext === ".jpeg")
            return "image/jpeg";
        if (ext === ".webp")
            return "image/webp";
        if (ext === ".gif")
            return "image/gif";
        if (ext === ".bmp")
            return "image/bmp";
        throw new Error(`Unsupported image format for vision analysis: ${ext || "(no extension)"}.`);
    };
    const parseEmbeddedImageReferences = (value) => {
        const text = String(value || "");
        const matches = [];
        const pattern = /!\[[^\]]*]\(([^)\r\n]+)\)/g;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const raw = String(match[1] || "").trim();
            if (raw)
                matches.push(raw.replace(/^<|>$/g, ""));
        }
        if (matches.length > 0)
            return matches;
        const trimmed = text.trim();
        if (!trimmed)
            return [];
        return [trimmed];
    };
    const resolveEmbeddedImagePath = (value) => {
        const trimmed = String(value || "").trim();
        if (!trimmed)
            throw new Error("Embedded image path is empty.");
        if (/^data:/i.test(trimmed)) {
            throw new Error("Embedded data URLs are not supported by the vision tools. Save the image to a file first.");
        }
        if (/^https?:\/\//i.test(trimmed)) {
            throw new Error("Remote image URLs from markdown embeds are not supported by the vision tools. Download them or use a local file path.");
        }
        const ensureAllowedAbsolutePath = (absolutePath) => {
            const resolved = path.resolve(absolutePath);
            if (allowFullFilesystemAccessMode)
                return resolved;
            const lowerResolved = resolved.toLowerCase();
            const lowerRoot = path.resolve(workspaceRoot).toLowerCase();
            if (!lowerResolved.startsWith(lowerRoot + path.sep) && lowerResolved !== lowerRoot) {
                throw new Error(`Embedded image path is outside the workspace: ${value}`);
            }
            return resolved;
        };
        if (/^file:\/\/\//i.test(trimmed)) {
            const withoutScheme = decodeURIComponent(trimmed.replace(/^file:\/\/\//i, ""));
            return process.platform === "win32"
                ? ensureAllowedAbsolutePath(withoutScheme.replace(/\//g, path.sep))
                : ensureAllowedAbsolutePath(`/${withoutScheme.replace(/^\/+/, "")}`);
        }
        if (process.platform === "win32" && /^\/(?!\/)/.test(trimmed) && !/^[A-Za-z]:[\\/]/.test(trimmed)) {
            const drive = path.parse(workspaceRoot).root.replace(/[\\/]+$/, "");
            return ensureAllowedAbsolutePath(`${drive}${trimmed.replace(/\//g, path.sep)}`);
        }
        if (path.isAbsolute(trimmed) || /^[A-Za-z]:[\\/]/.test(trimmed)) {
            return ensureAllowedAbsolutePath(trimmed);
        }
        return resolveInsideWorkspace(workspaceRoot, trimmed);
    };
    const saveClipboardImageForVision = async (requestedOutputPath) => {
        requireCommandExecution();
        if (process.platform !== "win32") {
            throw new Error("Clipboard image capture for the vision tools is currently supported on Windows only.");
        }
        const relativeOutput = String(requestedOutputPath || "").trim() || path.join("screenshots", `clipboard-vision-${Date.now()}.png`);
        const outputPath = resolveInsideWorkspace(workspaceRoot, relativeOutput);
        await fsp.mkdir(path.dirname(outputPath), { recursive: true });
        const script = [
            "Add-Type -AssemblyName System.Windows.Forms",
            "Add-Type -AssemblyName System.Drawing",
            "if (-not [Windows.Forms.Clipboard]::ContainsImage()) { throw 'Clipboard does not currently contain an image.' }",
            `$path = ${escapeForPowerShellSingleQuoted(outputPath)}`,
            "$img = [Windows.Forms.Clipboard]::GetImage()",
            "$img.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)",
            "$result = @{ path = $path; width = $img.Width; height = $img.Height }",
            "$img.Dispose()",
            "$result | ConvertTo-Json -Compress",
        ].join("\n");
        const result = await runPowerShellScriptFile(script, "clipboard-vision");
        const parsed = result.stdout ? JSON.parse(result.stdout) : null;
        if (result.error || !parsed?.path || !await fileExists(outputPath)) {
            throw new Error(result.stderr || result.error || "Failed to save clipboard image for vision analysis.");
        }
        return {
            fullPath: outputPath,
            relativePath: path.relative(workspaceRoot, outputPath),
            source: "clipboard",
            label: path.basename(outputPath),
            width: parsed.width,
            height: parsed.height,
        };
    };
    const collectVisionInputs = async (params, primaryPath, primaryPathName) => {
        const directTargets = await resolveTargets(params, primaryPath, primaryPathName, { requireFiles: true, allowEmpty: true });
        const collected = directTargets.map((target) => ({
            fullPath: target.fullPath,
            relativePath: target.relativePath,
            source: "file",
            label: path.basename(target.fullPath),
        }));
        const markdownInputs = [
            String(params.embed_markdown || ""),
            ...(Array.isArray(params.embed_markdown_list) ? params.embed_markdown_list : []).map((entry) => String(entry || "")),
        ].filter((entry) => entry.trim().length > 0);
        for (const markdown of markdownInputs) {
            for (const rawReference of parseEmbeddedImageReferences(markdown)) {
                const resolvedPath = resolveEmbeddedImagePath(rawReference);
                if (!await fileExists(resolvedPath)) {
                    throw new Error(`Embedded image path does not exist: ${rawReference}`);
                }
                collected.push({
                    fullPath: resolvedPath,
                    relativePath: path.relative(workspaceRoot, resolvedPath),
                    source: "embed",
                    originalReference: rawReference,
                    label: path.basename(resolvedPath),
                });
            }
        }
        if (params.use_clipboard_image) {
            collected.push(await saveClipboardImageForVision(params.clipboard_output_path));
        }
        const deduped = [];
        const seen = new Set();
        for (const item of collected) {
            const fullPath = path.resolve(String(item.fullPath || ""));
            const dedupeKey = process.platform === "win32" ? fullPath.toLowerCase() : fullPath;
            if (seen.has(dedupeKey))
                continue;
            seen.add(dedupeKey);
            deduped.push({ ...item, fullPath });
        }
        if (deduped.length === 0) {
            throw new Error(`Provide at least one image via ${primaryPathName}, file_list/folder_list, embed_markdown, or use_clipboard_image=true.`);
        }
        return deduped;
    };
    const callVisionModel = async (imagePaths, prompt, maxTokens, requestedModelId = "") => {
        const client = ctl.client;
        if (!client?.llm || !client?.files) {
            throw new Error("LM Studio plugin client is not available for vision analysis in this context.");
        }
        const preferredModel = String(requestedModelId || "").trim();
        const configuredModel = String(ctl.getPluginConfig(configSchematics).get("subAgentModelId") || "").trim();
        const requested = preferredModel || configuredModel || undefined;
        let model;
        try {
            model = requested ? await client.llm.model(requested) : await client.llm.model();
        }
        catch (error) {
            const message = error?.message || String(error || "");
            throw new Error(`Unable to access a loaded LM Studio vision-capable model${requested ? ` (${requested})` : ""}: ${message}`);
        }
        const preparedImages = [];
        for (const image of imagePaths) {
            inferVisionMimeType(image.fullPath);
            preparedImages.push(await client.files.prepareImage(image.fullPath));
        }
        let result;
        try {
            result = await model.respond([
                {
                    role: "user",
                    content: prompt,
                    images: preparedImages,
                },
            ], {
                temperature: 0,
                maxTokens: Math.max(64, Math.min(4096, Number(maxTokens) || 512)),
            });
        }
        catch (error) {
            const message = error?.message || String(error || "");
            throw new Error(`Vision inference failed through the LM Studio SDK: ${message}`);
        }
        const answer = String(result?.content || result?.text || "").trim();
        if (!answer) {
            throw new Error("Vision completion returned an empty response.");
        }
        const modelId = String(result?.modelInfo?.identifier || result?.modelInfo?.key || requested || "current-loaded-model");
        return { modelId, answer };
    };
    const nowMs = () => Date.now();
    const stripVisionCodeFence = (value) => {
        const trimmed = String(value || "").trim();
        const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
        return fenced ? fenced[1].trim() : trimmed;
    };
    const tryParseVisionJson = (value) => {
        const tryValue = (candidate, mode) => {
            if (!candidate)
                return null;
            try {
                const parsed = JSON.parse(candidate);
                if (typeof parsed === "string") {
                    try {
                        return { parsed: JSON.parse(parsed), mode: `${mode}_double` };
                    }
                    catch {
                        return { parsed, mode };
                    }
                }
                return { parsed, mode };
            }
            catch {
                return null;
            }
        };
        const trimmed = String(value || "").trim();
        const fenced = stripVisionCodeFence(trimmed);
        const direct = tryValue(trimmed, "json_direct") || tryValue(fenced, "json_fenced");
        if (direct)
            return direct;
        const candidates = [fenced, trimmed];
        for (const candidate of candidates) {
            const objectStart = candidate.indexOf("{");
            const objectEnd = candidate.lastIndexOf("}");
            if (objectStart >= 0 && objectEnd > objectStart) {
                const parsed = tryValue(candidate.slice(objectStart, objectEnd + 1), "json_extracted_object");
                if (parsed)
                    return parsed;
            }
            const arrayStart = candidate.indexOf("[");
            const arrayEnd = candidate.lastIndexOf("]");
            if (arrayStart >= 0 && arrayEnd > arrayStart) {
                const parsed = tryValue(candidate.slice(arrayStart, arrayEnd + 1), "json_extracted_array");
                if (parsed)
                    return parsed;
            }
        }
        return null;
    };
    const repairVisionMojibake = (value) => {
        let repaired = String(value ?? "");
        const replacements = [
            ["âˆš", "√"],
            ["âˆ’", "−"],
            ["Ã—", "×"],
            ["Ã·", "÷"],
            ["â‰¤", "≤"],
            ["â‰¥", "≥"],
            ["â‰ ", "≠"],
            ["â‰ˆ", "≈"],
            ["Â°", "°"],
            ["Â·", "·"],
        ];
        for (const [from, to] of replacements) {
            repaired = repaired.split(from).join(to);
        }
        return repaired;
    };
    const normalizeVisionText = (value) => repairVisionMojibake(typeof value === "string" ? value : String(value ?? "")).trim();
    const dedupeVisionStrings = (values) => {
        const seen = new Set();
        const results = [];
        for (const entry of values) {
            const normalized = normalizeVisionText(entry);
            if (!normalized)
                continue;
            const key = normalized.toLowerCase();
            if (seen.has(key))
                continue;
            seen.add(key);
            results.push(normalized);
        }
        return results;
    };
    const sanitizeVisionSnippet = (value) => {
        let cleaned = normalizeVisionText(value);
        cleaned = cleaned
            .replace(/^shows?\s+/i, "")
            .replace(/^large\s+/i, "")
            .replace(/^a large number\s+/i, "")
            .replace(/^the result(?: is)?\s+/i, "")
            .replace(/^the expression(?: is)?\s+/i, "")
            .replace(/^the operation(?: is)?\s+/i, "")
            .replace(/^the display(?: shows| is)?\s+/i, "")
            .replace(/^the calculator shows?\s+/i, "")
            .replace(/^['"`]+|['"`]+$/g, "")
            .replace(/[.]+$/g, "")
            .trim();
        const wrappedQuote = cleaned.match(/^"(.+)"$/);
        if (wrappedQuote)
            cleaned = normalizeVisionText(wrappedQuote[1]);
        const wrappedCode = cleaned.match(/^`(.+)`$/);
        if (wrappedCode)
            cleaned = normalizeVisionText(wrappedCode[1]);
        return cleaned;
    };
    const normalizeVisionStringArray = (value) => Array.isArray(value)
        ? dedupeVisionStrings(value.map((entry) => normalizeVisionText(entry)).filter(Boolean))
        : [];
    const normalizeVisionUiReadings = (value) => Array.isArray(value)
        ? (() => {
            const seen = new Set();
            return value
                .map((entry) => {
                if (!entry || typeof entry !== "object")
                    return null;
                const role = normalizeVisionText(entry.role) || "other";
                const text = normalizeVisionText(entry.text);
                if (!role && !text)
                    return null;
                const key = `${role.toLowerCase()}::${text.toLowerCase()}`;
                if (seen.has(key))
                    return null;
                seen.add(key);
                return { role, text };
            })
                .filter(Boolean);
        })()
        : [];
    const extractOcrFallbackFromRawAnswer = (rawAnswer, fallbackLabel = "") => {
        const normalizedAnswer = normalizeVisionText(rawAnswer);
        const cleanedLines = normalizedAnswer
            .split(/\r?\n/)
            .map((line) => normalizeVisionText(line
            .replace(/^\s*(?:\d+\.\s*|[-*•]\s*)/, "")
            .replace(/\*\*/g, "")))
            .filter(Boolean);
        const codeSnippets = dedupeVisionStrings(Array.from(normalizedAnswer.matchAll(/`([^`]+)`/g)).map((match) => sanitizeVisionSnippet(match[1])));
        const quotedSnippets = dedupeVisionStrings(Array.from(normalizedAnswer.matchAll(/["“]([^"\r\n]{1,160})["”]/g)).map((match) => sanitizeVisionSnippet(match[1])));
        const colonValues = dedupeVisionStrings(cleanedLines
            .map((line) => sanitizeVisionSnippet(line.match(/^[A-Za-z][A-Za-z /&()-]{0,60}:\s*(.+)$/)?.[1] || ""))
            .filter(Boolean));
        const usefulLines = dedupeVisionStrings(cleanedLines.filter((line) => {
            if (/^(the user wants\b|analyze\b|identify\b|retry\b|return only\b|output only\b|do not\b|focus on\b|the prompt asks\b|it'?s a\b|it is a\b|this image\b|the image\b|let'?s\b|i need to\b|construct json\b|constructing the json\b|refining the json\b)/i.test(line)) {
                return false;
            }
            if (/^(summary|fulltext|lines|numbers|uireadings|displaycandidates)$/i.test(line)) {
                return false;
            }
            return /[A-Za-z0-9√×÷+\-−=/%().]/.test(line);
        }));
        const lines = dedupeVisionStrings([
            ...codeSnippets,
            ...quotedSnippets,
            ...colonValues,
            ...usefulLines,
        ]).slice(0, 40);
        const numbers = dedupeVisionStrings(Array.from(normalizedAnswer.matchAll(/[+\-−]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+\-]?\d+)?/gi)).map((match) => normalizeVisionText(match[0]))).slice(0, 24);
        const uiReadings = normalizeVisionUiReadings(cleanedLines.flatMap((line) => {
            const match = line.match(/^(?<label>[A-Za-z][A-Za-z /&()-]{0,60}):\s*(?<value>.+)$/);
            if (!match?.groups?.value)
                return [];
            const label = normalizeVisionText(match.groups.label).toLowerCase();
            const value = sanitizeVisionSnippet(match.groups.value);
            if (!value)
                return [];
            if (/(display|result|main large number|large number|value)/i.test(label))
                return [{ role: "display", text: value }];
            if (/(expression|operation|history)/i.test(label))
                return [{ role: "expression", text: value }];
            if (/(title|top left)/i.test(label))
                return [{ role: "title", text: value }];
            if (/(mode|status)/i.test(label))
                return [{ role: "status", text: value }];
            return [{ role: "other", text: value }];
        }));
        const displayCandidates = dedupeVisionStrings([
            ...uiReadings.filter((entry) => entry.role === "display" || entry.role === "expression").map((entry) => entry.text),
            ...codeSnippets.filter((entry) => entry.length <= 64 && /\d|[√×÷=/%()+\-−]/.test(entry)),
            ...quotedSnippets.filter((entry) => entry.length <= 64 && /\d|[√×÷=/%()+\-−]/.test(entry)),
            ...colonValues.filter((entry) => entry.length <= 64 && /\d|[√×÷=/%()+\-−]/.test(entry)),
        ]).slice(0, 12);
        return {
            label: normalizeVisionText(fallbackLabel),
            summary: lines[0] || "",
            text: lines.join("\n") || normalizedAnswer,
            lines,
            numbers,
            uiReadings,
            displayCandidates,
        };
    };
    const callStructuredVisionModel = async (imagePaths, prompts, maxTokens, requestedModelId, validator) => {
        let lastResult = null;
        let lastParseMode = "raw_text_fallback";
        for (let index = 0; index < prompts.length; index++) {
            const result = await callVisionModel(imagePaths, prompts[index], maxTokens, requestedModelId);
            lastResult = result;
            const parsed = tryParseVisionJson(result.answer);
            if (parsed && validator(parsed.parsed)) {
                return {
                    modelId: result.modelId,
                    rawAnswer: result.answer,
                    parsed: parsed.parsed,
                    attempts: index + 1,
                    parseMode: parsed.mode,
                };
            }
            if (parsed) {
                lastParseMode = parsed.mode;
            }
        }
        if (!lastResult) {
            throw new Error("Vision completion returned no usable result.");
        }
        return {
            modelId: lastResult.modelId,
            rawAnswer: lastResult.answer,
            parsed: null,
            attempts: prompts.length,
            parseMode: lastParseMode,
        };
    };
    const tryReadVisionImageDimensions = async (fullPath) => {
        try {
            const buffer = await fsp.readFile(fullPath);
            if (!buffer || buffer.length < 10)
                return null;
            const ascii = (start, end) => buffer.toString("ascii", start, end);
            if (buffer.length >= 24 && buffer[0] === 0x89 && ascii(1, 4) === "PNG") {
                return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
            }
            if (ascii(0, 3) === "GIF") {
                return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
            }
            if (ascii(0, 2) === "BM" && buffer.length >= 26) {
                return { width: Math.abs(buffer.readInt32LE(18)), height: Math.abs(buffer.readInt32LE(22)) };
            }
            if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP" && buffer.length >= 30) {
                const chunkType = ascii(12, 16);
                if (chunkType === "VP8X" && buffer.length >= 30) {
                    const width = 1 + buffer.readUIntLE(24, 3);
                    const height = 1 + buffer.readUIntLE(27, 3);
                    return { width, height };
                }
                if (chunkType === "VP8L" && buffer.length >= 25) {
                    const bits = buffer.readUInt32LE(21);
                    const width = (bits & 0x3FFF) + 1;
                    const height = ((bits >> 14) & 0x3FFF) + 1;
                    return { width, height };
                }
                if (chunkType === "VP8 " && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
                    const width = buffer.readUInt16LE(26) & 0x3FFF;
                    const height = buffer.readUInt16LE(28) & 0x3FFF;
                    return { width, height };
                }
            }
            if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
                let offset = 2;
                while (offset + 9 < buffer.length) {
                    while (offset < buffer.length && buffer[offset] === 0xFF)
                        offset++;
                    if (offset >= buffer.length)
                        break;
                    const marker = buffer[offset++];
                    if (marker === 0xD8 || marker === 0xD9)
                        continue;
                    if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7))
                        continue;
                    if (offset + 1 >= buffer.length)
                        break;
                    const segmentLength = buffer.readUInt16BE(offset);
                    if (segmentLength < 2 || offset + segmentLength > buffer.length)
                        break;
                    const isStartOfFrame = (marker >= 0xC0 && marker <= 0xCF) && ![0xC4, 0xC8, 0xCC].includes(marker);
                    if (isStartOfFrame && offset + 6 < buffer.length) {
                        const height = buffer.readUInt16BE(offset + 3);
                        const width = buffer.readUInt16BE(offset + 5);
                        return { width, height };
                    }
                    offset += segmentLength;
                }
            }
        }
        catch { }
        return null;
    };
    const normalizeVisionLocatorPoint = (value, maxWidth = 0, maxHeight = 0) => {
        if (!value || typeof value !== "object")
            return null;
        const rawX = Number(value.x);
        const rawY = Number(value.y);
        if (!Number.isFinite(rawX) || !Number.isFinite(rawY))
            return null;
        const clamp = (input, max) => {
            const rounded = Math.round(input);
            if (!(max > 0))
                return rounded;
            return Math.max(0, Math.min(max - 1, rounded));
        };
        return {
            x: clamp(rawX, maxWidth),
            y: clamp(rawY, maxHeight),
        };
    };
    const normalizeVisionLocatorBounds = (value, maxWidth = 0, maxHeight = 0) => {
        if (!value || typeof value !== "object")
            return null;
        const rawX = Number(value.x);
        const rawY = Number(value.y);
        const rawWidth = Number(value.width);
        const rawHeight = Number(value.height);
        if (!Number.isFinite(rawX) || !Number.isFinite(rawY) || !Number.isFinite(rawWidth) || !Number.isFinite(rawHeight))
            return null;
        const x = maxWidth > 0 ? Math.max(0, Math.min(maxWidth - 1, Math.round(rawX))) : Math.round(rawX);
        const y = maxHeight > 0 ? Math.max(0, Math.min(maxHeight - 1, Math.round(rawY))) : Math.round(rawY);
        const width = maxWidth > 0
            ? Math.max(1, Math.min(maxWidth - x, Math.round(rawWidth)))
            : Math.max(1, Math.round(rawWidth));
        const height = maxHeight > 0
            ? Math.max(1, Math.min(maxHeight - y, Math.round(rawHeight)))
            : Math.max(1, Math.round(rawHeight));
        return { x, y, width, height };
    };
    tools.push(tool({
        name: "as_vision_target",
        description: "Use the currently loaded LM Studio multimodal model to locate click, drag, crop, or inspection targets inside an image and return approximate image-relative coordinates and bounds for buttons, sliders, icons, labels, or other sub-elements. Prefer this when you need positions rather than general descriptions. `fast=true` is the default and should be the normal first pass; only retry with `fast=false` when the fast result is incomplete, clearly wrong, or too uncertain.",
        parameters: {
            path: z.string().default(""),
            ...fileSelectionParameters,
            embed_markdown: z.string().default(""),
            embed_markdown_list: z.array(z.string()).default([]),
            use_clipboard_image: z.boolean().default(false),
            clipboard_output_path: z.string().default(""),
            target: z.string().default(""),
            targets_json: z.string().default("[]"),
            question: z.string().default(""),
            fast: z.boolean().default(true),
            model_id: z.string().default(""),
            max_tokens: z.number().int().min(32).max(4096).default(768),
        },
        implementation: safeTool("as_vision_target", async (params) => {
            const { path: relPath, target, targets_json, question, fast, model_id, max_tokens } = params;
            const startedAt = nowMs();
            const inputs = await collectVisionInputs(params, relPath, "path");
            const parsedTargets = JSON.parse(String(targets_json || "[]"));
            if (!Array.isArray(parsedTargets) || parsedTargets.some((entry) => typeof entry !== "string")) {
                throw new Error("targets_json must be a JSON string array.");
            }
            const requestedTargets = dedupeVisionStrings([
                ...normalizeVisionStringArray(parsedTargets),
                ...String(target || "").split(",").map((entry) => normalizeVisionText(entry)).filter(Boolean),
            ]);
            if (requestedTargets.length === 0) {
                throw new Error("Provide target or targets_json with one or more labels to locate.");
            }
            const requestedQuestion = normalizeVisionText(question);
            const fastMode = fast !== false;
            const effectiveMaxTokens = fastMode
                ? Math.max(224, Math.min(640, Number(max_tokens) || 448))
                : Math.max(384, Math.min(4096, Number(max_tokens) || 768));
            const inputImageInfo = await Promise.all(inputs.map(async (entry) => ({
                label: String(entry.label || ""),
                path: String(entry.relativePath || ""),
                dimensions: await tryReadVisionImageDimensions(String(entry.fullPath || "")),
            })));
            const sizeGuidance = inputImageInfo
                .map((entry, index) => {
                const dims = entry.dimensions;
                const prefix = inputs.length > 1 ? `Image ${index + 1} (${entry.label || entry.path || `image-${index + 1}`})` : "Image";
                return dims ? `${prefix} size: ${dims.width}x${dims.height} pixels.` : `${prefix} size: unknown; still return image-relative coordinates from the top-left corner.`;
            })
                .join("\n");
            const targetListText = requestedTargets.map((entry, index) => `${index + 1}. ${entry}`).join("\n");
            const schemaText = inputs.length === 1
                ? "{\"summary\":\"short locating summary\",\"targets\":[{\"label\":\"requested target name\",\"found\":true,\"confidence\":\"high|medium|low\",\"center\":{\"x\":123,\"y\":456},\"bounds\":{\"x\":100,\"y\":430,\"width\":80,\"height\":30},\"text\":\"visible text if any\",\"state\":\"current visible state or value\",\"notes\":\"short locating note\"}]}"
                : "{\"images\":[{\"label\":\"file label\",\"summary\":\"short locating summary\",\"targets\":[{\"label\":\"requested target name\",\"found\":true,\"confidence\":\"high|medium|low\",\"center\":{\"x\":123,\"y\":456},\"bounds\":{\"x\":100,\"y\":430,\"width\":80,\"height\":30},\"text\":\"visible text if any\",\"state\":\"current visible state or value\",\"notes\":\"short locating note\"}]}]}";
            const prompts = [
                [
                    "You are a UI target locator for screenshots and interface images.",
                    "Return ONLY valid JSON. No markdown. No commentary. No reasoning.",
                    "Estimate image-relative coordinates from the top-left corner of each image.",
                    "Use integer pixel coordinates and bounds.",
                    "Never return coordinates outside the stated image width or height.",
                    "Prefer the actionable center of the visible interactive element itself, not a nearby label, unless the label is the requested target.",
                    "For sliders, return the handle center and bounds when visible; for buttons, icons, and value boxes, return the clickable center of that exact control.",
                    requestedQuestion
                        ? `Context: ${requestedQuestion}`
                        : "Context: locate the requested interactive or visual targets so an automation agent can click, drag, crop, or inspect them.",
                    sizeGuidance,
                    "Requested targets:",
                    targetListText,
                    "For each target, set found=false if it is not visible. If it is visible but approximate, still provide the best estimate and lower the confidence.",
                    `JSON schema: ${schemaText}`,
                ].join("\n"),
                ...(!fastMode ? [[
                        "Retry with stricter formatting.",
                        "Output ONLY minified JSON matching the schema exactly.",
                        "Do not emit think tags, XML tags, markdown fences, or analysis.",
                        sizeGuidance,
                        "Requested targets:",
                        targetListText,
                        `JSON schema: ${schemaText}`,
                    ].join("\n")] : []),
            ];
            const { modelId, rawAnswer, parsed, attempts, parseMode } = await callStructuredVisionModel(inputs.map((entry) => ({ fullPath: String(entry.fullPath), label: String(entry.label || "") })), prompts, effectiveMaxTokens, model_id, (value) => {
                if (!value || typeof value !== "object")
                    return false;
                return Array.isArray(value.targets)
                    || Array.isArray(value.images);
            });
            const normalizeTargetEntry = (entry, fallbackLabel, maxWidth = 0, maxHeight = 0) => {
                const bounds = normalizeVisionLocatorBounds(entry.bounds, maxWidth, maxHeight);
                const center = normalizeVisionLocatorPoint(entry.center, maxWidth, maxHeight)
                    || (bounds ? { x: bounds.x + Math.floor(bounds.width / 2), y: bounds.y + Math.floor(bounds.height / 2) } : null);
                const found = entry.found === false ? false : Boolean(center || bounds || normalizeVisionText(entry.text || entry.state));
                return {
                    label: normalizeVisionText(entry.label || fallbackLabel) || fallbackLabel,
                    found,
                    confidence: (() => {
                        const raw = normalizeVisionText(entry.confidence).toLowerCase();
                        if (raw === "high" || raw === "medium" || raw === "low")
                            return raw;
                        return found ? "medium" : "low";
                    })(),
                    center,
                    bounds,
                    text: normalizeVisionText(entry.text),
                    state: normalizeVisionText(entry.state),
                    notes: normalizeVisionText(entry.notes),
                };
            };
            const basePayload = {
                count: inputs.length,
                modelId,
                fast: fastMode,
                effectiveMaxTokens,
                attempts,
                parseMode,
                durationMs: Math.max(0, nowMs() - startedAt),
                requestedTargets,
                inputs: inputs.map((entry, index) => ({
                    path: entry.relativePath,
                    source: entry.source,
                    label: entry.label,
                    originalReference: entry.originalReference,
                    dimensions: inputImageInfo[index]?.dimensions || undefined,
                })),
            };
            if (parsed && typeof parsed === "object" && Array.isArray(parsed.images)) {
                return json({
                    ...basePayload,
                    results: parsed.images
                        .map((entry, index) => {
                        const dims = inputImageInfo[index]?.dimensions;
                        const targetEntries = Array.isArray(entry.targets) ? entry.targets : [];
                        return {
                            label: normalizeVisionText(entry.label || inputs[index]?.label || `image-${index + 1}`),
                            summary: normalizeVisionText(entry.summary),
                            dimensions: dims || undefined,
                            targets: requestedTargets.map((targetLabel, targetIndex) => normalizeTargetEntry(targetEntries[targetIndex] || {}, targetLabel, Number(dims?.width) || 0, Number(dims?.height) || 0)),
                        };
                    }),
                });
            }
            if (parsed && typeof parsed === "object") {
                const dims = inputImageInfo[0]?.dimensions;
                const targetEntries = Array.isArray(parsed.targets)
                    ? parsed.targets
                    : [];
                return json({
                    ...basePayload,
                    summary: normalizeVisionText(parsed.summary),
                    dimensions: dims || undefined,
                    targets: requestedTargets.map((targetLabel, targetIndex) => normalizeTargetEntry(targetEntries[targetIndex] || {}, targetLabel, Number(dims?.width) || 0, Number(dims?.height) || 0)),
                });
            }
            return json({
                ...basePayload,
                rawTextFallback: true,
                answer: rawAnswer,
            });
        }),
    }));
    tools.push(tool({
        name: "as_pdf_extract_text",
        description: "Extract text from one or more local PDFs.",
        parameters: {
            pdf_path: z.string().default(""),
            ...fileSelectionParameters,
            max_pages: z.number().int().min(1).max(5000).default(100),
        },
        implementation: safeTool("as_pdf_extract_text", async (params) => {
            const { pdf_path, max_pages } = params;
            requireCommandExecution();
            const targets = await resolveTargets(params, pdf_path, "pdf_path", { requireFiles: true });
            const pdfToTextPath = await resolveExecutablePath(ctl, env, "pdfToTextPath", "pdftotext");
            const results = [];
            for (const target of targets) {
                const script = [
                    "import json, subprocess, sys",
                    `pdf_path = r"${escapeForPython(target.fullPath)}"`,
                    `pdftotext_path = r"${escapeForPython(pdfToTextPath)}"`,
                    `max_pages = ${max_pages}`,
                    "text = ''",
                    "engine = None",
                    "try:",
                    "    from pypdf import PdfReader",
                    "    reader = PdfReader(pdf_path)",
                    "    parts = []",
                    "    for page in reader.pages[:max_pages]:",
                    "        parts.append(page.extract_text() or '')",
                    "    text = '\\n\\n'.join(parts)",
                    "    engine = 'pypdf'",
                    "except Exception:",
                    "    try:",
                    "        from PyPDF2 import PdfReader",
                    "        reader = PdfReader(pdf_path)",
                    "        parts = []",
                    "        for page in reader.pages[:max_pages]:",
                    "            parts.append(page.extract_text() or '')",
                    "        text = '\\n\\n'.join(parts)",
                    "        engine = 'PyPDF2'",
                    "    except Exception:",
                    "        try:",
                    "            result = subprocess.run([pdftotext_path, pdf_path, '-'], capture_output=True, text=True, check=True)",
                    "            text = result.stdout",
                    "            engine = 'pdftotext'",
                    "        except Exception as exc:",
                    "            raise RuntimeError('No supported PDF text extraction backend found. Install pypdf, PyPDF2, or pdftotext.') from exc",
                    "print(json.dumps({'engine': engine, 'text': text}, ensure_ascii=False))",
                ].join("\n");
                const result = await executeInlinePython(ctl, pythonExecutable, script, shell, env, workspaceRoot, Math.max(timeoutMs, 120000), maxOutputBytes);
                const response = JSON.parse(buildCommandResponse(`python pdf extract ${target.relativePath}`, result));
                results.push({ path: target.relativePath, ...response });
            }
            return json(results.length === 1 ? results[0] : { count: results.length, results });
        }),
    }));
    tools.push(tool({
        name: "as_archive",
        description: "List, extract, compress, uncompress, or stream archive/compressed files through one controller.",
        parameters: {
            action: z.enum(["list", "extract", "compress", "uncompress", "stream"]),
            archive_path: z.string().default(""),
            path: z.string().default(""),
            ...fileSelectionParameters,
            destination: z.string().default("."),
            output_path: z.string().default(""),
            overwrite: z.boolean().default(false),
            level: z.number().int().min(1).max(22).optional(),
            offset_bytes: z.number().int().min(0).default(0),
            length_bytes: z.number().int().min(1).max(10485760).default(65536),
            encoding: z.enum(["utf8", "base64", "hex"]).default("utf8"),
            limit: z.number().int().min(1).max(5000).default(500),
        },
        implementation: safeTool("as_archive", async (params) => {
            const { action, archive_path, path: relPath, destination, output_path, overwrite, level, offset_bytes, length_bytes, encoding, limit } = params;
            requireCommandExecution();
            const selectedAction = String(action);
            const inferArchiveFormat = (targetPath) => {
                const lower = String(targetPath || "").trim().toLowerCase();
                if (!lower)
                    return null;
                if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz"))
                    return "tar.gz";
                if (lower.endsWith(".zip"))
                    return "zip";
                if (lower.endsWith(".zst") || lower.endsWith(".zstd"))
                    return "zstd";
                return null;
            };
            const archiveExtensionForFormat = (format) => format === "zip" ? ".zip" : format === "tar.gz" ? ".tar.gz" : ".zst";
            const stripArchiveExtension = (targetPath) => {
                const lower = targetPath.toLowerCase();
                if (lower.endsWith(".tar.gz"))
                    return targetPath.slice(0, -7);
                if (lower.endsWith(".tgz"))
                    return targetPath.slice(0, -4);
                if (lower.endsWith(".zstd"))
                    return targetPath.slice(0, -5);
                if (lower.endsWith(".zst"))
                    return targetPath.slice(0, -4);
                if (lower.endsWith(".zip"))
                    return targetPath.slice(0, -4);
                return targetPath;
            };
            if (selectedAction === "list") {
                const targets = await resolveTargets(params, String(archive_path || relPath), "archive_path", { requireFiles: true });
                const results = [];
                for (const target of targets) {
                    const script = [
                        "import json, os, tarfile, zipfile",
                        `archive_path = r"${escapeForPython(target.fullPath)}"`,
                        `limit = ${limit}`,
                        "result = {'archive': archive_path, 'type': None, 'entries': []}",
                        "lower_path = archive_path.lower()",
                        "if zipfile.is_zipfile(archive_path):",
                        "    result['type'] = 'zip'",
                        "    with zipfile.ZipFile(archive_path, 'r') as archive:",
                        "        for info in archive.infolist()[:limit]:",
                        "            result['entries'].append({'path': info.filename, 'sizeBytes': info.file_size, 'compressedBytes': info.compress_size, 'isDirectory': info.is_dir()})",
                        "elif tarfile.is_tarfile(archive_path):",
                        "    result['type'] = 'tar.gz' if lower_path.endswith(('.tar.gz', '.tgz')) else 'tar'",
                        "    with tarfile.open(archive_path, 'r:*') as archive:",
                        "        for info in archive.getmembers()[:limit]:",
                        "            result['entries'].append({'path': info.name, 'sizeBytes': info.size, 'isDirectory': info.isdir()})",
                        "elif lower_path.endswith(('.zst', '.zstd')):",
                        "    try:",
                        "        import zstandard as zstd",
                        "    except Exception as exc:",
                        "        raise RuntimeError('as_archive action=list requires the Python zstandard package for zstd files.') from exc",
                        "    result['type'] = 'zstd'",
                        "    output_name = os.path.basename(archive_path)",
                        "    if lower_path.endswith('.zstd'): output_name = output_name[:-5]",
                        "    elif lower_path.endswith('.zst'): output_name = output_name[:-4]",
                        "    with open(archive_path, 'rb') as src:",
                        "        header = src.read(18)",
                        "    try:",
                        "        content_size = zstd.frame_content_size(header)",
                        "        if content_size in (zstd.CONTENTSIZE_UNKNOWN, zstd.CONTENTSIZE_ERROR): content_size = None",
                        "    except Exception:",
                        "        content_size = None",
                        "    result['entries'].append({'path': output_name or os.path.basename(archive_path), 'sizeBytes': content_size, 'compressedBytes': os.path.getsize(archive_path), 'isDirectory': False})",
                        "else:",
                        "    raise ValueError('Unsupported archive format.')",
                        "result['truncated'] = len(result['entries']) >= limit",
                        "print(json.dumps(result, ensure_ascii=False))",
                    ].join("\n");
                    const result = await executeInlinePython(ctl, pythonExecutable, script, shell, env, workspaceRoot, Math.max(timeoutMs, 120000), maxOutputBytes);
                    const response = JSON.parse(buildCommandResponse(`python archive list ${target.relativePath}`, result));
                    results.push({ path: target.relativePath, ...response });
                }
                return json(results.length === 1 ? results[0] : { count: results.length, results });
            }
            if (selectedAction === "extract") {
                const targets = await resolveTargets(params, String(archive_path || relPath), "archive_path", { requireFiles: true });
                const destinationRoot = resolveInsideWorkspace(workspaceRoot, destination);
                const batchMode = targets.length > 1 || hasBatchSelection(params);
                const results = [];
                for (const target of targets) {
                    const destinationPath = batchMode
                        ? path.join(destinationRoot, path.parse(target.fullPath).name)
                        : destinationRoot;
                    const script = [
                        "import json, os, tarfile, zipfile",
                        `archive_path = r"${escapeForPython(target.fullPath)}"`,
                        `destination = r"${escapeForPython(destinationPath)}"`,
                        `overwrite = ${overwrite ? "True" : "False"}`,
                        "destination = os.path.abspath(destination)",
                        "def safe_join(base, member_name):",
                        "    target = os.path.abspath(os.path.join(base, member_name))",
                        "    if os.path.commonpath([base, target]) != base:",
                        "        raise ValueError(f'Archive member escapes destination: {member_name}')",
                        "    return target",
                        "os.makedirs(destination, exist_ok=True)",
                        "if not overwrite and os.listdir(destination):",
                        "    raise ValueError('Destination directory is not empty and overwrite is false.')",
                        "count = 0",
                        "if zipfile.is_zipfile(archive_path):",
                        "    with zipfile.ZipFile(archive_path, 'r') as archive:",
                        "        members = archive.infolist()",
                        "        for info in members: safe_join(destination, info.filename)",
                        "        count = len(members)",
                        "        for info in members:",
                        "            target = safe_join(destination, info.filename)",
                        "            if info.is_dir(): os.makedirs(target, exist_ok=True); continue",
                        "            os.makedirs(os.path.dirname(target), exist_ok=True)",
                        "            with archive.open(info, 'r') as src, open(target, 'wb') as dst: dst.write(src.read())",
                        "elif tarfile.is_tarfile(archive_path):",
                        "    with tarfile.open(archive_path, 'r:*') as archive:",
                        "        members = archive.getmembers()",
                        "        for member in members:",
                        "            if member.issym() or member.islnk(): raise ValueError(f'Archive link entries are not allowed: {member.name}')",
                        "            safe_join(destination, member.name)",
                        "        count = len(members)",
                        "        for member in members: archive.extract(member, destination)",
                        "elif archive_path.lower().endswith(('.zst', '.zstd')):",
                        "    try:",
                        "        import zstandard as zstd",
                        "    except Exception as exc:",
                        "        raise RuntimeError('as_archive action=extract requires the Python zstandard package for zstd files.') from exc",
                        "    inferred_name = os.path.basename(archive_path)",
                        "    if archive_path.lower().endswith('.zstd'): inferred_name = inferred_name[:-5]",
                        "    elif archive_path.lower().endswith('.zst'): inferred_name = inferred_name[:-4]",
                        "    target = safe_join(destination, inferred_name or (os.path.basename(archive_path) + '.out'))",
                        "    if os.path.exists(target) and not overwrite:",
                        "        raise ValueError('Destination file already exists and overwrite is false.')",
                        "    os.makedirs(os.path.dirname(target), exist_ok=True)",
                        "    with open(archive_path, 'rb') as src, open(target, 'wb') as dst:",
                        "        zstd.ZstdDecompressor().copy_stream(src, dst)",
                        "    count = 1",
                        "else:",
                        "    raise ValueError('Unsupported archive format.')",
                        "print(json.dumps({'archive': archive_path, 'destination': destination, 'entriesExtracted': count}, ensure_ascii=False))",
                    ].join("\n");
                    const result = await executeInlinePython(ctl, pythonExecutable, script, shell, env, workspaceRoot, Math.max(timeoutMs, 120000), maxOutputBytes);
                    const response = JSON.parse(buildCommandResponse(`python archive extract ${target.relativePath}`, result));
                    results.push({ path: target.relativePath, destination: path.relative(workspaceRoot, destinationPath), ...response });
                }
                return json(results.length === 1 ? results[0] : { count: results.length, results });
            }
            if (selectedAction === "compress") {
                const targets = await resolveTargets(params, relPath, "path", { requireFiles: false, includeDirectories: true });
                const targetEntries = [];
                for (const target of targets) {
                    const stat = await fsp.lstat(target.fullPath);
                    targetEntries.push({ target, isDirectory: stat.isDirectory() });
                }
                const batchMode = targetEntries.length > 1 || hasBatchSelection(params);
                const effectiveLevel = level ?? getZstdCompressionLevel(ctl);
                const outputHint = String(output_path || "").trim();
                const explicitFormat = inferArchiveFormat(outputHint);
                if (batchMode && outputHint && explicitFormat) {
                    throw new Error("When compressing multiple targets, output_path must be a directory or omitted, not a single archive filename.");
                }
                const results = [];
                for (const entry of targetEntries) {
                    const { target, isDirectory } = entry;
                    const format = explicitFormat || (isDirectory ? "zip" : "zstd");
                    if (format === "zstd" && isDirectory) {
                        throw new Error("zstd compression only supports single files. Use .zip or .tar.gz for directories.");
                    }
                    const destinationPath = (() => {
                        const extension = archiveExtensionForFormat(format);
                        if (batchMode) {
                            const outputDir = outputHint
                                ? resolveInsideWorkspace(workspaceRoot, outputHint)
                                : path.dirname(target.fullPath);
                            return path.join(outputDir, `${path.basename(target.fullPath)}${extension}`);
                        }
                        if (!outputHint) {
                            return resolveInsideWorkspace(workspaceRoot, `${target.relativePath}${extension}`);
                        }
                        const resolvedOutput = resolveInsideWorkspace(workspaceRoot, outputHint);
                        if (explicitFormat) {
                            return resolvedOutput;
                        }
                        return path.join(resolvedOutput, `${path.basename(target.fullPath)}${extension}`);
                    })();
                    if (await fileExists(destinationPath) && !overwrite) {
                        results.push({ source: target.relativePath, destination: path.relative(workspaceRoot, destinationPath), status: "skipped", reason: "Destination exists." });
                        continue;
                    }
                    await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
                    let script = "";
                    let commandLabel = "";
                    if (format === "zip") {
                        commandLabel = `python zip compress ${target.relativePath}`;
                        script = [
                            "import json, os, zipfile",
                            `source_path = r"${escapeForPython(target.fullPath)}"`,
                            `destination_path = r"${escapeForPython(destinationPath)}"`,
                            `level = ${Math.max(0, Math.min(9, Number(effectiveLevel)))}`,
                            "base_name = os.path.basename(source_path.rstrip(os.sep))",
                            "with zipfile.ZipFile(destination_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=level) as archive:",
                            "    if os.path.isdir(source_path):",
                            "        root_parent = os.path.dirname(source_path.rstrip(os.sep))",
                            "        for root, dirs, files in os.walk(source_path):",
                            "            rel_root = os.path.relpath(root, root_parent)",
                            "            if not files and not dirs:",
                            "                archive.writestr(rel_root.rstrip('/') + '/', '')",
                            "            for file_name in files:",
                            "                full_path = os.path.join(root, file_name)",
                            "                archive.write(full_path, os.path.join(rel_root, file_name))",
                            "    else:",
                            "        archive.write(source_path, base_name)",
                            "print(json.dumps({'source': source_path, 'destination': destination_path, 'format': 'zip', 'level': level}, ensure_ascii=False))",
                        ].join("\n");
                    }
                    else if (format === "tar.gz") {
                        commandLabel = `python tar.gz compress ${target.relativePath}`;
                        script = [
                            "import json, os, tarfile",
                            `source_path = r"${escapeForPython(target.fullPath)}"`,
                            `destination_path = r"${escapeForPython(destinationPath)}"`,
                            `level = ${Math.max(1, Math.min(9, Number(effectiveLevel)))}`,
                            "base_name = os.path.basename(source_path.rstrip(os.sep))",
                            "with tarfile.open(destination_path, 'w:gz', compresslevel=level) as archive:",
                            "    archive.add(source_path, arcname=base_name)",
                            "print(json.dumps({'source': source_path, 'destination': destination_path, 'format': 'tar.gz', 'level': level}, ensure_ascii=False))",
                        ].join("\n");
                    }
                    else {
                        commandLabel = `python zstd compress ${target.relativePath}`;
                        script = [
                            "import json",
                            "try:",
                            "    import zstandard as zstd",
                            "except Exception as exc:",
                            "    raise RuntimeError('as_archive action=compress requires the Python zstandard package for zstd output.') from exc",
                            `source_path = r"${escapeForPython(target.fullPath)}"`,
                            `destination_path = r"${escapeForPython(destinationPath)}"`,
                            `level = ${effectiveLevel}`,
                            "compressor = zstd.ZstdCompressor(level=level)",
                            "with open(source_path, 'rb') as src, open(destination_path, 'wb') as dst:",
                            "    compressor.copy_stream(src, dst)",
                            "print(json.dumps({'source': source_path, 'destination': destination_path, 'format': 'zstd', 'level': level}, ensure_ascii=False))",
                        ].join("\n");
                    }
                    const result = await executeInlinePython(ctl, pythonExecutable, script, shell, env, workspaceRoot, Math.max(timeoutMs, 120000), maxOutputBytes);
                    const response = JSON.parse(buildCommandResponse(commandLabel, result));
                    results.push({ source: target.relativePath, destination: path.relative(workspaceRoot, destinationPath), ...response });
                }
                return json(results.length === 1 ? results[0] : { count: results.length, results });
            }
            if (selectedAction === "uncompress") {
                const targets = await resolveTargets(params, String(archive_path || relPath), "path", { requireFiles: true });
                const batchMode = targets.length > 1 || hasBatchSelection(params);
                const outputRoot = String(output_path || "").trim() ? resolveInsideWorkspace(workspaceRoot, output_path) : "";
                const results = [];
                for (const target of targets) {
                    const detectedFormat = inferArchiveFormat(target.relativePath);
                    if (detectedFormat !== "zstd") {
                        throw new Error("as_archive action=uncompress currently supports zstd files (.zst/.zstd) only.");
                    }
                    const inferredName = path.basename(stripArchiveExtension(target.relativePath)) || `${path.basename(target.relativePath)}.out`;
                    const destinationPath = batchMode
                        ? path.join(outputRoot || path.dirname(target.fullPath), inferredName)
                        : (outputRoot || resolveInsideWorkspace(workspaceRoot, stripArchiveExtension(target.relativePath)));
                    if (await fileExists(destinationPath) && !overwrite) {
                        results.push({ source: target.relativePath, destination: path.relative(workspaceRoot, destinationPath), status: "skipped", reason: "Destination exists." });
                        continue;
                    }
                    await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
                    const script = [
                        "import json",
                        "try:",
                        "    import zstandard as zstd",
                        "except Exception as exc:",
                        "    raise RuntimeError('as_archive action=uncompress requires the Python zstandard package.') from exc",
                        `source_path = r"${escapeForPython(target.fullPath)}"`,
                        `destination_path = r"${escapeForPython(destinationPath)}"`,
                        "decompressor = zstd.ZstdDecompressor()",
                        "with open(source_path, 'rb') as src, open(destination_path, 'wb') as dst:",
                        "    decompressor.copy_stream(src, dst)",
                        "print(json.dumps({'source': source_path, 'destination': destination_path}, ensure_ascii=False))",
                    ].join("\n");
                    const result = await executeInlinePython(ctl, pythonExecutable, script, shell, env, workspaceRoot, Math.max(timeoutMs, 120000), maxOutputBytes);
                    const response = JSON.parse(buildCommandResponse(`python zstd uncompress ${target.relativePath}`, result));
                    results.push({ source: target.relativePath, destination: path.relative(workspaceRoot, destinationPath), ...response });
                }
                return json(results.length === 1 ? results[0] : { count: results.length, results });
            }
            if (selectedAction === "stream") {
                const targets = await resolveTargets(params, String(archive_path || relPath), "path", { requireFiles: true });
                const results = [];
                for (const target of targets) {
                    const detectedFormat = inferArchiveFormat(target.relativePath);
                    if (detectedFormat !== "zstd") {
                        throw new Error("as_archive action=stream currently supports zstd files (.zst/.zstd) only.");
                    }
                    const script = [
                        "import base64, json",
                        "try:",
                        "    import zstandard as zstd",
                        "except Exception as exc:",
                        "    raise RuntimeError('as_archive action=stream requires the Python zstandard package.') from exc",
                        `source_path = r"${escapeForPython(target.fullPath)}"`,
                        `offset_bytes = ${offset_bytes}`,
                        `length_bytes = ${length_bytes}`,
                        `encoding = ${JSON.stringify(encoding)}`,
                        "with open(source_path, 'rb') as src:",
                        "    reader = zstd.ZstdDecompressor().stream_reader(src)",
                        "    consumed = 0",
                        "    captured = b''",
                        "    while len(captured) < length_bytes:",
                        "        chunk = reader.read(65536)",
                        "        if not chunk: break",
                        "        next_consumed = consumed + len(chunk)",
                        "        if next_consumed > offset_bytes and consumed < offset_bytes + length_bytes:",
                        "            start = max(0, offset_bytes - consumed)",
                        "            end = min(len(chunk), offset_bytes + length_bytes - consumed)",
                        "            captured += chunk[start:end]",
                        "        consumed = next_consumed",
                        "payload = captured.decode('utf-8', errors='replace') if encoding == 'utf8' else (captured.hex() if encoding == 'hex' else base64.b64encode(captured).decode('ascii'))",
                        "print(json.dumps({'offsetBytes': offset_bytes, 'lengthBytes': len(captured), 'encoding': encoding, 'payload': payload}, ensure_ascii=False))",
                    ].join("\n");
                    const result = await executeInlinePython(ctl, pythonExecutable, script, shell, env, workspaceRoot, Math.max(timeoutMs, 120000), maxOutputBytes);
                    const response = JSON.parse(buildCommandResponse(`python zstd stream ${target.relativePath}`, result));
                    results.push({ path: target.relativePath, ...response });
                }
                return json(results.length === 1 ? results[0] : { count: results.length, results });
            }
            throw new Error(`Unsupported archive action: ${selectedAction}`);
        }),
    }));
    tools.push(tool({
        name: "as_database_query",
        description: "Run read-only SQLite, Postgres, or MySQL queries through one database controller.",
        parameters: {
            driver: z.enum(["sqlite", "postgres", "mysql"]),
            database_path: z.string().default(""),
            ...fileSelectionParameters,
            query: z.string(),
            params_json: z.string().default("[]"),
            limit: z.number().int().min(1).max(5000).default(200),
            connection_uri: z.string().default(""),
            database: z.string().default(""),
            output_format: z.enum(["json", "csv", "tsv", "table"]).default("json"),
            detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
            defaults_file: z.string().default(""),
            host: z.string().default(""),
            port: z.number().int().min(1).max(65535).default(3306),
            user: z.string().default(""),
            password_env_var: z.string().default("MYSQL_PWD"),
            timeout_ms: z.number().int().min(1000).max(300000).default(60000),
        },
        implementation: safeTool("as_database_query", async (params) => {
            const { driver, database_path, query, params_json, limit, connection_uri, database, output_format, detail, defaults_file, host, port, user, password_env_var, timeout_ms } = params;
            const detailLevel = normalizeDetailLevel(detail);
            requireCommandExecution();
            if (driver === "sqlite") {
                const trimmedQuery = normalizeReadOnlySql(query, /^(select|pragma|with)\b/i, "as_database_query sqlite");
                JSON.parse(params_json);
                const targets = await resolveTargets(params, database_path, "database_path", { requireFiles: true });
                const results = [];
                for (const target of targets) {
                    const databasePath = target.fullPath;
                    const paramsPath = path.join(os.tmpdir(), `mc-sqlite-params-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
                    try {
                        await fsp.writeFile(paramsPath, params_json, "utf8");
                        const script = [
                            "import json, sqlite3",
                            "from pathlib import Path",
                            `db_path = r"${escapeForPython(databasePath)}"`,
                            `query = """${trimmedQuery.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"')}"""`,
                            `params_path = r"${escapeForPython(paramsPath)}"`,
                            `limit = ${limit}`,
                            "with open(params_path, 'r', encoding='utf-8') as handle:",
                            "    params = json.load(handle)",
                            "connection = sqlite3.connect(Path(db_path).resolve().as_uri() + '?mode=ro', uri=True)",
                            "try:",
                            "    connection.execute('PRAGMA query_only = ON')",
                            "    connection.row_factory = sqlite3.Row",
                            "    cursor = connection.execute(query, params)",
                            "    rows = [dict(row) for row in cursor.fetchmany(limit)]",
                            "    print(json.dumps({'rowCount': len(rows), 'rows': rows}, ensure_ascii=False, default=str))",
                            "finally:",
                            "    connection.close()",
                        ].join("\n");
                        const result = await executeInlinePython(ctl, pythonExecutable, script, shell, env, workspaceRoot, Math.max(timeoutMs, 120000), maxOutputBytes);
                        const parsed = JSON.parse(buildCommandResponse(`python sqlite query ${target.relativePath}`, result));
                        const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
                        results.push(await compactRowsResult("as_database_query", detailLevel, { databasePath: target.relativePath, ...parsed, rowCount: parsed.rowCount ?? rows.length }, rows));
                    }
                    finally {
                        await fsp.rm(paramsPath, { force: true });
                    }
                }
                return json(results.length === 1 ? results[0] : { count: results.length, results });
            }
            if (driver === "postgres") {
                const trimmedQuery = normalizeReadOnlySql(query, /^(select|with|show|explain)\b/i, "as_database_query postgres");
                const psqlPath = await resolveExecutablePath(ctl, env, "psqlPath", "psql");
                const targetArgs = String(connection_uri || "").trim()
                    ? quote(String(connection_uri))
                    : (String(database || "").trim() ? `-d ${quote(String(database))}` : "");
                const format = output_format === "csv" ? "csv" : "json";
                const command = format === "csv"
                    ? `${quote(psqlPath)} ${targetArgs} --csv --set=ON_ERROR_STOP=1 -c ${quote("BEGIN READ ONLY;")} -c ${quote(trimmedQuery)} -c ${quote("COMMIT;")}`
                    : `${quote(psqlPath)} ${targetArgs} -t -A -F ${quote("\t")} --set=ON_ERROR_STOP=1 -c ${quote("BEGIN READ ONLY;")} -c ${quote(trimmedQuery)} -c ${quote("COMMIT;")}`;
                const result = await executeManagedCommand(ctl, command.trim(), { cwd: workspaceRoot, shell, env }, timeout_ms, maxOutputBytes);
                return buildCommandResponse(command.trim(), result);
            }
            if (driver === "mysql") {
                const trimmedQuery = normalizeReadOnlySql(query, /^(select|with|show|explain)\b/i, "as_database_query mysql");
                const mysqlPath = await resolveExecutablePath(ctl, env, "mysqlPath", "mysql");
                const parts = [quote(mysqlPath)];
                if (String(defaults_file || "").trim())
                    parts.push(`--defaults-extra-file=${quote(resolveInsideWorkspace(workspaceRoot, defaults_file))}`);
                if (String(host || "").trim())
                    parts.push(`-h ${quote(String(host))}`);
                if (typeof port === "number")
                    parts.push(`-P ${Number(port)}`);
                if (String(user || "").trim())
                    parts.push(`-u ${quote(String(user))}`);
                if (String(database || "").trim())
                    parts.push(quote(String(database)));
                parts.push(output_format === "table" ? "" : "--batch --raw --silent");
                parts.push(`-e ${quote(`START TRANSACTION READ ONLY; ${trimmedQuery}; ROLLBACK;`)}`);
                const command = parts.filter(Boolean).join(" ");
                const extraEnv = { ...env };
                if (String(password_env_var || "").trim() && process.env[String(password_env_var)] !== undefined) {
                    extraEnv.MYSQL_PWD = process.env[String(password_env_var)];
                }
                const result = await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env: extraEnv }, timeout_ms, maxOutputBytes);
                return buildCommandResponse(command, result);
            }
            throw new Error(`Unsupported database driver: ${driver}`);
        }),
    }));
    tools.push(tool({
        name: "as_tabular_data",
        description: "Read, query, or write one or more CSV-style tabular files through one controller.",
        parameters: {
            action: z.enum(["read", "query", "write"]),
            path: z.string().default(""),
            ...fileSelectionParameters,
            delimiter: z.string().min(1).max(1).default(","),
            has_header: z.boolean().default(true),
            limit: z.number().int().min(1).max(100000).default(1000),
            detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
            rows_json: z.string().default("[]"),
            include_header: z.boolean().default(true),
            overwrite: z.boolean().default(true),
            filters_json: z.string().default("{}"),
            sort_by: z.string().default(""),
            descending: z.boolean().default(false),
        },
        implementation: safeTool("as_tabular_data", async (params) => {
            const { action, path: relPath, delimiter, has_header, limit, detail, rows_json, include_header, overwrite, filters_json, sort_by, descending } = params;
            const detailLevel = normalizeDetailLevel(detail);
            const targets = await resolveTargets(params, relPath, "path", { mustExist: action !== "write", requireFiles: true });
            if (action === "read") {
                const results = [];
                for (const target of targets) {
                    const text = await fsp.readFile(target.fullPath, "utf8");
                    const rows = parseCsv(text, delimiter);
                    const objects = csvRecordsFromRows(rows, has_header, limit);
                    results.push(await compactRowsResult("as_tabular_data", detailLevel, { path: target.relativePath, rowCount: objects.length }, objects));
                }
                return json(results.length === 1 ? results[0] : { count: results.length, results });
            }
            if (action === "write") {
                const parsed = JSON.parse(rows_json);
                let rows;
                if (Array.isArray(parsed) && parsed.every((entry) => Array.isArray(entry))) {
                    rows = parsed.map((entry) => entry.map((value) => String(value ?? "")));
                }
                else if (Array.isArray(parsed) && parsed.every((entry) => entry && typeof entry === "object" && !Array.isArray(entry))) {
                    rows = csvObjectsToRows(parsed, include_header);
                }
                else {
                    throw new Error("rows_json must be a JSON array of arrays or objects.");
                }
                const results = [];
                for (const target of targets) {
                    if (await fileExists(target.fullPath) && !overwrite) {
                        results.push({ path: target.relativePath, status: "skipped", reason: "Destination exists." });
                        continue;
                    }
                    await fsp.mkdir(path.dirname(target.fullPath), { recursive: true });
                    await fsp.writeFile(target.fullPath, `${stringifyCsv(rows, delimiter)}\n`, "utf8");
                    results.push({ success: true, path: target.relativePath, rowCount: rows.length });
                }
                return json({ success: true, count: results.length, results });
            }
            if (action === "query") {
                const filters = JSON.parse(filters_json);
                const results = [];
                for (const target of targets) {
                    const text = await fsp.readFile(target.fullPath, "utf8");
                    let rows = csvRecordsFromRows(parseCsv(text, delimiter), has_header, 100000);
                    for (const [key, rawValue] of Object.entries(filters || {})) {
                        rows = rows.filter((row) => String(row[key] ?? "").toLowerCase().includes(String(rawValue ?? "").toLowerCase()));
                    }
                    if (sort_by.trim()) {
                        const key = sort_by;
                        rows.sort((left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? "")));
                        if (descending)
                            rows.reverse();
                    }
                    const sliced = rows.slice(0, limit);
                    results.push(await compactRowsResult("as_tabular_data", detailLevel, { path: target.relativePath, rowCount: sliced.length, totalMatchedRows: rows.length }, sliced));
                }
                return json(results.length === 1 ? results[0] : { count: results.length, results });
            }
            throw new Error(`Unsupported tabular action: ${action}`);
        }),
    }));
    tools.push(tool({
        name: "as_file_read",
        description: "Read one or more files as text or base64 bytes.",
        parameters: {
            path: z.string().default(""),
            ...fileSelectionParameters,
            mode: z.enum(["text", "base64"]).default("text"),
            encoding: z.string().default("utf8"),
            offset: z.number().int().min(0).default(0),
            length: z.number().int().min(1).max(1024 * 1024 * 8).optional(),
        },
        implementation: safeTool("as_file_read", async (params) => {
            const { path: relPath, mode, encoding, offset, length } = params;
            const targets = await resolveTargets(params, relPath, "path", { requireFiles: true });
            const results = [];
            for (const target of targets) {
                const buffer = await fsp.readFile(target.fullPath);
                const start = Math.min(offset, buffer.length);
                const end = typeof length === "number"
                    ? Math.min(buffer.length, start + length)
                    : buffer.length;
                const slice = buffer.subarray(start, end);
                const result = {
                    path: target.relativePath,
                    mode,
                    sizeBytes: buffer.length,
                    offsetBytes: start,
                    returnedBytes: slice.length,
                    truncated: end < buffer.length,
                };
                if (mode === "text") {
                    result.encoding = encoding;
                    result.text = slice.toString(encoding);
                }
                else {
                    result.base64 = slice.toString("base64");
                }
                results.push(result);
            }
            return json(results.length === 1 ? results[0] : { count: results.length, results });
        }),
    }));
    tools.push(tool({
        name: "as_file_write",
        description: "Write one or more files from text or base64 bytes.",
        parameters: {
            path: z.string().default(""),
            ...fileSelectionParameters,
            mode: z.enum(["text", "base64"]).default("text"),
            text: z.string().optional(),
            base64: z.string().optional(),
            encoding: z.string().default("utf8"),
            overwrite: z.boolean().default(true),
            append: z.boolean().default(false),
        },
        implementation: safeTool("as_file_write", async (params) => {
            const { path: relPath, mode, text, base64, encoding, overwrite, append } = params;
            const targets = await resolveTargets(params, relPath, "path", { mustExist: false, requireFiles: true });
            let content;
            if (mode === "text") {
                if (typeof text !== "string")
                    throw new Error("text is required when mode='text'.");
                content = Buffer.from(text, encoding);
            }
            else {
                if (typeof base64 !== "string")
                    throw new Error("base64 is required when mode='base64'.");
                content = Buffer.from(base64, "base64");
            }
            const results = [];
            for (const target of targets) {
                const exists = await fileExists(target.fullPath);
                if (exists && !overwrite && !append) {
                    results.push({ path: target.relativePath, status: "skipped", reason: "Destination exists." });
                    continue;
                }
                await fsp.mkdir(path.dirname(target.fullPath), { recursive: true });
                if (append) {
                    await fsp.appendFile(target.fullPath, content);
                }
                else {
                    await fsp.writeFile(target.fullPath, content);
                }
                results.push({
                    success: true,
                    path: target.relativePath,
                    mode,
                    bytesWritten: content.length,
                    appended: append,
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
        name: "as_structured_data",
        description: "Read, write, validate, or merge-patch one or more JSON/YAML files through one structured-data controller.",
        parameters: {
            action: z.enum(["read", "write", "validate", "merge_patch"]),
            path: z.string().default(""),
            ...fileSelectionParameters,
            format: z.enum(["auto", "json", "yaml"]).default("auto"),
            data_json: z.string().default("{}"),
            patch_json: z.string().default("{}"),
            overwrite: z.boolean().default(true),
            create_if_missing: z.boolean().default(false),
        },
        implementation: safeTool("as_structured_data", async (params) => {
            const { action, path: relPath, format, data_json, patch_json, overwrite, create_if_missing } = params;
            const targets = await resolveTargets(params, relPath, "path", { mustExist: action === "write" ? false : Boolean(create_if_missing) === false, requireFiles: true });
            if (action === "read") {
                const results = [];
                for (const target of targets) {
                    const effectiveFormat = detectStructuredFormat(target.fullPath, format);
                    const sourceText = await fsp.readFile(target.fullPath, "utf8");
                    const parsed = effectiveFormat === "json" ? JSON.parse(sourceText) : YAML.parse(sourceText);
                    results.push({ path: target.relativePath, format: effectiveFormat, data: parsed });
                }
                return json(results.length === 1 ? results[0] : { count: results.length, results });
            }
            if (action === "write") {
                const parsed = JSON.parse(data_json);
                const results = [];
                for (const target of targets) {
                    if (await fileExists(target.fullPath) && !overwrite) {
                        results.push({ path: target.relativePath, status: "skipped", reason: "Destination exists." });
                        continue;
                    }
                    const effectiveFormat = detectStructuredFormat(target.fullPath, format);
                    await fsp.mkdir(path.dirname(target.fullPath), { recursive: true });
                    if (effectiveFormat === "json") {
                        await fsp.writeFile(target.fullPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
                    }
                    else {
                        await fsp.writeFile(target.fullPath, YAML.stringify(parsed), "utf8");
                    }
                    results.push({ success: true, path: target.relativePath, format: effectiveFormat });
                }
                return json({ success: true, count: results.length, results });
            }
            if (action === "validate") {
                const results = [];
                for (const target of targets) {
                    const effectiveFormat = detectStructuredFormat(target.fullPath, format);
                    const sourceText = await fsp.readFile(target.fullPath, "utf8");
                    const parsed = effectiveFormat === "json" ? JSON.parse(sourceText) : YAML.parse(sourceText);
                    results.push({ success: true, path: target.relativePath, format: effectiveFormat, rootType: Array.isArray(parsed) ? "array" : typeof parsed });
                }
                return json(results.length === 1 ? results[0] : { count: results.length, results });
            }
            if (action === "merge_patch") {
                const patchObject = JSON.parse(patch_json);
                const results = [];
                for (const target of targets) {
                    const effectiveFormat = detectStructuredFormat(target.fullPath, format);
                    const exists = await fileExists(target.fullPath);
                    if (!exists && !create_if_missing)
                        throw new Error("Target file does not exist and create_if_missing is false.");
                    if (effectiveFormat !== "json")
                        throw new Error("merge_patch currently supports JSON files only.");
                    const originalText = exists ? await fsp.readFile(target.fullPath, "utf8") : "{}";
                    const original = JSON.parse(originalText);
                    const nextValue = jsonMergePatch(original, patchObject);
                    const nextText = `${JSON.stringify(nextValue, null, 2)}\n`;
                    await fsp.mkdir(path.dirname(target.fullPath), { recursive: true });
                    await fsp.writeFile(target.fullPath, nextText, "utf8");
                    results.push({ success: true, path: target.relativePath, diff: unifiedDiff(originalText, nextText, target.relativePath) });
                }
                return json(results.length === 1 ? results[0] : { count: results.length, results });
            }
            throw new Error(`Unsupported structured data action: ${action}`);
        }),
    }));
    tools.push(tool({
        name: "as_vision_ocr",
        description: "Use the currently loaded LM Studio multimodal model to extract visible text, numbers, symbols, and UI readouts from screenshots, interfaces, scans, documents, or other text-heavy images. This OCR tool is optimized for displays, equations, and interface text rather than broad scene description. Use as_vision_target instead when you need click-ready coordinates or bounds. `fast=true` is the default and should be the normal first pass; only retry with `fast=false` when the fast result is incomplete, clearly wrong, or too uncertain.",
        parameters: {
            path: z.string().default(""),
            ...fileSelectionParameters,
            embed_markdown: z.string().default(""),
            embed_markdown_list: z.array(z.string()).default([]),
            use_clipboard_image: z.boolean().default(false),
            clipboard_output_path: z.string().default(""),
            goal: z.string().default(""),
            fast: z.boolean().default(true),
            model_id: z.string().default(""),
            max_tokens: z.number().int().min(32).max(4096).default(1024),
        },
        implementation: safeTool("as_vision_ocr", async (params) => {
            const { path: relPath, goal, fast, model_id, max_tokens } = params;
            const startedAt = nowMs();
            const inputs = await collectVisionInputs(params, relPath, "path");
            const requestedGoal = normalizeVisionText(goal);
            const fastMode = fast !== false;
            const effectiveMaxTokens = fastMode
                ? Math.max(192, Math.min(512, Number(max_tokens) || 384))
                : Math.max(384, Math.min(4096, Number(max_tokens) || 1024));
            const schemaText = inputs.length === 1
                ? "{\"summary\":\"short context\",\"fullText\":\"all visible text and numbers in reading order\",\"lines\":[\"one visible line or text chunk per item\"],\"numbers\":[\"all visible numeric or math-like strings\"],\"uiReadings\":[{\"role\":\"title|label|display|expression|button|status|other\",\"text\":\"visible text\"}],\"displayCandidates\":[\"main displayed value or expression\"]}"
                : "{\"images\":[{\"label\":\"file label\",\"summary\":\"short context\",\"fullText\":\"all visible text and numbers in reading order\",\"lines\":[\"one visible line or text chunk per item\"],\"numbers\":[\"all visible numeric or math-like strings\"],\"uiReadings\":[{\"role\":\"title|label|display|expression|button|status|other\",\"text\":\"visible text\"}],\"displayCandidates\":[\"main displayed value or expression\"]}]}";
            const prompts = [
                [
                    "You are an OCR engine for screenshots, user interfaces, scans, and documents.",
                    "Return ONLY valid JSON. No markdown. No commentary. No reasoning.",
                    "Do not include planning text, think tags, or schema discussion.",
                    requestedGoal
                        ? `Focus especially on this requested text or value: ${requestedGoal}`
                        : "Focus on visible text, numbers, operators, mathematical symbols, and UI labels.",
                    "Decode calculator and math symbols faithfully when possible, including sqrt or √, multiplication or ×, division or ÷, plus, minus, parentheses, decimals, and percent signs.",
                    "If the image has a main display value or equation, include it in displayCandidates and uiReadings with role display or expression when applicable.",
                    `JSON schema: ${schemaText}`,
                ].join("\n"),
                ...(!fastMode ? [[
                        "Retry with stricter formatting.",
                        "Output ONLY minified JSON matching the schema exactly.",
                        "Do not explain the task. Do not describe the image except through extracted text fields.",
                        "Do not emit think tags, XML tags, markdown fences, or analysis.",
                        `JSON schema: ${schemaText}`,
                    ].join("\n")] : []),
            ];
            const { modelId, rawAnswer, parsed, attempts, parseMode } = await callStructuredVisionModel(inputs.map((entry) => ({ fullPath: String(entry.fullPath), label: String(entry.label || "") })), prompts, effectiveMaxTokens, model_id, (value) => {
                if (!value || typeof value !== "object")
                    return false;
                if (Array.isArray(value.images))
                    return true;
                return typeof value.fullText === "string"
                    || typeof value.text === "string"
                    || Array.isArray(value.lines);
            });
            const normalizeOcrEntry = (entry, fallbackLabel = "") => {
                const lines = normalizeVisionStringArray(entry.lines);
                const text = normalizeVisionText(entry.fullText || entry.text || (lines.length > 0 ? lines.join("\n") : ""));
                return {
                    label: normalizeVisionText(entry.label || fallbackLabel),
                    summary: normalizeVisionText(entry.summary || entry.context),
                    text,
                    lines,
                    numbers: normalizeVisionStringArray(entry.numbers),
                    uiReadings: normalizeVisionUiReadings(entry.uiReadings),
                    displayCandidates: normalizeVisionStringArray(entry.displayCandidates),
                };
            };
            const mergeOcrEntryWithFallback = (entry, fallbackLabel = "", rawFallbackText = "") => {
                const normalized = normalizeOcrEntry(entry, fallbackLabel);
                const fallback = rawFallbackText ? extractOcrFallbackFromRawAnswer(rawFallbackText, fallbackLabel) : null;
                return {
                    label: normalized.label || fallback?.label || normalizeVisionText(fallbackLabel),
                    summary: normalized.summary || fallback?.summary || "",
                    text: normalized.text || fallback?.text || rawFallbackText || "",
                    lines: normalized.lines.length > 0 ? normalized.lines : (fallback?.lines || []),
                    numbers: dedupeVisionStrings([...(normalized.numbers || []), ...(fallback?.numbers || [])]),
                    uiReadings: normalized.uiReadings.length > 0 ? normalized.uiReadings : (fallback?.uiReadings || []),
                    displayCandidates: dedupeVisionStrings([...(normalized.displayCandidates || []), ...(fallback?.displayCandidates || [])]).slice(0, 12),
                };
            };
            const basePayload = {
                count: inputs.length,
                modelId,
                fast: fastMode,
                effectiveMaxTokens,
                attempts,
                parseMode,
                durationMs: Math.max(0, nowMs() - startedAt),
                inputs: inputs.map((entry) => ({
                    path: entry.relativePath,
                    source: entry.source,
                    label: entry.label,
                    originalReference: entry.originalReference,
                })),
            };
            if (parsed && typeof parsed === "object" && Array.isArray(parsed.images)) {
                return json({
                    ...basePayload,
                    results: parsed.images
                        .map((entry, index) => normalizeOcrEntry(entry, String(inputs[index]?.label || `image-${index + 1}`))),
                });
            }
            if (parsed && typeof parsed === "object") {
                const normalized = mergeOcrEntryWithFallback(parsed, String(inputs[0]?.label || ""), rawAnswer);
                return json({
                    ...basePayload,
                    summary: normalized.summary,
                    text: normalized.text || rawAnswer,
                    lines: normalized.lines,
                    numbers: normalized.numbers,
                    uiReadings: normalized.uiReadings,
                    displayCandidates: normalized.displayCandidates,
                });
            }
            const fallback = extractOcrFallbackFromRawAnswer(rawAnswer, String(inputs[0]?.label || ""));
            return json({
                ...basePayload,
                rawTextFallback: true,
                summary: fallback.summary,
                text: fallback.text || rawAnswer,
                lines: fallback.lines,
                numbers: fallback.numbers,
                uiReadings: fallback.uiReadings,
                displayCandidates: fallback.displayCandidates,
            });
        }),
    }));
    tools.push(tool({
        name: "as_vision_recognize",
        description: "Use the currently loaded LM Studio multimodal model for broad image recognition and concise understanding of photos, scenes, diagrams, screenshots, and video frames. This tool is for overall meaning, not deep OCR, fine-grained UI inspection, or coordinate targeting. `fast=true` is the default and should be the normal first pass; only retry with `fast=false` when the fast result is incomplete, clearly wrong, or too uncertain.",
        parameters: {
            path: z.string().default(""),
            ...fileSelectionParameters,
            embed_markdown: z.string().default(""),
            embed_markdown_list: z.array(z.string()).default([]),
            use_clipboard_image: z.boolean().default(false),
            clipboard_output_path: z.string().default(""),
            question: z.string().default("What is shown here?"),
            fast: z.boolean().default(true),
            model_id: z.string().default(""),
            max_tokens: z.number().int().min(32).max(4096).default(1024),
        },
        implementation: safeTool("as_vision_recognize", async (params) => {
            const { path: relPath, question, fast, model_id, max_tokens } = params;
            const startedAt = nowMs();
            const inputs = await collectVisionInputs(params, relPath, "path");
            const requestedQuestion = normalizeVisionText(question || "What is shown here?");
            const fastMode = fast !== false;
            const effectiveMaxTokens = fastMode
                ? Math.max(160, Math.min(384, Number(max_tokens) || 320))
                : Math.max(256, Math.min(4096, Number(max_tokens) || 1024));
            const schemaText = inputs.length === 1
                ? "{\"answer\":\"direct answer to the question\",\"summary\":\"concise overall recognition summary\",\"entities\":[\"main entities or concepts\"],\"textMentions\":[\"important visible text if relevant\"],\"confidenceNotes\":[\"short uncertainty notes if needed\"]}"
                : "{\"answer\":\"direct answer across the image set\",\"summary\":\"concise overall recognition summary\",\"entities\":[\"main entities or concepts\"],\"textMentions\":[\"important visible text if relevant\"],\"confidenceNotes\":[\"short uncertainty notes if needed\"],\"images\":[{\"label\":\"file label\",\"summary\":\"short per-image summary\"}]}";
            const prompts = [
                [
                    "You are a concise image-recognition assistant.",
                    "Return ONLY valid JSON. No markdown. No reasoning.",
                    "Do not include planning text, think tags, or step-by-step analysis.",
                    `Question: ${requestedQuestion}`,
                    "Focus on the overall meaning, main entities, and short answer. Do not produce a long step-by-step analysis.",
                    `JSON schema: ${schemaText}`,
                ].join("\n"),
                ...(!fastMode ? [[
                        "Retry with stricter formatting.",
                        "Output ONLY minified JSON matching the schema exactly.",
                        "Do not emit think tags, XML tags, markdown fences, or analysis.",
                        `Question: ${requestedQuestion}`,
                        `JSON schema: ${schemaText}`,
                    ].join("\n")] : []),
            ];
            const { modelId, rawAnswer, parsed, attempts, parseMode } = await callStructuredVisionModel(inputs.map((entry) => ({ fullPath: String(entry.fullPath), label: String(entry.label || "") })), prompts, effectiveMaxTokens, model_id, (value) => {
                if (!value || typeof value !== "object")
                    return false;
                return typeof value.answer === "string"
                    || typeof value.summary === "string"
                    || Array.isArray(value.images);
            });
            const payload = {
                count: inputs.length,
                modelId,
                fast: fastMode,
                effectiveMaxTokens,
                attempts,
                parseMode,
                durationMs: Math.max(0, nowMs() - startedAt),
                inputs: inputs.map((entry) => ({
                    path: entry.relativePath,
                    source: entry.source,
                    label: entry.label,
                    originalReference: entry.originalReference,
                })),
            };
            if (parsed && typeof parsed === "object") {
                return json({
                    ...payload,
                    answer: normalizeVisionText(parsed.answer || parsed.summary || rawAnswer),
                    summary: normalizeVisionText(parsed.summary || ""),
                    entities: normalizeVisionStringArray(parsed.entities),
                    textMentions: normalizeVisionStringArray(parsed.textMentions),
                    confidenceNotes: normalizeVisionStringArray(parsed.confidenceNotes),
                    images: Array.isArray(parsed.images)
                        ? parsed.images.map((entry, index) => ({
                            label: normalizeVisionText(entry.label || inputs[index]?.label || ""),
                            summary: normalizeVisionText(entry.summary || ""),
                        }))
                        : undefined,
                });
            }
            return json({
                ...payload,
                rawTextFallback: true,
                answer: rawAnswer,
            });
        }),
    }));
    tools.push(tool({
        name: "as_vision_focus",
        description: "Use the currently loaded LM Studio multimodal model for detailed inspection of inner image elements such as interface regions, widget state, diagrams, annotated areas, and other targeted visual questions. Prefer this over as_vision_recognize when you need precise local detail rather than a broad summary. Use as_vision_target instead when the main goal is to get approximate coordinates or bounds for clicking, dragging, or cropping. `fast=true` is the default and should be the normal first pass; only retry with `fast=false` when the fast result is incomplete, clearly wrong, or too uncertain.",
        parameters: {
            path: z.string().default(""),
            ...fileSelectionParameters,
            embed_markdown: z.string().default(""),
            embed_markdown_list: z.array(z.string()).default([]),
            use_clipboard_image: z.boolean().default(false),
            clipboard_output_path: z.string().default(""),
            question: z.string().default("Describe the important inner elements, text, numbers, and relationships in this image."),
            fast: z.boolean().default(true),
            model_id: z.string().default(""),
            max_tokens: z.number().int().min(32).max(4096).default(1280),
        },
        implementation: safeTool("as_vision_focus", async (params) => {
            const { path: relPath, question, fast, model_id, max_tokens } = params;
            const startedAt = nowMs();
            const inputs = await collectVisionInputs(params, relPath, "path");
            const requestedQuestion = normalizeVisionText(question || "Describe the important inner elements, text, numbers, and relationships in this image.");
            const fastMode = fast !== false;
            const effectiveMaxTokens = fastMode
                ? Math.max(224, Math.min(640, Number(max_tokens) || 448))
                : Math.max(384, Math.min(4096, Number(max_tokens) || 1280));
            const schemaText = inputs.length === 1
                ? "{\"answer\":\"direct answer to the question\",\"elements\":[{\"label\":\"element name\",\"type\":\"element type\",\"text\":\"visible text if any\",\"location\":\"short spatial note\",\"state\":\"state or value\"}],\"textSnippets\":[\"important text snippets\"],\"numbers\":[\"important numeric values\"],\"confidenceNotes\":[\"short uncertainty notes if needed\"]}"
                : "{\"answer\":\"direct answer across the image set\",\"elements\":[{\"label\":\"element name\",\"type\":\"element type\",\"text\":\"visible text if any\",\"location\":\"short spatial note\",\"state\":\"state or value\"}],\"textSnippets\":[\"important text snippets\"],\"numbers\":[\"important numeric values\"],\"confidenceNotes\":[\"short uncertainty notes if needed\"],\"images\":[{\"label\":\"file label\",\"elements\":[{\"label\":\"element name\",\"type\":\"element type\",\"text\":\"visible text if any\",\"location\":\"short spatial note\",\"state\":\"state or value\"}],\"textSnippets\":[\"important text snippets\"],\"numbers\":[\"important numeric values\"]}]}";
            const prompts = [
                [
                    "You are a detailed visual-inspection assistant for user interfaces and other complex images.",
                    "Return ONLY valid JSON. No markdown. No reasoning.",
                    "Do not include planning text, think tags, or step-by-step analysis.",
                    `Question: ${requestedQuestion}`,
                    "Focus on inner elements, local text, numeric values, labels, spatial relationships, and state changes that matter to the question.",
                    `JSON schema: ${schemaText}`,
                ].join("\n"),
                ...(!fastMode ? [[
                        "Retry with stricter formatting.",
                        "Output ONLY minified JSON matching the schema exactly.",
                        "Do not emit think tags, XML tags, markdown fences, or analysis.",
                        `Question: ${requestedQuestion}`,
                        `JSON schema: ${schemaText}`,
                    ].join("\n")] : []),
            ];
            const { modelId, rawAnswer, parsed, attempts, parseMode } = await callStructuredVisionModel(inputs.map((entry) => ({ fullPath: String(entry.fullPath), label: String(entry.label || "") })), prompts, effectiveMaxTokens, model_id, (value) => {
                if (!value || typeof value !== "object")
                    return false;
                return typeof value.answer === "string"
                    || Array.isArray(value.elements)
                    || Array.isArray(value.images);
            });
            const normalizeElements = (value) => Array.isArray(value)
                ? value
                    .map((entry) => {
                    if (!entry || typeof entry !== "object")
                        return null;
                    const record = entry;
                    const label = normalizeVisionText(record.label);
                    const type = normalizeVisionText(record.type);
                    const text = normalizeVisionText(record.text);
                    const location = normalizeVisionText(record.location);
                    const state = normalizeVisionText(record.state);
                    if (!label && !type && !text && !location && !state)
                        return null;
                    return { label, type, text, location, state };
                })
                    .filter(Boolean)
                : [];
            const payload = {
                count: inputs.length,
                modelId,
                fast: fastMode,
                effectiveMaxTokens,
                attempts,
                parseMode,
                durationMs: Math.max(0, nowMs() - startedAt),
                inputs: inputs.map((entry) => ({
                    path: entry.relativePath,
                    source: entry.source,
                    label: entry.label,
                    originalReference: entry.originalReference,
                })),
            };
            if (parsed && typeof parsed === "object") {
                return json({
                    ...payload,
                    answer: normalizeVisionText(parsed.answer || rawAnswer),
                    elements: normalizeElements(parsed.elements),
                    textSnippets: normalizeVisionStringArray(parsed.textSnippets),
                    numbers: normalizeVisionStringArray(parsed.numbers),
                    confidenceNotes: normalizeVisionStringArray(parsed.confidenceNotes),
                    images: Array.isArray(parsed.images)
                        ? parsed.images.map((entry, index) => ({
                            label: normalizeVisionText(entry.label || inputs[index]?.label || ""),
                            elements: normalizeElements(entry.elements),
                            textSnippets: normalizeVisionStringArray(entry.textSnippets),
                            numbers: normalizeVisionStringArray(entry.numbers),
                        }))
                        : undefined,
                });
            }
            return json({
                ...payload,
                rawTextFallback: true,
                answer: rawAnswer,
            });
        }),
    }));
    tools.push(tool({
        name: "as_metadata_write",
        description: "Write metadata on one or more files using exiftool. Use a JSON object mapping tag names to values.",
        parameters: {
            path: z.string().default(""),
            ...fileSelectionParameters,
            tags_json: z.string(),
        },
        implementation: safeTool("as_metadata_write", async (params) => {
            const { path: relPath, tags_json } = params;
            requireCommandExecution();
            const targets = await resolveTargets(params, relPath, "path", { requireFiles: true });
            const exiftoolPath = await resolveExecutablePath(ctl, env, "exiftoolPath", "exiftool");
            const tags = JSON.parse(tags_json);
            if (!tags || typeof tags !== "object" || Array.isArray(tags)) {
                throw new Error("tags_json must be a JSON object.");
            }
            const assignments = Object.entries(tags).map(([key, value]) => {
                if (!/^[A-Za-z0-9:_-]+$/.test(key)) {
                    throw new Error(`Unsupported metadata tag name: ${key}`);
                }
                if (value === null)
                    return `-${key}=`;
                return `-${key}=${String(value)}`;
            });
            const command = `${quote(exiftoolPath)} -overwrite_original ${assignments.map(quote).join(" ")} ${targets.map((target) => quote(target.fullPath)).join(" ")}`;
            return buildManagedCommandResponse(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
        }),
    }));
    tools.push(tool({
        name: "as_media_probe",
        description: "Inspect one or more media files with ffprobe and return JSON stream and format metadata.",
        parameters: {
            path: z.string().default(""),
            ...fileSelectionParameters,
            detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
        },
        implementation: safeTool("as_media_probe", async (params) => {
            const { path: relPath, detail } = params;
            requireCommandExecution();
            const detailLevel = normalizeDetailLevel(detail);
            const targets = await resolveTargets(params, relPath, "path", { requireFiles: true });
            const ffprobePath = await resolveExecutablePath(ctl, env, "ffprobePath", "ffprobe");
            const results = [];
            for (const target of targets) {
                if (detailLevel === "max") {
                    const command = `${quote(ffprobePath)} -v quiet -print_format json -show_format -show_streams ${quote(target.fullPath)}`;
                    const response = JSON.parse(await buildManagedCommandResponse(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes));
                    results.push({ path: target.relativePath, detail: detailLevel, ...response });
                    continue;
                }
                const showEntries = detailLevel === "full"
                    ? "format=filename,format_name,format_long_name,duration,size,bit_rate,start_time,probe_score:format_tags:stream=index,codec_name,codec_long_name,profile,codec_type,width,height,pix_fmt,level,channels,channel_layout,sample_rate,avg_frame_rate,bit_rate,duration,disposition:stream_tags=language,title,handler_name"
                    : "format=filename,format_name,duration,size,bit_rate:stream=index,codec_name,codec_type,width,height,channels,sample_rate,avg_frame_rate,bit_rate:stream_tags=language,title";
                const command = `${quote(ffprobePath)} -v quiet -print_format json -show_entries ${quote(showEntries)} ${quote(target.fullPath)}`;
                const result = await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
                const parsed = result.stdout ? (() => { try {
                    return JSON.parse(result.stdout);
                }
                catch {
                    return null;
                } })() : null;
                if (!parsed) {
                    const response = JSON.parse(buildCommandResponse(command, result));
                    results.push({ path: target.relativePath, detail: detailLevel, ...response });
                    continue;
                }
                const formatInfo = (parsed.format && typeof parsed.format === "object") ? parsed.format : {};
                const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
                results.push({
                    path: target.relativePath,
                    detail: detailLevel,
                    format: {
                        fileName: formatInfo.filename || path.basename(target.fullPath),
                        formatName: formatInfo.format_name || null,
                        formatLongName: detailLevel === "full" ? (formatInfo.format_long_name || null) : undefined,
                        duration: formatInfo.duration || null,
                        size: formatInfo.size || null,
                        bitRate: formatInfo.bit_rate || null,
                        startTime: detailLevel === "full" ? (formatInfo.start_time || null) : undefined,
                        probeScore: detailLevel === "full" ? (formatInfo.probe_score || null) : undefined,
                        tags: detailLevel === "full" ? (formatInfo.tags || undefined) : undefined,
                    },
                    streamCount: streams.length,
                    streams: streams.map((stream) => ({
                        index: stream.index,
                        codecType: stream.codec_type || null,
                        codecName: stream.codec_name || null,
                        codecLongName: detailLevel === "full" ? (stream.codec_long_name || null) : undefined,
                        profile: detailLevel === "full" ? (stream.profile || null) : undefined,
                        language: stream.tags?.language || null,
                        title: stream.tags?.title || stream.tags?.handler_name || null,
                        width: stream.width || null,
                        height: stream.height || null,
                        pixelFormat: detailLevel === "full" ? (stream.pix_fmt || null) : undefined,
                        channels: stream.channels || null,
                        channelLayout: detailLevel === "full" ? (stream.channel_layout || null) : undefined,
                        sampleRate: stream.sample_rate || null,
                        avgFrameRate: stream.avg_frame_rate || null,
                        bitRate: stream.bit_rate || null,
                        duration: stream.duration || null,
                        disposition: detailLevel === "full" ? (stream.disposition || undefined) : undefined,
                    })),
                });
            }
            return json(results.length === 1 ? results[0] : { count: results.length, results });
        }),
    }));
    tools.push(tool({
        name: "as_media_transform",
        description: "Transform one or more media files with ffmpeg using explicit extra arguments.",
        parameters: {
            input_path: z.string().default(""),
            ...fileSelectionParameters,
            output_path: z.string().default(""),
            output_directory: z.string().default(""),
            output_extension: z.string().default(""),
            arguments: z.string().default(""),
            overwrite: z.boolean().default(true),
        },
        implementation: safeTool("as_media_transform", async (params) => {
            const { input_path, output_path, output_directory, output_extension, arguments: extraArgs, overwrite } = params;
            requireCommandExecution();
            const targets = await resolveTargets(params, input_path, "input_path", { requireFiles: true });
            const batchMode = targets.length > 1 || hasBatchSelection(params);
            const ffmpegPath = await resolveExecutablePath(ctl, env, "ffmpegPath", "ffmpeg");
            const trimmedArgs = extraArgs.trim();
            assertNoShellControlOperators(trimmedArgs, "arguments");
            const results = [];
            for (const target of targets) {
                let outputPath;
                if (batchMode) {
                    const rawOutput = String(output_path || "").trim();
                    const rawDirectory = String(output_directory || "").trim();
                    const rawExtension = String(output_extension || "").trim();
                    if (!rawOutput && !rawDirectory && !rawExtension)
                        throw new Error("output_path, output_directory, or output_extension is required for batch media transforms.");
                    const outputLooksFile = rawOutput && path.extname(rawOutput);
                    const outputDir = rawDirectory
                        ? resolveInsideWorkspace(workspaceRoot, rawDirectory)
                        : rawOutput
                            ? resolveInsideWorkspace(workspaceRoot, outputLooksFile ? path.dirname(rawOutput) : rawOutput)
                            : path.dirname(target.fullPath);
                    const extension = rawExtension
                        ? (rawExtension.startsWith(".") ? rawExtension : `.${rawExtension}`)
                        : outputLooksFile
                            ? path.extname(rawOutput)
                            : path.extname(target.fullPath);
                    outputPath = path.join(outputDir, `${path.parse(target.fullPath).name}${extension}`);
                }
                else {
                    if (!String(output_path || "").trim())
                        throw new Error("output_path is required.");
                    outputPath = resolveInsideWorkspace(workspaceRoot, output_path);
                }
                await fsp.mkdir(path.dirname(outputPath), { recursive: true });
                const command = `${quote(ffmpegPath)} ${overwrite ? "-y" : "-n"} -i ${quote(target.fullPath)}${trimmedArgs ? " " + trimmedArgs : ""} ${quote(outputPath)}`.trim();
                const response = JSON.parse(await buildManagedCommandResponse(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 300000), maxOutputBytes));
                results.push({ input: target.relativePath, output: path.relative(workspaceRoot, outputPath), ...response });
            }
            return json(results.length === 1 ? results[0] : { count: results.length, results });
        }),
    }));
    tools.push(tool({
        name: "as_image_identify",
        description: "Inspect one or more images with ImageMagick identify.",
        parameters: {
            path: z.string().default(""),
            ...fileSelectionParameters,
            verbose: z.boolean().default(false),
        },
        implementation: safeTool("as_image_identify", async (params) => {
            const { path: relPath, verbose } = params;
            requireCommandExecution();
            const targets = await resolveTargets(params, relPath, "path", { requireFiles: true });
            const magickPath = await resolveExecutablePath(ctl, env, "imageMagickPath", "magick");
            const command = `${quote(magickPath)} identify ${verbose ? "-verbose " : ""}${targets.map((target) => quote(target.fullPath)).join(" ")}`.trim();
            return buildManagedCommandResponse(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
        }),
    }));
    tools.push(tool({
        name: "as_image_convert",
        description: "Convert or process one or more images using ImageMagick with explicit arguments.",
        parameters: {
            input_path: z.string().default(""),
            ...fileSelectionParameters,
            output_path: z.string().default(""),
            output_directory: z.string().default(""),
            output_extension: z.string().default(""),
            arguments: z.string().default(""),
            overwrite: z.boolean().default(true),
        },
        implementation: safeTool("as_image_convert", async (params) => {
            const { input_path, output_path, output_directory, output_extension, arguments: extraArgs, overwrite } = params;
            requireCommandExecution();
            const targets = await resolveTargets(params, input_path, "input_path", { requireFiles: true });
            const batchMode = targets.length > 1 || hasBatchSelection(params);
            const magickPath = await resolveExecutablePath(ctl, env, "imageMagickPath", "magick");
            const trimmedArgs = extraArgs.trim();
            assertNoShellControlOperators(trimmedArgs, "arguments");
            const results = [];
            for (const target of targets) {
                let outputPath;
                if (batchMode) {
                    const rawOutput = String(output_path || "").trim();
                    const rawDirectory = String(output_directory || "").trim();
                    const rawExtension = String(output_extension || "").trim();
                    if (!rawOutput && !rawDirectory && !rawExtension)
                        throw new Error("output_path, output_directory, or output_extension is required for batch image conversion.");
                    const outputLooksFile = rawOutput && path.extname(rawOutput);
                    const outputDir = rawDirectory
                        ? resolveInsideWorkspace(workspaceRoot, rawDirectory)
                        : rawOutput
                            ? resolveInsideWorkspace(workspaceRoot, outputLooksFile ? path.dirname(rawOutput) : rawOutput)
                            : path.dirname(target.fullPath);
                    const extension = rawExtension
                        ? (rawExtension.startsWith(".") ? rawExtension : `.${rawExtension}`)
                        : outputLooksFile
                            ? path.extname(rawOutput)
                            : path.extname(target.fullPath);
                    outputPath = path.join(outputDir, `${path.parse(target.fullPath).name}${extension}`);
                }
                else {
                    if (!String(output_path || "").trim())
                        throw new Error("output_path is required.");
                    outputPath = resolveInsideWorkspace(workspaceRoot, output_path);
                }
                if (await fileExists(outputPath) && !overwrite) {
                    results.push({ input: target.relativePath, output: path.relative(workspaceRoot, outputPath), status: "skipped", reason: "Destination exists." });
                    continue;
                }
                await fsp.mkdir(path.dirname(outputPath), { recursive: true });
                const command = `${quote(magickPath)} ${quote(target.fullPath)} ${trimmedArgs} ${quote(outputPath)}`.trim();
                const response = JSON.parse(await buildManagedCommandResponse(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 300000), maxOutputBytes));
                results.push({ input: target.relativePath, output: path.relative(workspaceRoot, outputPath), ...response });
            }
            return json(results.length === 1 ? results[0] : { count: results.length, results });
        }),
    }));
    tools.push(tool({
        name: "as_mkv_info",
        description: "Inspect one or more MKV containers with mkvmerge JSON output.",
        parameters: {
            path: z.string().default(""),
            ...fileSelectionParameters,
            detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
        },
        implementation: safeTool("as_mkv_info", async (params) => {
            const { path: relPath, detail } = params;
            requireCommandExecution();
            const detailLevel = normalizeDetailLevel(detail);
            const targets = await resolveTargets(params, relPath, "path", { requireFiles: true });
            const mkvmergePath = await resolveExecutablePath(ctl, env, "mkvmergePath", "mkvmerge");
            const results = [];
            for (const target of targets) {
                const command = `${quote(mkvmergePath)} -J ${quote(target.fullPath)}`;
                if (detailLevel === "max") {
                    const response = JSON.parse(await buildManagedCommandResponse(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes));
                    results.push({ path: target.relativePath, detail: detailLevel, ...response });
                    continue;
                }
                const result = await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
                const parsed = result.stdout ? (() => { try {
                    return JSON.parse(result.stdout);
                }
                catch {
                    return null;
                } })() : null;
                if (!parsed) {
                    const response = JSON.parse(buildCommandResponse(command, result));
                    results.push({ path: target.relativePath, detail: detailLevel, ...response });
                    continue;
                }
                const summary = {
                    path: target.relativePath,
                    detail: detailLevel,
                    container: parsed.container ? {
                        recognized: parsed.container.recognized ?? null,
                        type: parsed.container.type || null,
                        properties: detailLevel === "full" ? (parsed.container.properties || undefined) : undefined,
                    } : undefined,
                    trackCount: Array.isArray(parsed.tracks) ? parsed.tracks.length : 0,
                    attachmentCount: Array.isArray(parsed.attachments) ? parsed.attachments.length : 0,
                    chapterCount: Array.isArray(parsed.chapters) ? parsed.chapters.length : 0,
                    tracks: Array.isArray(parsed.tracks) ? parsed.tracks.map((track) => ({
                        id: track.id,
                        type: track.type || null,
                        codec: track.codec || null,
                        language: track.properties?.language || null,
                        name: track.properties?.track_name || null,
                        defaultTrack: track.properties?.default_track ?? null,
                        forcedTrack: track.properties?.forced_track ?? null,
                        enabledTrack: detailLevel === "full" ? (track.properties?.enabled_track ?? null) : undefined,
                        audioChannels: track.properties?.audio_channels || null,
                        audioSamplingFrequency: detailLevel === "full" ? (track.properties?.audio_sampling_frequency || null) : undefined,
                        pixelDimensions: track.properties?.pixel_dimensions || null,
                        displayDimensions: detailLevel === "full" ? (track.properties?.display_dimensions || null) : undefined,
                    })) : [],
                    attachments: Array.isArray(parsed.attachments) ? parsed.attachments.map((attachment) => ({
                        id: attachment.id,
                        name: attachment.name || null,
                        contentType: attachment.content_type || null,
                        size: attachment.size || null,
                    })) : [],
                };
                const serialized = JSON.stringify(parsed, null, 2);
                if (serialized.length > 8000) {
                    const withReport = await buildStructuredReportSummary("as_mkv_info", detailLevel, "mkvInfo", parsed, summary);
                    results.push(withReport);
                }
                else {
                    results.push(summary);
                }
            }
            return json(results.length === 1 ? results[0] : { count: results.length, results });
        }),
    }));
    tools.push(tool({
        name: "as_mkv_extract",
        description: "Extract tracks, attachments, chapters, cuesheets, tags, or timestamp files from one or more MKV containers with structured mkvextract actions.",
        parameters: {
            path: z.string().default(""),
            ...fileSelectionParameters,
            action: z.enum(["tracks", "attachments", "chapters", "cuesheet", "tags", "timestamps_v2"]),
            targets_json: z.string().default("[]"),
            output_path: z.string().default(""),
            simple_chapters: z.boolean().default(false),
        },
        implementation: safeTool("as_mkv_extract", async (params) => {
            const { path: relPath, action, targets_json, output_path, simple_chapters } = params;
            requireCommandExecution();
            const targets = await resolveTargets(params, relPath, "path", { requireFiles: true });
            const batchMode = targets.length > 1 || hasBatchSelection(params);
            const mkvextractPath = await resolveExecutablePath(ctl, env, "mkvextractPath", "mkvextract");
            const parsedTargets = JSON.parse(targets_json);
            const buildTargetPairs = (valueName, sourceTarget) => {
                if (!Array.isArray(parsedTargets) || parsedTargets.length === 0) {
                    throw new Error(`targets_json must be a non-empty JSON array for action='${action}'.`);
                }
                return parsedTargets.map((entry, index) => {
                    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
                        throw new Error(`targets_json entry ${index + 1} must be an object.`);
                    }
                    const rawId = entry.id;
                    const rawOutputPath = entry.output_path;
                    const id = String(rawId ?? "").trim();
                    const output = String(rawOutputPath ?? "").trim();
                    if (!id)
                        throw new Error(`targets_json entry ${index + 1} is missing id.`);
                    if (!output)
                        throw new Error(`targets_json entry ${index + 1} is missing output_path.`);
                    if (!/^[0-9]+$/.test(id))
                        throw new Error(`targets_json entry ${index + 1} has a non-numeric id.`);
                    const resolvedOutputPath = batchMode
                        ? resolveInsideWorkspace(workspaceRoot, path.join(String(output_path || path.dirname(output) || "."), path.parse(sourceTarget.fullPath).name, path.basename(output)))
                        : resolveInsideWorkspace(workspaceRoot, output);
                    return {
                        id,
                        outputPath: resolvedOutputPath,
                        argument: `${id}:${resolvedOutputPath}`,
                        sourceField: valueName,
                    };
                });
            };
            const selectedAction = String(action);
            const results = [];
            for (const target of targets) {
                let command = "";
                let resolvedOutputPath = "";
                if (selectedAction === "tracks" || selectedAction === "attachments" || selectedAction === "timestamps_v2") {
                    const pairs = buildTargetPairs(selectedAction, target);
                    for (const pair of pairs) {
                        await fsp.mkdir(path.dirname(pair.outputPath), { recursive: true });
                    }
                    command = `${quote(mkvextractPath)} ${selectedAction} ${quote(target.fullPath)} ${pairs.map((pair) => quote(pair.argument)).join(" ")}`;
                }
                else if (selectedAction === "chapters") {
                    const output = String(output_path || "").trim();
                    if (!output)
                        throw new Error("output_path is required for action='chapters'.");
                    const outputLooksFile = path.extname(output);
                    resolvedOutputPath = batchMode
                        ? resolveInsideWorkspace(workspaceRoot, path.join(outputLooksFile ? path.dirname(output) : output, `${path.parse(target.fullPath).name}${outputLooksFile || ".xml"}`))
                        : resolveInsideWorkspace(workspaceRoot, output);
                    await fsp.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
                    command = `${quote(mkvextractPath)} chapters ${quote(target.fullPath)}${simple_chapters ? " --simple" : ""} ${quote(resolvedOutputPath)}`;
                }
                else if (selectedAction === "cuesheet") {
                    const output = String(output_path || "").trim();
                    if (!output)
                        throw new Error("output_path is required for action='cuesheet'.");
                    const outputLooksFile = path.extname(output);
                    const defaultExt = ".cue";
                    resolvedOutputPath = batchMode
                        ? resolveInsideWorkspace(workspaceRoot, path.join(outputLooksFile ? path.dirname(output) : output, `${path.parse(target.fullPath).name}${outputLooksFile || defaultExt}`))
                        : resolveInsideWorkspace(workspaceRoot, output);
                    await fsp.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
                    command = `${quote(mkvextractPath)} cuesheet ${quote(target.fullPath)} ${quote(resolvedOutputPath)}`;
                }
                else if (selectedAction === "tags") {
                    const output = String(output_path || "").trim();
                    if (!output)
                        throw new Error("output_path is required for action='tags'.");
                    const outputLooksFile = path.extname(output);
                    const defaultExt = ".xml";
                    resolvedOutputPath = batchMode
                        ? resolveInsideWorkspace(workspaceRoot, path.join(outputLooksFile ? path.dirname(output) : output, `${path.parse(target.fullPath).name}${outputLooksFile || defaultExt}`))
                        : resolveInsideWorkspace(workspaceRoot, output);
                    await fsp.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
                    command = `${quote(mkvextractPath)} tags ${quote(target.fullPath)}`;
                }
                else {
                    throw new Error(`Unsupported mkvextract action: ${selectedAction}`);
                }
                const response = JSON.parse(await buildManagedCommandResponse(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 300000), maxOutputBytes));
                if (selectedAction === "tags") {
                    await fsp.writeFile(resolvedOutputPath, String(response.stdout || ""), "utf8");
                }
                results.push({ path: target.relativePath, output: resolvedOutputPath ? path.relative(workspaceRoot, resolvedOutputPath) : null, ...response });
            }
            return json(results.length === 1 ? results[0] : { count: results.length, results });
        }),
    }));
    tools.push(tool({
        name: "as_mkv_edit",
        description: "Edit one or more MKV containers with mkvpropedit using explicit arguments.",
        parameters: {
            path: z.string().default(""),
            ...fileSelectionParameters,
            arguments: z.string(),
        },
        implementation: safeTool("as_mkv_edit", async (params) => {
            const { path: relPath, arguments: extraArgs } = params;
            requireCommandExecution();
            const targets = await resolveTargets(params, relPath, "path", { requireFiles: true });
            const mkvpropeditPath = await resolveExecutablePath(ctl, env, "mkvpropeditPath", "mkvpropedit");
            const trimmedArgs = extraArgs.trim();
            assertNoShellControlOperators(trimmedArgs, "arguments");
            const results = [];
            for (const target of targets) {
                const command = `${quote(mkvpropeditPath)} ${quote(target.fullPath)} ${trimmedArgs}`.trim();
                const response = JSON.parse(await buildManagedCommandResponse(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 300000), maxOutputBytes));
                results.push({ path: target.relativePath, ...response });
            }
            return json(results.length === 1 ? results[0] : { count: results.length, results });
        }),
    }));
}
//# sourceMappingURL=dataMedia.js.map