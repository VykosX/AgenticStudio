"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDevelopmentTools = registerDevelopmentTools;
function registerDevelopmentTools(ctx, tools) {
    const { tool, z, safeTool, requireCommandExecution, workspaceRoot, resolveInsideWorkspace, resolveInsideDirectory, batchFileSelectionParameters, resolveBatchFileTargets, collectFiles, fileExists, quote, runCommand, buildCommandResponse, buildCommandResponsePayload, buildManagedCommandResponse, executeManagedCommand, commandAvailable, pythonModuleAvailable, resolveCompilerCandidates, executeInlinePython, executeInlineNodeScript, getNodeExecutablePath, parseJsonArrayOfStrings, assertCommandAllowed, resolveCommandPolicy, dynamicToolsDirectory, dynamicToolNameSchema, escapeForPython, indentPython, truncateOutput, maybeWriteToolOutputToFile, subAgentRuntime, ctl, env, shell, timeoutMs, maxOutputBytes, pythonExecutable, process, os, path, fsp, json, mergeDefined, configSchematics } = ctx;
    const assertNoShellControlOperators = (value, fieldName) => {
        if (/[\r\n;&|<>`]/.test(String(value || ""))) {
            throw new Error(`${fieldName} contains shell control operators. Pass plain arguments only.`);
        }
    };
    const fileSelectionParameters = batchFileSelectionParameters(z);
    const RESULT_SAMPLE_LIMIT = 20;
    const TEXT_PREVIEW_CHARS = 1600;
    const REPORT_READ_GUIDANCE = "Report spilled to disk. Do not read whole file by default. First narrow with as_file_search_text on keywords, file paths, ids, error text, or function names. Then use as_file_read with offset/length only on the matching regions you actually need.";
    const normalizeDetailLevel = (value) => {
        const normalized = String(value || "compact").trim().toLowerCase();
        if (normalized === "maximum")
            return "max";
        return normalized === "full" || normalized === "max" ? normalized : "compact";
    };
    const createReportPath = (toolName, label, extension = "json") => path.join("reports", `${toolName}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`);
    const compactCollectionResult = async (toolName, detailLevel, key, items, metadata, mapper = (entry) => entry) => {
        if (detailLevel === "max")
            return { ...metadata, detail: detailLevel, [key]: items };
        const normalized = items.map((entry) => mapper(entry));
        const sampleSize = detailLevel === "full" ? Math.min(normalized.length, 60) : RESULT_SAMPLE_LIMIT;
        const sample = normalized.slice(0, sampleSize);
        const payload = {
            ...metadata,
            detail: detailLevel,
            [key]: sample,
            count: normalized.length,
            truncated: normalized.length > sample.length,
        };
        if (normalized.length > sample.length) {
            payload[`${key}ReportPath`] = await maybeWriteToolOutputToFile(workspaceRoot, createReportPath(toolName, key), items);
            payload.reportReadGuidance = REPORT_READ_GUIDANCE;
        }
        return payload;
    };
    const compactValueResult = async (toolName, detailLevel, label, value, metadata) => {
        if (detailLevel === "max")
            return { ...metadata, detail: detailLevel, [label]: value };
        if (value === undefined || value === null || value === "")
            return { ...metadata, detail: detailLevel };
        if (typeof value === "string") {
            const preview = value.slice(0, TEXT_PREVIEW_CHARS);
            const payload = {
                ...metadata,
                detail: detailLevel,
                [detailLevel === "full" ? label : `${label}Preview`]: detailLevel === "full" ? value : preview,
                [`${label}Length`]: value.length,
                [`${label}Truncated`]: value.length > preview.length,
            };
            if (value.length > preview.length) {
                payload[`${label}ReportPath`] = await maybeWriteToolOutputToFile(workspaceRoot, createReportPath(toolName, label, "txt"), { [label]: value });
                payload.reportReadGuidance = REPORT_READ_GUIDANCE;
            }
            return payload;
        }
        if (Array.isArray(value)) {
            return compactCollectionResult(toolName, detailLevel, label, value, metadata);
        }
        if (typeof value === "object") {
            const serialized = JSON.stringify(value, null, 2);
            const preview = Object.fromEntries(Object.entries(value).slice(0, detailLevel === "full" ? 25 : 10));
            const payload = {
                ...metadata,
                detail: detailLevel,
                [detailLevel === "full" ? label : `${label}Preview`]: detailLevel === "full" ? preview : preview,
                [`${label}Keys`]: Object.keys(value),
                [`${label}Length`]: serialized.length,
            };
            if (serialized.length > TEXT_PREVIEW_CHARS) {
                payload[`${label}ReportPath`] = await maybeWriteToolOutputToFile(workspaceRoot, createReportPath(toolName, label), value);
                payload.reportReadGuidance = REPORT_READ_GUIDANCE;
            }
            return payload;
        }
        return { ...metadata, detail: detailLevel, [label]: value };
    };
    const hasBatchSelection = (params) => Array.isArray(params.file_list) && params.file_list.length > 0
        || Array.isArray(params.folder_list) && params.folder_list.length > 0
        || String(params.file_pattern || "").trim();
    const safeRevisionPattern = /^[A-Za-z0-9_./:@{}^~+-]+$/;
    const resolveGitDirectory = (directory) => {
        return resolveInsideWorkspace(workspaceRoot, directory || ".");
    };
    const resolvePathspec = (cwd, pathspec) => {
        const trimmed = String(pathspec || "").trim();
        if (!trimmed)
            return "";
        const fullPath = resolveInsideWorkspace(workspaceRoot, trimmed);
        const relative = path.relative(cwd, fullPath) || ".";
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
            throw new Error("pathspec must be inside the selected git directory.");
        }
        return relative;
    };
    const detectOutlineLanguage = (filePath, requested) => {
        if (requested && requested !== "auto")
            return requested;
        const ext = path.extname(filePath).toLowerCase();
        if ([".ts", ".tsx"].includes(ext))
            return "typescript";
        if ([".js", ".jsx", ".mjs", ".cjs"].includes(ext))
            return "javascript";
        if (ext === ".py")
            return "python";
        if ([".md", ".markdown"].includes(ext))
            return "markdown";
        if (ext === ".json")
            return "json";
        return "text";
    };
    const buildCodeOutline = (text, language, limit) => {
        const lines = text.split(/\r?\n/);
        const symbols = [];
        const add = (lineNumber, kind, name, signature, level) => {
            if (symbols.length >= limit)
                return;
            symbols.push({ line: lineNumber, kind, name, signature: signature.trim(), ...(level ? { level } : {}) });
        };
        lines.forEach((line, index) => {
            if (symbols.length >= limit)
                return;
            const lineNumber = index + 1;
            if (language === "markdown") {
                const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
                if (match)
                    add(lineNumber, "heading", match[2], line, match[1].length);
                return;
            }
            if (language === "json") {
                const match = line.match(/^\s*"([^"]+)"\s*:/);
                if (match)
                    add(lineNumber, "property", match[1], line);
                return;
            }
            if (language === "python") {
                const match = line.match(/^\s*(async\s+def|def|class)\s+([A-Za-z_][A-Za-z0-9_]*)\b(.*)$/);
                if (match)
                    add(lineNumber, match[1].includes("class") ? "class" : "function", match[2], line);
                return;
            }
            if (language === "typescript" || language === "javascript") {
                const classMatch = line.match(/^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)\b/);
                if (classMatch) {
                    add(lineNumber, "class", classMatch[1], line);
                    return;
                }
                const namedMatch = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/);
                if (namedMatch) {
                    add(lineNumber, "function", namedMatch[1], line);
                    return;
                }
                const typeMatch = line.match(/^\s*(?:export\s+)?(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)\b/);
                if (typeMatch) {
                    add(lineNumber, "type", typeMatch[1], line);
                    return;
                }
                const arrowMatch = line.match(/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/);
                if (arrowMatch)
                    add(lineNumber, "function", arrowMatch[1], line);
            }
        });
        return symbols;
    };
    const parseGitPaths = (value) => {
        return parseJsonArrayOfStrings(String(value || "[]"), "paths_json").map((entry) => entry.trim()).filter(Boolean);
    };
    const resolveGitPathspecs = (cwd, paths) => {
        return paths.map((entry) => resolvePathspec(cwd, entry));
    };
    const buildGitPathspecSuffix = (cwd, paths) => {
        const relPaths = resolveGitPathspecs(cwd, paths);
        if (relPaths.length === 0)
            return "";
        return ` -- ${relPaths.map((entry) => quote(entry)).join(" ")}`;
    };
    const runStructuredCommand = async (label, command, cwd, commandTimeout = timeoutMs) => {
        const result = await executeManagedCommand(ctl, command, { cwd, shell, env }, commandTimeout, maxOutputBytes);
        return {
            label,
            ...buildCommandResponsePayload(command, result),
        };
    };
    const detectProjectVerificationCommands = async (cwd, options) => {
        // Prefer the project's own scripts first, then fall back to common Python tooling.
        const commands = [];
        const packageJsonPath = path.join(cwd, "package.json");
        if (await fileExists(packageJsonPath)) {
            const pkg = JSON.parse(await fsp.readFile(packageJsonPath, "utf8"));
            const scripts = pkg?.scripts && typeof pkg.scripts === "object" ? pkg.scripts : {};
            if (options.includeLint && typeof scripts.lint === "string")
                commands.push({ label: "lint", command: "npm run lint", timeoutMs: Math.max(timeoutMs, 120000) });
            if (options.includeTypecheck) {
                if (typeof scripts.typecheck === "string")
                    commands.push({ label: "typecheck", command: "npm run typecheck", timeoutMs: Math.max(timeoutMs, 120000) });
                else if (typeof scripts["check-types"] === "string")
                    commands.push({ label: "typecheck", command: "npm run check-types", timeoutMs: Math.max(timeoutMs, 120000) });
            }
            if (options.includeTests && typeof scripts.test === "string")
                commands.push({ label: "test", command: "npm test", timeoutMs: Math.max(timeoutMs, 180000) });
            if (options.includeBuild && typeof scripts.build === "string")
                commands.push({ label: "build", command: "npm run build", timeoutMs: Math.max(timeoutMs, 180000) });
        }
        const files = await collectFiles(cwd, 3000).catch(() => []);
        const hasPython = files.some((filePath) => path.extname(filePath).toLowerCase() === ".py");
        if (hasPython) {
            if (options.includeLint && await pythonModuleAvailable("ruff", cwd, pythonExecutable, shell, env, timeoutMs, maxOutputBytes)) {
                commands.push({ label: "python_lint", command: `${quote(pythonExecutable)} -m ruff check .`, timeoutMs: Math.max(timeoutMs, 120000) });
            }
            if (options.includeTypecheck) {
                if (await pythonModuleAvailable("mypy", cwd, pythonExecutable, shell, env, timeoutMs, maxOutputBytes)) {
                    commands.push({ label: "python_typecheck", command: `${quote(pythonExecutable)} -m mypy .`, timeoutMs: Math.max(timeoutMs, 120000) });
                }
                else if (await commandAvailable("pyright", cwd, shell, env, timeoutMs, maxOutputBytes)) {
                    commands.push({ label: "python_typecheck", command: "pyright .", timeoutMs: Math.max(timeoutMs, 120000) });
                }
            }
            if (options.includeTests) {
                if (await pythonModuleAvailable("pytest", cwd, pythonExecutable, shell, env, timeoutMs, maxOutputBytes)) {
                    commands.push({ label: "python_test", command: `${quote(pythonExecutable)} -m pytest`, timeoutMs: Math.max(timeoutMs, 180000) });
                }
                else {
                    commands.push({ label: "python_test", command: `${quote(pythonExecutable)} -m unittest discover`, timeoutMs: Math.max(timeoutMs, 180000) });
                }
            }
        }
        return commands;
    };
    const collectBugMarkers = async (cwd, limit) => {
        // Keep this intentionally high-signal and cheap; it is a triage pass, not a full static analyzer.
        const files = await collectFiles(cwd, 5000).catch(() => []);
        const findings = [];
        const patterns = [
            { type: "merge_conflict", regex: /^<{7}|^={7}|^>{7}/m, severity: "high" },
            { type: "ts_nocheck", regex: /@ts-nocheck/, severity: "medium" },
            { type: "ts_ignore", regex: /@ts-ignore/, severity: "medium" },
            { type: "debugger", regex: /\bdebugger\s*;/, severity: "medium" },
            { type: "fixme", regex: /\bFIXME\b|\bTODO\b|\bHACK\b/, severity: "low" },
            { type: "empty_catch", regex: /catch\s*\([^)]*\)\s*\{\s*\}/, severity: "medium" },
        ];
        for (const filePath of files) {
            if (findings.length >= limit)
                break;
            let content = "";
            try {
                content = await fsp.readFile(filePath, "utf8");
            }
            catch {
                continue;
            }
            for (const pattern of patterns) {
                const match = content.match(pattern.regex);
                if (!match || findings.length >= limit)
                    continue;
                const before = content.slice(0, match.index || 0);
                const line = before.split(/\r?\n/).length;
                findings.push({
                    type: pattern.type,
                    severity: pattern.severity,
                    path: path.relative(workspaceRoot, filePath),
                    line,
                    preview: content.split(/\r?\n/)[Math.max(0, line - 1)] || "",
                });
            }
        }
        return findings;
    };
    tools.push(tool({
        name: "as_project_analyze",
        description: "Run a best-effort project analysis pass using available linters or compile checks.",
        parameters: {
            directory: z.string().default("."),
        },
        implementation: safeTool("as_project_analyze", async ({ directory }) => {
            requireCommandExecution();
            const cwd = resolveInsideWorkspace(workspaceRoot, directory);
            const packageJsonPath = path.join(cwd, "package.json");
            let command = "";
            if (await fileExists(packageJsonPath)) {
                const pkg = JSON.parse(await fsp.readFile(packageJsonPath, "utf8"));
                if (pkg?.scripts?.lint)
                    command = "npm run lint";
            }
            if (!command) {
                const files = await collectFiles(cwd, 2000);
                const hasPython = files.some((filePath) => path.extname(filePath).toLowerCase() === ".py");
                if (hasPython && await pythonModuleAvailable("ruff", cwd, pythonExecutable, shell, env, timeoutMs, maxOutputBytes)) {
                    command = `${quote(pythonExecutable)} -m ruff check .`;
                }
                else if (hasPython) {
                    command = `${quote(pythonExecutable)} -m compileall -q .`;
                }
            }
            if (!command)
                throw new Error("No supported analyzer detected.");
            return buildManagedCommandResponse(ctl, command, { cwd, shell, env }, timeoutMs, maxOutputBytes);
        }),
    }));
    tools.push(tool({
        name: "as_project_verify",
        description: "Run a structured verification pass across lint, typecheck, tests, and build steps that can be detected locally.",
        parameters: {
            directory: z.string().default("."),
            include_lint: z.boolean().default(true),
            include_typecheck: z.boolean().default(true),
            include_tests: z.boolean().default(true),
            include_build: z.boolean().default(true),
            stop_on_failure: z.boolean().default(false),
        },
        implementation: safeTool("as_project_verify", async ({ directory, include_lint, include_typecheck, include_tests, include_build, stop_on_failure }) => {
            requireCommandExecution();
            const cwd = resolveInsideWorkspace(workspaceRoot, directory);
            const commands = await detectProjectVerificationCommands(cwd, {
                includeLint: Boolean(include_lint),
                includeTypecheck: Boolean(include_typecheck),
                includeTests: Boolean(include_tests),
                includeBuild: Boolean(include_build),
            });
            if (commands.length === 0) {
                throw new Error("No verification commands were detected for this project.");
            }
            const results = [];
            for (const item of commands) {
                const result = await runStructuredCommand(item.label, item.command, cwd, item.timeoutMs || timeoutMs);
                results.push(result);
                if (!result.success && stop_on_failure)
                    break;
            }
            return json({
                directory: path.relative(workspaceRoot, cwd) || ".",
                commandCount: commands.length,
                success: results.every((entry) => entry.success),
                results,
            });
        }),
    }));
    tools.push(tool({
        name: "as_project_bug_scan",
        description: "Scan a project for high-signal bug markers and optionally run verification commands alongside the findings.",
        parameters: {
            directory: z.string().default("."),
            marker_limit: z.number().int().min(1).max(1000).default(200),
            run_verification: z.boolean().default(true),
            detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
        },
        implementation: safeTool("as_project_bug_scan", async ({ directory, marker_limit, run_verification, detail }) => {
            const cwd = resolveInsideWorkspace(workspaceRoot, directory);
            const detailLevel = normalizeDetailLevel(detail);
            const findings = await collectBugMarkers(cwd, marker_limit);
            let verification = null;
            if (run_verification) {
                requireCommandExecution();
                const commands = await detectProjectVerificationCommands(cwd, {
                    includeLint: true,
                    includeTypecheck: true,
                    includeTests: true,
                    includeBuild: true,
                });
                verification = [];
                for (const item of commands) {
                    verification.push(await runStructuredCommand(item.label, item.command, cwd, item.timeoutMs || timeoutMs));
                }
            }
            const base = {
                directory: path.relative(workspaceRoot, cwd) || ".",
                findingCount: findings.length,
                verification,
            };
            if (detailLevel === "max") {
                return json({ ...base, detail: detailLevel, findings });
            }
            return json(await compactCollectionResult("as_project_bug_scan", detailLevel, "findings", findings, base, (entry) => {
                const finding = (entry && typeof entry === "object") ? entry : {};
                return {
                    type: finding.type || null,
                    severity: finding.severity || null,
                    path: finding.path || null,
                    line: finding.line || null,
                    preview: finding.preview || null,
                };
            }));
        }),
    }));
    tools.push(tool({
        name: "as_python_format",
        description: "Format Python code with ruff format, black, or autopep8 using a fallback order.",
        parameters: {
            paths: z.string().default("."),
            formatter: z.enum(["auto", "ruff", "black", "autopep8"]).default("auto"),
            check: z.boolean().default(false),
        },
        implementation: safeTool("as_python_format", async ({ paths, formatter, check }) => {
            requireCommandExecution();
            const target = quote(resolveInsideWorkspace(workspaceRoot, paths));
            const candidates = formatter === "auto" ? ["ruff", "black", "autopep8"] : [formatter];
            let command = "";
            for (const candidate of candidates) {
                if (candidate === "ruff" && await pythonModuleAvailable("ruff", workspaceRoot, pythonExecutable, shell, env, timeoutMs, maxOutputBytes)) {
                    command = `${quote(pythonExecutable)} -m ruff format ${check ? "--check " : ""}${target}`;
                    break;
                }
                if (candidate === "ruff" && await commandAvailable("ruff", workspaceRoot, shell, env, timeoutMs, maxOutputBytes)) {
                    command = `ruff format ${check ? "--check " : ""}${target}`;
                    break;
                }
                if (candidate === "black" && await pythonModuleAvailable("black", workspaceRoot, pythonExecutable, shell, env, timeoutMs, maxOutputBytes)) {
                    command = `${quote(pythonExecutable)} -m black ${check ? "--check " : ""}${target}`;
                    break;
                }
                if (candidate === "black" && await commandAvailable("black", workspaceRoot, shell, env, timeoutMs, maxOutputBytes)) {
                    command = `black ${check ? "--check " : ""}${target}`;
                    break;
                }
                if (candidate === "autopep8" && await commandAvailable("autopep8", workspaceRoot, shell, env, timeoutMs, maxOutputBytes)) {
                    command = `autopep8 ${check ? "--diff " : "--in-place --recursive "}${target}`;
                    break;
                }
            }
            if (!command)
                throw new Error("No supported formatter found.");
            return buildManagedCommandResponse(ctl, command, { cwd: workspaceRoot, shell, env }, timeoutMs, maxOutputBytes);
        }),
    }));
    tools.push(tool({
        name: "as_python_lint",
        description: "Lint Python code with ruff, flake8, or pylint.",
        parameters: {
            paths: z.string().default("."),
            linter: z.enum(["auto", "ruff", "flake8", "pylint"]).default("auto"),
        },
        implementation: safeTool("as_python_lint", async ({ paths, linter }) => {
            requireCommandExecution();
            const target = quote(resolveInsideWorkspace(workspaceRoot, paths));
            const candidates = linter === "auto" ? ["ruff", "flake8", "pylint"] : [linter];
            let command = "";
            let fallbackMode = "";
            for (const candidate of candidates) {
                if (candidate === "ruff" && await pythonModuleAvailable("ruff", workspaceRoot, pythonExecutable, shell, env, timeoutMs, maxOutputBytes)) {
                    command = `${quote(pythonExecutable)} -m ruff check ${target}`;
                    break;
                }
                if (candidate === "ruff" && await commandAvailable("ruff", workspaceRoot, shell, env, timeoutMs, maxOutputBytes)) {
                    command = `ruff check ${target}`;
                    break;
                }
                if (candidate === "flake8" && await pythonModuleAvailable("flake8", workspaceRoot, pythonExecutable, shell, env, timeoutMs, maxOutputBytes)) {
                    command = `${quote(pythonExecutable)} -m flake8 ${target}`;
                    break;
                }
                if (candidate === "flake8" && await commandAvailable("flake8", workspaceRoot, shell, env, timeoutMs, maxOutputBytes)) {
                    command = `flake8 ${target}`;
                    break;
                }
                if (candidate === "pylint" && await pythonModuleAvailable("pylint", workspaceRoot, pythonExecutable, shell, env, timeoutMs, maxOutputBytes)) {
                    command = `${quote(pythonExecutable)} -m pylint ${target}`;
                    break;
                }
                if (candidate === "pylint" && await commandAvailable("pylint", workspaceRoot, shell, env, timeoutMs, maxOutputBytes)) {
                    command = `pylint ${target}`;
                    break;
                }
            }
            if (!command) {
                command = `${quote(pythonExecutable)} -m compileall -q ${target}`;
                fallbackMode = "syntax_only";
            }
            const response = JSON.parse(await buildManagedCommandResponse(ctl, command, { cwd: workspaceRoot, shell, env }, timeoutMs, maxOutputBytes));
            if (fallbackMode) {
                response.fallbackMode = fallbackMode;
                response.note = "No dedicated Python linter was available, so a syntax-only validation pass was used.";
            }
            return json(response);
        }),
    }));
    tools.push(tool({
        name: "as_python_typecheck",
        description: "Type-check Python code with mypy or pyright.",
        parameters: {
            paths: z.string().default("."),
            tool_name: z.enum(["auto", "mypy", "pyright"]).default("auto"),
        },
        implementation: safeTool("as_python_typecheck", async ({ paths, tool_name }) => {
            requireCommandExecution();
            const target = quote(resolveInsideWorkspace(workspaceRoot, paths));
            const candidates = tool_name === "auto" ? ["mypy", "pyright"] : [tool_name];
            let command = "";
            let fallbackMode = "";
            for (const candidate of candidates) {
                if (candidate === "mypy" && await pythonModuleAvailable("mypy", workspaceRoot, pythonExecutable, shell, env, timeoutMs, maxOutputBytes)) {
                    command = `${quote(pythonExecutable)} -m mypy ${target}`;
                    break;
                }
                if (candidate === "mypy" && await commandAvailable("mypy", workspaceRoot, shell, env, timeoutMs, maxOutputBytes)) {
                    command = `mypy ${target}`;
                    break;
                }
                if (candidate === "pyright" && await commandAvailable("pyright", workspaceRoot, shell, env, timeoutMs, maxOutputBytes)) {
                    command = `pyright ${target}`;
                    break;
                }
            }
            if (!command) {
                command = `${quote(pythonExecutable)} -m compileall -q ${target}`;
                fallbackMode = "syntax_only";
            }
            const response = JSON.parse(await buildManagedCommandResponse(ctl, command, { cwd: workspaceRoot, shell, env }, timeoutMs, maxOutputBytes));
            if (fallbackMode) {
                response.fallbackMode = fallbackMode;
                response.note = "No dedicated Python type checker was available, so a syntax-only validation pass was used.";
            }
            return json(response);
        }),
    }));
    tools.push(tool({
        name: "as_python_run_tests",
        description: "Run Python tests with pytest when available, otherwise fall back to unittest discovery.",
        parameters: {
            paths: z.string().default("."),
            runner: z.enum(["auto", "pytest", "unittest"]).default("auto"),
        },
        implementation: safeTool("as_python_run_tests", async ({ paths, runner }) => {
            requireCommandExecution();
            const target = resolveInsideWorkspace(workspaceRoot, paths);
            let command = "";
            if ((runner === "auto" || runner === "pytest") && await pythonModuleAvailable("pytest", workspaceRoot, pythonExecutable, shell, env, timeoutMs, maxOutputBytes)) {
                command = `${quote(pythonExecutable)} -m pytest ${quote(target)}`;
            }
            else if (runner === "auto" || runner === "unittest") {
                const relativeTarget = path.relative(workspaceRoot, target) || ".";
                command = `${quote(pythonExecutable)} -m unittest discover ${quote(relativeTarget)}`;
            }
            if (!command)
                throw new Error("No supported Python test runner found.");
            return buildManagedCommandResponse(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
        }),
    }));
    tools.push(tool({
        name: "as_python_pip_list",
        description: "List installed Python packages from the configured interpreter.",
        parameters: {
            format: z.enum(["json", "plain"]).default("json"),
        },
        implementation: safeTool("as_python_pip_list", async ({ format }) => {
            requireCommandExecution();
            const command = `${quote(pythonExecutable)} -m pip list ${format === "json" ? "--format json" : ""}`.trim();
            return buildManagedCommandResponse(ctl, command, { cwd: workspaceRoot, shell, env }, timeoutMs, maxOutputBytes);
        }),
    }));
    tools.push(tool({
        name: "as_cpp_get_info",
        description: "Inspect available C++ compilers and basic build tool availability.",
        parameters: {},
        implementation: safeTool("as_cpp_get_info", async () => {
            requireCommandExecution();
            const compilerPreference = ctl.getPluginConfig(configSchematics).get("compilerPreference") || "auto";
            const compilerOrder = process.platform === "win32"
                ? (compilerPreference === "msvc" ? ["cl", "clang++", "g++"] : compilerPreference === "gcc" ? ["g++", "clang++", "cl"] : ["clang++", "g++", "cl"])
                : (compilerPreference === "gcc" ? ["g++", "clang++"] : ["clang++", "g++"]);
            const resolvedCompilers = await resolveCompilerCandidates(ctl, workspaceRoot, shell, env, timeoutMs, maxOutputBytes, compilerPreference);
            const compilers = [];
            for (const compiler of compilerOrder) {
                const resolved = resolvedCompilers.find((entry) => entry.name === compiler);
                if (!resolved) {
                    compilers.push({ name: compiler, detected: false });
                    continue;
                }
                const versionResult = await executeManagedCommand(ctl, resolved.versionCommand || resolved.command, { cwd: workspaceRoot, shell: resolved.shellOverride || shell, env }, timeoutMs, maxOutputBytes);
                compilers.push({
                    name: compiler,
                    detected: true,
                    detectedBy: resolved.detectedBy,
                    version: versionResult.stdout.split(/\r?\n/)[0] || versionResult.stderr.split(/\r?\n/)[0],
                });
            }
            const cmakeAvailable = await commandAvailable("cmake", workspaceRoot, shell, env, timeoutMs, maxOutputBytes);
            return json({ compilerPreference, compilers, cmakeAvailable });
        }),
    }));
    tools.push(tool({
        name: "as_cpp_compile_and_run",
        description: "Compile a C++ source file and run the resulting binary using clang++, g++, or cl on Windows.",
        parameters: {
            source: z.string().default(""),
            ...fileSelectionParameters,
            output: z.string().default("as_build_artifact"),
            std: z.string().regex(/^[A-Za-z0-9+_.-]+$/).default("c++17"),
            compiler: z.enum(["auto", "clang++", "g++", "cl"]).default("auto"),
            run_args: z.string().default(""),
        },
        implementation: safeTool("as_cpp_compile_and_run", async (params) => {
            requireCommandExecution();
            const { source, output, std, compiler, run_args } = params;
            assertNoShellControlOperators(run_args, "run_args");
            const targets = await resolveBatchFileTargets({
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
                requireFiles: true,
            });
            const batchMode = targets.length > 1 || hasBatchSelection(params);
            const requestedOutputPath = resolveInsideWorkspace(workspaceRoot, output);
            if (batchMode && await fileExists(requestedOutputPath) && !(await fsp.stat(requestedOutputPath)).isDirectory()) {
                throw new Error("output must be a directory when compiling multiple sources.");
            }
            const compilerPreference = ctl.getPluginConfig(configSchematics).get("compilerPreference") || "auto";
            const requestedCompilers = compiler === "auto"
                ? (process.platform === "win32"
                    ? (compilerPreference === "msvc" ? ["cl", "clang++", "g++"] : compilerPreference === "gcc" ? ["g++", "clang++", "cl"] : ["clang++", "g++", "cl"])
                    : (compilerPreference === "gcc" ? ["g++", "clang++"] : ["clang++", "g++"]))
                : [compiler];
            const resolvedCompilers = await resolveCompilerCandidates(ctl, workspaceRoot, shell, env, timeoutMs, maxOutputBytes, compilerPreference);
            const selected = requestedCompilers
                .map((candidateName) => resolvedCompilers.find((candidate) => candidate.name === candidateName))
                .find((candidate) => !!candidate);
            if (!selected)
                throw new Error("No supported C++ compiler found. On Windows, agentic-studio also checks Visual Studio Build Tools via vcvars64.bat.");
            const compileShell = selected.shellOverride || shell;
            const results = [];
            for (const target of targets) {
                const outputBase = batchMode
                    ? path.join(requestedOutputPath, path.basename(target.fullPath, path.extname(target.fullPath)))
                    : requestedOutputPath;
                const outputPath = process.platform === "win32" && path.extname(outputBase).toLowerCase() !== ".exe"
                    ? `${outputBase}.exe`
                    : outputBase;
                await fsp.mkdir(path.dirname(outputPath), { recursive: true });
                const compileCommand = selected.name === "cl"
                    ? `${selected.command} /nologo /EHsc /std:${std} ${quote(target.fullPath)} /Fe:${quote(outputPath)}`
                    : `${selected.command} -std=${std} ${quote(target.fullPath)} -o ${quote(outputPath)}`;
                const compileResult = await executeManagedCommand(ctl, compileCommand, { cwd: workspaceRoot, shell: compileShell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
                const compilePayload = buildCommandResponsePayload(compileCommand, compileResult);
                if (compileResult.error || compileResult.exitCode !== 0) {
                    results.push(mergeDefined({
                        source: target.relativePath,
                        compiler: selected.name,
                        output: path.relative(workspaceRoot, outputPath),
                        compile: compilePayload,
                        run: undefined,
                    }));
                    continue;
                }
                const runCommandText = `${quote(outputPath)} ${run_args}`.trim();
                const runResult = await executeManagedCommand(ctl, runCommandText, { cwd: workspaceRoot, shell: compileShell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
                results.push({
                    source: target.relativePath,
                    compiler: selected.name,
                    output: path.relative(workspaceRoot, outputPath),
                    compile: compilePayload,
                    run: buildCommandResponsePayload(runCommandText, runResult),
                });
            }
            return json(results.length === 1 ? results[0] : { count: results.length, results });
        }),
    }));
    tools.push(tool({
        name: "as_git_controller",
        description: "Run git actions through one controller. If unsure about arguments, call as_tool_help for as_git_controller before acting.",
        parameters: {
            action: z.enum(["status", "diff", "log", "show", "init", "clone", "add", "commit", "branch_list", "branch_create", "checkout", "restore", "fetch", "pull", "push", "reset", "stash_push", "stash_list", "stash_apply", "clean", "remote_list", "auth_status", "login"]),
            directory: z.string().default("."),
            porcelain: z.boolean().default(false),
            staged: z.boolean().default(false),
            stat: z.boolean().default(false),
            context_lines: z.number().int().min(0).max(200).default(3),
            pathspec: z.string().default(""),
            limit: z.number().int().min(1).max(200).default(20),
            revision: z.string().default("HEAD"),
            patch: z.boolean().default(false),
            branch: z.string().default(""),
            bare: z.boolean().default(false),
            repo_url: z.string().default(""),
            destination: z.string().default(""),
            depth: z.number().int().min(0).max(100000).default(0),
            recurse_submodules: z.boolean().default(false),
            paths_json: z.string().default("[]"),
            all: z.boolean().default(false),
            update: z.boolean().default(false),
            force: z.boolean().default(false),
            message: z.string().default(""),
            allow_empty: z.boolean().default(false),
            no_verify: z.boolean().default(false),
            verbose: z.boolean().default(true),
            name: z.string().default(""),
            start_point: z.string().default(""),
            checkout: z.boolean().default(true),
            create_branch: z.boolean().default(false),
            target: z.string().default(""),
            track: z.boolean().default(false),
            worktree: z.boolean().default(true),
            source: z.string().default(""),
            remote: z.string().default(""),
            prune: z.boolean().default(false),
            tags: z.boolean().default(false),
            rebase: z.boolean().default(false),
            ff_only: z.boolean().default(false),
            set_upstream: z.boolean().default(false),
            force_with_lease: z.boolean().default(false),
            mode: z.enum(["soft", "mixed", "hard"]).default("mixed"),
            include_untracked: z.boolean().default(false),
            keep_index: z.boolean().default(false),
            stash_ref: z.string().default("stash@{0}"),
            pop: z.boolean().default(false),
            restore_index: z.boolean().default(false),
            dry_run: z.boolean().default(true),
            include_ignored: z.boolean().default(false),
            directories_only: z.boolean().default(false),
            hostname: z.string().default("github.com"),
            git_protocol: z.enum(["https", "ssh"]).default("https"),
            token_env_var: z.string().default(""),
            use_web: z.boolean().default(true),
            confirm_destructive: z.boolean().default(false),
        },
        implementation: safeTool("as_git_controller", async (args) => {
            requireCommandExecution();
            const action = String(args.action);
            const ensureSafeToken = (value, fieldName, allowEmpty = true) => {
                const text = String(value || "").trim();
                if (!text && allowEmpty)
                    return text;
                if (!safeRevisionPattern.test(text))
                    throw new Error(`${fieldName} contains unsupported git revision characters.`);
                return text;
            };
            const cwd = action === "clone" || action === "auth_status" || action === "login"
                ? workspaceRoot
                : resolveGitDirectory(args.directory);
            const runGit = (command, commandTimeout = timeoutMs) => buildManagedCommandResponse(ctl, command, { cwd, shell, env }, commandTimeout, maxOutputBytes);
            if (action === "status") {
                return runGit(args.porcelain ? "git status --porcelain=v1 --branch" : "git status --short --branch");
            }
            if (action === "diff") {
                const relPathspec = resolvePathspec(cwd, args.pathspec);
                const parts = ["git diff --no-ext-diff"];
                if (args.staged)
                    parts.push("--cached");
                parts.push(args.stat ? "--stat" : `-U${Number(args.context_lines)}`);
                if (relPathspec)
                    parts.push("--", quote(relPathspec));
                return runGit(parts.join(" "));
            }
            if (action === "log") {
                const relPathspec = resolvePathspec(cwd, args.pathspec);
                const parts = ["git log", `--max-count=${Number(args.limit)}`, "--date=iso", "--pretty=format:%H%x09%ad%x09%an%x09%s"];
                if (relPathspec)
                    parts.push("--", quote(relPathspec));
                return runGit(parts.join(" "));
            }
            if (action === "show") {
                const parts = ["git show --no-ext-diff"];
                if (args.stat)
                    parts.push("--stat");
                if (args.patch)
                    parts.push("--patch");
                else if (!args.stat)
                    parts.push("--no-patch");
                parts.push(quote(ensureSafeToken(args.revision, "revision", false)));
                return runGit(parts.join(" "));
            }
            if (action === "init") {
                const parts = ["git init"];
                if (args.bare)
                    parts.push("--bare");
                const branch = ensureSafeToken(args.branch, "branch");
                if (branch)
                    parts.push(`--initial-branch ${quote(branch)}`);
                return runGit(parts.join(" "));
            }
            if (action === "clone") {
                const destinationPath = resolveInsideWorkspace(workspaceRoot, args.destination);
                if (!String(args.repo_url || "").trim())
                    throw new Error("repo_url is required for clone.");
                if (!String(args.destination || "").trim())
                    throw new Error("destination is required for clone.");
                if (await fileExists(destinationPath))
                    throw new Error("Destination already exists.");
                await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
                const parts = ["git clone"];
                const branch = ensureSafeToken(args.branch, "branch");
                if (branch)
                    parts.push(`--branch ${quote(branch)}`);
                if (Number(args.depth) > 0)
                    parts.push(`--depth ${Number(args.depth)}`);
                if (args.recurse_submodules)
                    parts.push("--recurse-submodules");
                parts.push(quote(String(args.repo_url)));
                parts.push(quote(destinationPath));
                return buildManagedCommandResponse(ctl, parts.join(" "), { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 300000), maxOutputBytes);
            }
            if (action === "add") {
                const paths = parseGitPaths(args.paths_json);
                if (!args.all && paths.length === 0)
                    throw new Error("Provide paths_json or set all=true.");
                const parts = ["git add"];
                if (args.all)
                    parts.push("--all");
                if (args.update)
                    parts.push("--update");
                if (args.force)
                    parts.push("--force");
                return runGit(`${parts.join(" ")}${buildGitPathspecSuffix(cwd, paths)}`);
            }
            if (action === "commit") {
                if (!String(args.message || "").trim())
                    throw new Error("message is required for commit.");
                const parts = ["git commit", `-m ${quote(args.message)}`];
                if (args.all)
                    parts.push("--all");
                if (args.allow_empty)
                    parts.push("--allow-empty");
                if (args.no_verify)
                    parts.push("--no-verify");
                return runGit(parts.join(" "), Math.max(timeoutMs, 120000));
            }
            if (action === "branch_list") {
                const parts = ["git branch"];
                if (args.all)
                    parts.push("--all");
                if (args.verbose)
                    parts.push("--verbose");
                return runGit(parts.join(" "));
            }
            if (action === "branch_create") {
                const branchName = ensureSafeToken(args.name, "name", false);
                const startPoint = ensureSafeToken(args.start_point, "start_point");
                const parts = args.checkout
                    ? ["git checkout", args.force ? "-B" : "-b", quote(branchName)]
                    : ["git branch", args.force ? "--force" : "", quote(branchName)];
                if (startPoint)
                    parts.push(quote(startPoint));
                return runGit(parts.filter(Boolean).join(" "));
            }
            if (action === "checkout") {
                const target = ensureSafeToken(args.target, "target", false);
                const startPoint = ensureSafeToken(args.start_point, "start_point");
                const parts = ["git checkout"];
                if (args.force)
                    parts.push("--force");
                if (args.create_branch) {
                    parts.push(args.track ? "--track" : "");
                    parts.push("-b", quote(target));
                    if (startPoint)
                        parts.push(quote(startPoint));
                }
                else {
                    parts.push(quote(target));
                }
                return runGit(parts.filter(Boolean).join(" "));
            }
            if (action === "restore") {
                const paths = parseGitPaths(args.paths_json);
                if (paths.length === 0)
                    throw new Error("paths_json must contain at least one path.");
                const source = ensureSafeToken(args.source, "source");
                const parts = ["git restore"];
                if (args.staged)
                    parts.push("--staged");
                if (args.worktree)
                    parts.push("--worktree");
                if (source)
                    parts.push(`--source ${quote(source)}`);
                return runGit(`${parts.join(" ")}${buildGitPathspecSuffix(cwd, paths)}`);
            }
            if (action === "fetch") {
                const remote = ensureSafeToken(args.remote, "remote");
                const parts = ["git fetch"];
                if (args.all)
                    parts.push("--all");
                if (args.prune)
                    parts.push("--prune");
                if (args.tags)
                    parts.push("--tags");
                if (!args.all && remote)
                    parts.push(quote(remote));
                return runGit(parts.join(" "), Math.max(timeoutMs, 180000));
            }
            if (action === "pull") {
                const remote = ensureSafeToken(args.remote, "remote");
                const branch = ensureSafeToken(args.branch, "branch");
                const parts = ["git pull"];
                if (args.rebase)
                    parts.push("--rebase");
                if (args.ff_only)
                    parts.push("--ff-only");
                if (remote)
                    parts.push(quote(remote));
                if (branch)
                    parts.push(quote(branch));
                return runGit(parts.join(" "), Math.max(timeoutMs, 180000));
            }
            if (action === "push") {
                const remote = ensureSafeToken(args.remote || "origin", "remote", false);
                const branch = ensureSafeToken(args.branch, "branch");
                const parts = ["git push"];
                if (args.set_upstream)
                    parts.push("--set-upstream");
                if (args.force_with_lease)
                    parts.push("--force-with-lease");
                if (args.tags)
                    parts.push("--tags");
                parts.push(quote(remote));
                if (branch)
                    parts.push(quote(branch));
                return runGit(parts.join(" "), Math.max(timeoutMs, 180000));
            }
            if (action === "reset") {
                const paths = parseGitPaths(args.paths_json);
                if (paths.length > 0 && args.mode !== "mixed")
                    throw new Error("Path-scoped reset only supports mode='mixed'.");
                if (args.mode === "hard" && !args.confirm_destructive)
                    throw new Error("Hard reset requires confirm_destructive=true.");
                const parts = ["git reset"];
                if (paths.length === 0)
                    parts.push(`--${args.mode}`);
                parts.push(quote(ensureSafeToken(args.revision, "revision", false)));
                return runGit(`${parts.join(" ")}${buildGitPathspecSuffix(cwd, paths)}`);
            }
            if (action === "stash_push") {
                const paths = parseGitPaths(args.paths_json);
                const parts = ["git stash push"];
                if (args.include_untracked)
                    parts.push("--include-untracked");
                if (args.keep_index)
                    parts.push("--keep-index");
                if (String(args.message || "").trim())
                    parts.push(`--message ${quote(args.message)}`);
                return runGit(`${parts.join(" ")}${buildGitPathspecSuffix(cwd, paths)}`, Math.max(timeoutMs, 180000));
            }
            if (action === "stash_list") {
                return runGit(`git stash list --max-count=${Number(args.limit)}`);
            }
            if (action === "stash_apply") {
                const parts = [args.pop ? "git stash pop" : "git stash apply"];
                if (args.restore_index)
                    parts.push("--index");
                parts.push(quote(ensureSafeToken(args.stash_ref, "stash_ref", false)));
                return runGit(parts.join(" "), Math.max(timeoutMs, 180000));
            }
            if (action === "clean") {
                if (!args.dry_run && !args.confirm_destructive)
                    throw new Error("Non-dry-run clean requires confirm_destructive=true.");
                const paths = parseGitPaths(args.paths_json);
                const parts = ["git clean", args.dry_run ? "--dry-run" : "--force"];
                if (args.include_ignored)
                    parts.push("-x");
                if (args.directories_only || paths.length > 0)
                    parts.push("-d");
                return runGit(`${parts.join(" ")}${buildGitPathspecSuffix(cwd, paths)}`);
            }
            if (action === "remote_list") {
                return runGit(args.verbose ? "git remote --verbose" : "git remote");
            }
            if (action === "auth_status") {
                if (!await commandAvailable("gh", workspaceRoot, shell, env, timeoutMs, maxOutputBytes)) {
                    throw new Error("GitHub CLI 'gh' was not found in PATH.");
                }
                const command = `gh auth status --hostname ${quote(args.hostname)}`;
                return buildManagedCommandResponse(ctl, command, { cwd: workspaceRoot, shell, env }, timeoutMs, maxOutputBytes);
            }
            if (action === "login") {
                if (!await commandAvailable("gh", workspaceRoot, shell, env, timeoutMs, maxOutputBytes)) {
                    throw new Error("GitHub CLI 'gh' was not found in PATH.");
                }
                const tokenVar = String(args.token_env_var || "").trim();
                if (tokenVar) {
                    const token = process.env[tokenVar];
                    if (!token)
                        throw new Error(`Environment variable '${tokenVar}' is not set.`);
                    const nodePath = await getNodeExecutablePath(ctl);
                    const script = `
const { spawn } = require("child_process");
const token = ${JSON.stringify(token)};
const args = ["auth", "login", "--hostname", ${JSON.stringify(String(args.hostname))}, "--git-protocol", ${JSON.stringify(String(args.git_protocol))}, "--with-token"];
const child = spawn("gh", args, { cwd: ${JSON.stringify(workspaceRoot)}, env: process.env, stdio: ["pipe", "pipe", "pipe"] });
let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => { stdout += String(chunk); });
child.stderr.on("data", (chunk) => { stderr += String(chunk); });
child.on("error", (error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
child.on("close", (code) => {
  console.log(JSON.stringify({ exitCode: code, stdout, stderr }));
  process.exit(code || 0);
});
child.stdin.end(token.endsWith("\\n") ? token : token + "\\n");
`;
                    const result = await executeInlineNodeScript(ctl, script, shell, env, workspaceRoot, Math.max(timeoutMs, 180000), maxOutputBytes, nodePath);
                    return buildCommandResponse(`gh auth login --hostname ${args.hostname} --git-protocol ${args.git_protocol} --with-token`, result);
                }
                if (!args.use_web)
                    throw new Error("Provide token_env_var or set use_web=true.");
                const command = `gh auth login --hostname ${quote(args.hostname)} --git-protocol ${quote(args.git_protocol)} --web`;
                return buildManagedCommandResponse(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 300000), maxOutputBytes);
            }
            throw new Error(`Unsupported git action: ${action}`);
        }),
    }));
    tools.push(tool({
        name: "as_code_outline",
        description: "Extract lightweight symbol outlines from one or more source, Markdown, or JSON files.",
        parameters: {
            path: z.string().default(""),
            ...fileSelectionParameters,
            language: z.enum(["auto", "typescript", "javascript", "python", "markdown", "json", "text"]).default("auto"),
            limit: z.number().int().min(1).max(2000).default(300),
        },
        implementation: safeTool("as_code_outline", async (params) => {
            const { path: relPath, language, limit } = params;
            const targets = await resolveBatchFileTargets({
                workspaceRoot,
                resolvePath: resolveInsideWorkspace,
                primaryPath: relPath,
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
                const text = await fsp.readFile(target.fullPath, "utf8");
                const detectedLanguage = detectOutlineLanguage(target.fullPath, language);
                const symbols = buildCodeOutline(text, detectedLanguage, limit);
                results.push({
                    path: target.relativePath,
                    language: detectedLanguage,
                    count: symbols.length,
                    symbols,
                });
            }
            return json(results.length === 1 ? results[0] : { count: results.length, results });
        }),
    }));
    tools.push(tool({
        name: "as_dynamic_tool",
        description: "Manage Python-backed dynamic tools with one action-based controller. Use as_tool_help for schema and examples when unsure.",
        parameters: {
            action: z.enum(["list", "scaffold", "create", "validate", "call", "delete"]),
            name: dynamicToolNameSchema.default("tool_name"),
            description: z.string().default(""),
            args_schema: z.string().default(""),
            python_code: z.string().default(""),
            example_args_json: z.string().default("{}"),
            args_json: z.string().default("{}"),
            overwrite: z.boolean().default(false),
            detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
        },
        implementation: safeTool("as_dynamic_tool", async ({ action, name, description, args_schema, python_code, example_args_json, args_json, overwrite, detail }) => {
            const selectedAction = String(action);
            const detailLevel = normalizeDetailLevel(detail);
            const toolsDir = dynamicToolsDirectory(workspaceRoot);
            if (selectedAction === "list") {
                if (!await fileExists(toolsDir))
                    return json({ tools: [] });
                const entries = await fsp.readdir(toolsDir);
                const toolsList = [];
                for (const entry of entries) {
                    if (!entry.endsWith(".json"))
                        continue;
                    const toolDef = JSON.parse(await fsp.readFile(path.join(toolsDir, entry), "utf8"));
                    toolsList.push({
                        name: toolDef.name,
                        description: toolDef.description,
                        args_schema: detailLevel !== "compact" ? toolDef.args_schema : undefined,
                        updatedAt: toolDef.updatedAt,
                    });
                }
                toolsList.sort((a, b) => String(a.name).localeCompare(String(b.name)));
                if (detailLevel === "max")
                    return json({ detail: detailLevel, tools: toolsList });
                return json(await compactCollectionResult("as_dynamic_tool", detailLevel, "tools", toolsList, { detail: detailLevel }));
            }
            if (selectedAction === "scaffold") {
                const parsedExample = JSON.parse(example_args_json);
                if (!parsedExample || typeof parsedExample !== "object" || Array.isArray(parsedExample)) {
                    throw new Error("example_args_json must be a JSON object.");
                }
                await fsp.mkdir(toolsDir, { recursive: true });
                const toolPath = path.join(toolsDir, `${name}.json`);
                if (await fileExists(toolPath) && !overwrite)
                    throw new Error(`Tool '${name}' already exists.`);
                const properties = Object.fromEntries(Object.entries(parsedExample).map(([key, value]) => {
                    const valueType = Array.isArray(value) ? "array" : value === null ? "string" : typeof value;
                    return [key, { type: ["string", "number", "boolean", "object", "array"].includes(valueType) ? valueType : "string" }];
                }));
                const argsSchema = { type: "object", properties, required: Object.keys(properties) };
                const scaffoldCode = [
                    "def run(args):",
                    "    return {",
                    "        'ok': True,",
                    "        'message': 'Tool scaffold created successfully. Update run(args) with real behavior.',",
                    "        'received': args,",
                    "    }",
                ].join("\n");
                await fsp.writeFile(toolPath, JSON.stringify({
                    name,
                    description,
                    args_schema: JSON.stringify(argsSchema, null, 2),
                    python_code: scaffoldCode,
                    updatedAt: new Date().toISOString(),
                }, null, 2), "utf8");
                return json({ success: true, tool: name, path: path.relative(workspaceRoot, toolPath) });
            }
            if (selectedAction === "create") {
                if (args_schema.trim())
                    JSON.parse(args_schema);
                await fsp.mkdir(toolsDir, { recursive: true });
                const toolPath = path.join(toolsDir, `${name}.json`);
                if (await fileExists(toolPath) && !overwrite)
                    throw new Error(`Tool '${name}' already exists.`);
                await fsp.writeFile(toolPath, JSON.stringify({
                    name,
                    description,
                    args_schema,
                    python_code,
                    updatedAt: new Date().toISOString(),
                }, null, 2), "utf8");
                return json({ success: true, tool: name, path: path.relative(workspaceRoot, toolPath) });
            }
            if (selectedAction === "validate") {
                const toolPath = resolveInsideDirectory(toolsDir, `${name}.json`);
                if (!await fileExists(toolPath))
                    throw new Error(`Tool '${name}' not found.`);
                const toolDef = JSON.parse(await fsp.readFile(toolPath, "utf8"));
                if (String(toolDef.args_schema || "").trim()) {
                    const parsedSchema = JSON.parse(toolDef.args_schema);
                    if (!parsedSchema || typeof parsedSchema !== "object" || Array.isArray(parsedSchema)) {
                        throw new Error("args_schema must decode to a JSON object.");
                    }
                }
                const script = [
                    "import ast, json",
                    `code = """${String(toolDef.python_code || "").replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"')}"""`,
                    "wrapper = 'def _as_tool(args):\\n' + '\\n'.join('    ' + line for line in code.splitlines())",
                    "ast.parse(wrapper)",
                    "print(json.dumps({'success': True}))",
                ].join("\n");
                const result = await executeInlinePython(ctl, pythonExecutable, script, shell, env, workspaceRoot, Math.max(timeoutMs, 120000), maxOutputBytes);
                return json({
                    success: !result.error && result.exitCode === 0,
                    tool: name,
                    path: path.relative(workspaceRoot, toolPath),
                    schemaValid: true,
                    pythonSyntaxValid: !result.error && result.exitCode === 0,
                    stderr: result.stderr,
                    error: result.error,
                });
            }
            if (selectedAction === "call") {
                requireCommandExecution();
                JSON.parse(args_json);
                const toolPath = resolveInsideDirectory(toolsDir, `${name}.json`);
                if (!await fileExists(toolPath))
                    throw new Error(`Tool '${name}' not found.`);
                const toolDef = JSON.parse(await fsp.readFile(toolPath, "utf8"));
                const runnerDir = await fsp.mkdtemp(path.join(os.tmpdir(), "mc-tool-"));
                try {
                    const argsPath = path.join(runnerDir, "args.json");
                    const scriptPath = path.join(runnerDir, "runner.py");
                    await fsp.writeFile(argsPath, args_json, "utf8");
                    const script = [
                        "import json",
                        "import io",
                        "import inspect",
                        "import contextlib",
                        `with open("${escapeForPython(argsPath)}", "r", encoding="utf-8") as handle:`,
                        "    args = json.load(handle)",
                        "def _invoke_callable(_fn, _args):",
                        "    try:",
                        "        _signature = inspect.signature(_fn)",
                        "    except (TypeError, ValueError):",
                        "        _signature = None",
                        "    if isinstance(_args, dict):",
                        "        if _signature is not None:",
                        "            try:",
                        "                _signature.bind(**_args)",
                        "                return _fn(**_args)",
                        "            except TypeError:",
                        "                pass",
                        "        return _fn(_args)",
                        "    if isinstance(_args, (list, tuple)):",
                        "        if _signature is not None:",
                        "            try:",
                        "                _signature.bind(*_args)",
                        "                return _fn(*_args)",
                        "            except TypeError:",
                        "                pass",
                        "        return _fn(_args)",
                        "    return _fn(_args)",
                        "def _as_tool(args):",
                        indentPython(toolDef.python_code),
                        `    _named = locals().get(${JSON.stringify(name)})`,
                        "    if callable(_named):",
                        "        return _invoke_callable(_named, args)",
                        "    for _fallback_name in ('run', 'main', 'handler', 'tool'):",
                        "        _candidate = locals().get(_fallback_name)",
                        "        if callable(_candidate):",
                        "            return _invoke_callable(_candidate, args)",
                        "    if 'result' in locals():",
                        "        return locals()['result']",
                        "    if 'output' in locals():",
                        "        return locals()['output']",
                        "    if 'OUTPUT' in locals():",
                        "        return locals()['OUTPUT']",
                        "    return None",
                        "_stdout_buffer = io.StringIO()",
                        "with contextlib.redirect_stdout(_stdout_buffer):",
                        "    result = _as_tool(args)",
                        "captured_stdout = _stdout_buffer.getvalue()",
                        "print(json.dumps({'result': result, 'captured_stdout': captured_stdout, 'output': captured_stdout if result is None else result}, ensure_ascii=False, default=str))",
                    ].join("\n");
                    await fsp.writeFile(scriptPath, script, "utf8");
                    const command = `${quote(pythonExecutable)} ${quote(scriptPath)}`;
                    const policy = resolveCommandPolicy(ctl);
                    assertCommandAllowed(command, policy);
                    const result = policy.testMode
                        ? { stdout: "", stderr: "", exitCode: 0, error: null }
                        : await runCommand(command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
                    const parsedOutput = result.stdout ? (() => { try {
                        return JSON.parse(result.stdout);
                    }
                    catch {
                        return null;
                    } })() : null;
                    const base = {
                        tool: name,
                        success: !result.error && result.exitCode === 0,
                        testMode: policy.testMode,
                        stdout: result.stdout,
                        capturedStdout: parsedOutput?.captured_stdout ?? "",
                        stderr: result.stderr,
                        error: result.error,
                        exitCode: result.exitCode,
                    };
                    if (detailLevel === "max") {
                        return json({
                            ...base,
                            detail: detailLevel,
                            output: parsedOutput?.output ?? null,
                            result: parsedOutput?.result ?? null,
                        });
                    }
                    const withResult = await compactValueResult("as_dynamic_tool", detailLevel, "result", parsedOutput?.result ?? null, base);
                    return json(await compactValueResult("as_dynamic_tool", detailLevel, "output", parsedOutput?.output ?? null, withResult));
                }
                finally {
                    await fsp.rm(runnerDir, { recursive: true, force: true });
                }
            }
            if (selectedAction === "delete") {
                const toolPath = resolveInsideDirectory(toolsDir, `${name}.json`);
                if (!await fileExists(toolPath))
                    throw new Error(`Tool '${name}' not found.`);
                await fsp.rm(toolPath, { force: true });
                return json({ success: true, tool: name });
            }
            throw new Error(`Unsupported dynamic tool action: ${selectedAction}`);
        }),
    }));
    tools.push(tool({
        name: "consult_secondary_agent",
        description: "Delegate a focused task to a secondary agent with optional tools and role profiles.",
        parameters: {
            task: z.string(),
            agent_role: z.string().default("general"),
            context: z.string().default(""),
            allow_tools: z.boolean().default(false),
            working_directory: z.string().default("."),
        },
        implementation: safeTool("consult_secondary_agent", async ({ task, agent_role, context: extraContext, allow_tools, working_directory }) => {
            const enabled = ctl.getPluginConfig(configSchematics).get("enableSecondaryAgent") ?? false;
            if (!enabled) {
                throw new Error("Secondary agent is disabled in agentic-studio settings.");
            }
            const maxDepth = ctl.getPluginConfig(configSchematics).get("subAgentMaxDepth") ?? 2;
            if (subAgentRuntime.getDepth() >= maxDepth) {
                throw new Error(`Sub-agent depth limit reached (${subAgentRuntime.getDepth()}/${maxDepth}).`);
            }
            const endpoint = subAgentRuntime.getNormalizedLmStudioEndpoint(ctl);
            const preferredModelId = ctl.getPluginConfig(configSchematics).get("subAgentModelId")?.trim() || "";
            const modelId = await subAgentRuntime.resolveSubAgentModel(endpoint, preferredModelId);
            const permissionLevel = subAgentRuntime.getSubAgentPermissionLevel(ctl);
            const workingDir = resolveInsideWorkspace(workspaceRoot, working_directory);
            const subAgentProfiles = subAgentRuntime.getSubAgentProfiles(ctl);
            const debugEnabled = ctl.getPluginConfig(configSchematics).get("enableAutoDebug") ?? false;
            const maxIterations = ctl.getPluginConfig(configSchematics).get("subAgentMaxIterations") ?? 6;
            const showFullCode = ctl.getPluginConfig(configSchematics).get("subAgentShowFullCode") ?? false;
            const role = String(agent_role || "general");
            const filesModified = [];
            const toolDefs = allow_tools ? subAgentRuntime.buildSubAgentToolDefinitions(permissionLevel) : [];
            const instructionsPath = path.join(workingDir, "SUB_AGENT_INSTRUCTIONS.md");
            let baseSystemPrompt = "You are a focused sub-agent. Complete the assigned task and stop when done.";
            try {
                const instructions = await fsp.readFile(instructionsPath, "utf8");
                if (instructions.trim())
                    baseSystemPrompt = instructions.trim();
            }
            catch {
                // ignore
            }
            if (subAgentProfiles[role]) {
                baseSystemPrompt += `\n\n## Role\n${subAgentProfiles[role]}`;
            }
            baseSystemPrompt += `\n\n## Workspace\nCurrent working directory: ${workingDir}`;
            if (allow_tools) {
                baseSystemPrompt += `\n\n## Tools\nYou may call tools when needed. When you are finished, respond normally without further tool calls.`;
            }
            const messages = [
                { role: "system", content: baseSystemPrompt },
                { role: "user", content: `Task: ${task}\n\nContext:\n${extraContext || ""}`.trim() },
            ];
            const subAgentContext = {
                workspaceRoot,
                cwd: workingDir,
                shell,
                env,
                timeoutMs: Math.max(timeoutMs, 120000),
                maxOutputBytes,
                pythonExecutable,
            };
            let finalResponse = "";
            subAgentRuntime.incrementDepth();
            try {
                for (let iteration = 0; iteration < maxIterations; iteration++) {
                    const response = await subAgentRuntime.chatCompletionForSubAgent(endpoint, modelId, messages, toolDefs, Math.max(timeoutMs, 150000));
                    const message = response.choices[0]?.message;
                    if (!message)
                        throw new Error("Sub-agent returned an empty response.");
                    messages.push(message);
                    const toolCalls = message.tool_calls || [];
                    if (toolCalls.length === 0) {
                        finalResponse = message.content?.trim() || "";
                        break;
                    }
                    for (const toolCall of toolCalls) {
                        const result = await subAgentRuntime.executeSubAgentTool(ctl, toolCall.function.name, toolCall.function.arguments, subAgentContext, filesModified);
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: result,
                        });
                    }
                }
            }
            finally {
                subAgentRuntime.decrementDepth();
            }
            if (!finalResponse) {
                finalResponse = "Sub-agent reached its iteration limit without a final plain-text response.";
            }
            if (filesModified.length > 0) {
                finalResponse = await subAgentRuntime.autoSaveSubAgentCodeBlocks(finalResponse, workingDir, workspaceRoot, filesModified);
            }
            if (debugEnabled && permissionLevel === "full" && filesModified.length > 0 && role !== "reviewer" && subAgentRuntime.getDepth() < maxDepth) {
                const debugMessages = [];
                for (const modified of filesModified) {
                    try {
                        const fullPath = resolveInsideWorkspace(workspaceRoot, modified);
                        const content = await fsp.readFile(fullPath, "utf8");
                        debugMessages.push(`--- ${modified} ---\n${truncateOutput(content, 8000)}`);
                    }
                    catch {
                        continue;
                    }
                }
                if (debugMessages.length > 0) {
                    const reviewResult = await (async () => {
                        subAgentRuntime.incrementDepth();
                        try {
                            const reviewMessages = [
                                { role: "system", content: `${baseSystemPrompt}\n\n## Role\n${subAgentProfiles.reviewer || "You are a strict code reviewer. Find issues and fix them using tools."}` },
                                { role: "user", content: `Review and fix issues in these files:\n${debugMessages.join("\n\n")}` },
                            ];
                            let responseText = "";
                            for (let iteration = 0; iteration < Math.min(5, maxIterations); iteration++) {
                                const response = await subAgentRuntime.chatCompletionForSubAgent(endpoint, modelId, reviewMessages, subAgentRuntime.buildSubAgentToolDefinitions("full"), Math.max(timeoutMs, 150000));
                                const message = response.choices[0]?.message;
                                if (!message)
                                    break;
                                reviewMessages.push(message);
                                const toolCalls = message.tool_calls || [];
                                if (toolCalls.length === 0) {
                                    responseText = message.content?.trim() || "";
                                    break;
                                }
                                for (const toolCall of toolCalls) {
                                    const result = await subAgentRuntime.executeSubAgentTool(ctl, toolCall.function.name, toolCall.function.arguments, subAgentContext, filesModified);
                                    reviewMessages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
                                }
                            }
                            return responseText;
                        }
                        finally {
                            subAgentRuntime.decrementDepth();
                        }
                    })();
                    if (reviewResult) {
                        finalResponse += `\n\n--- Auto-Debug Report ---\n${reviewResult}`;
                    }
                }
            }
            if (filesModified.length > 0) {
                const uniqueFiles = [...new Set(filesModified)];
                finalResponse += `\n\n[GENERATED_FILES]: ${uniqueFiles.map((filePath) => path.join(workspaceRoot, filePath)).join(", ")}`;
            }
            if (!showFullCode) {
                finalResponse = finalResponse.replace(/```[\s\S]*?```/g, "\n[System: Code Block Hidden. The code has been handled by the sub-agent.]\n");
            }
            return json({
                success: true,
                modelId,
                role,
                workingDirectory: path.relative(workspaceRoot, workingDir) || ".",
                response: finalResponse,
                generated_files: [...new Set(filesModified)],
            });
        }),
    }));
    tools.push(tool({
        name: "as_run_shell_command",
        description: "Run one shell command using agentic-studio command policy controls.",
        parameters: {
            command: z.string(),
            directory: z.string().default("."),
        },
        implementation: safeTool("as_run_shell_command", async ({ command, directory }) => {
            requireCommandExecution();
            const cwd = resolveInsideWorkspace(workspaceRoot, directory);
            return buildManagedCommandResponse(ctl, command, { cwd, shell, env }, timeoutMs, maxOutputBytes);
        }),
    }));
}
//# sourceMappingURL=development.js.map