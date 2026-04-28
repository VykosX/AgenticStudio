// @ts-nocheck
import type { ToolModuleContext } from "../shared/toolModule";
import { aliasesEnabled, findToolAliasDefinition, isToolAliasName, TOOL_ALIAS_DEFINITIONS } from "./consolidated";
import { getMathToolReference, getUnitConversionToolReference } from "./mathAndUnits";

function schemaParameterSummary(schema: any): any[] {
  const properties = schema?.properties || {};
  return Object.entries(properties).map(([name, value]: [string, any]) => ({
    name,
    type: value?.type || (Array.isArray(value?.anyOf) ? value.anyOf.map((entry: any) => entry?.type).filter(Boolean) : null),
    description: value?.description || "",
    enum: value?.enum || null,
    default: value?.default,
    required: Array.isArray(schema?.required) ? schema.required.includes(name) : false,
  }));
}

function genericToolUseCases(toolName: string, category: string): string[] {
  const normalizedName = String(toolName || "").toLowerCase();
  const normalizedCategory = String(category || "").toLowerCase();
  if (normalizedName === "as_math") {
    return [
      "Evaluate expressions precisely instead of estimating.",
      "Define reusable variables or functions for a conversation and reference them later.",
      "Inspect supported functions and constants before composing a more complex expression.",
      "Reuse ans or last when chaining calculations across turns.",
    ];
  }
  if (normalizedName === "as_unit_conversion") {
    return [
      "Convert between common units like length, mass, speed, storage, and temperature.",
      "Convert cooking measures and practical everyday quantities.",
      "Convert currencies using the tool's exchange-rate source.",
      "Inspect valid categories and unit aliases before converting ambiguous inputs.",
    ];
  }
  if (normalizedName.includes("_file_") || normalizedCategory.includes("file")) {
    return [
      "Inspect or transform workspace files without dropping to generic shell commands.",
      "Use path for a single target or file_list/folder_list to process many files in one call.",
      "Preview destructive or batch operations before applying them.",
      "Use specialized file tools for structured data, duplicate detection, renames, and reorganization.",
      "Prefer workspace-scoped file tools when you need predictable, undo-friendly behavior.",
    ];
  }
  if (normalizedName.startsWith("as_web_") || normalizedName.startsWith("as_http_") || normalizedCategory.includes("web")) {
    return [
      "Fetch, search, archive, or scrape web content with a tool suited to the task.",
      "Use raw request tools for APIs and deterministic HTTP flows.",
      "Use browser-style tools when pages are dynamic or require interaction.",
      "Prefer specialized download or archive tools when you need saved artifacts.",
    ];
  }
  if (normalizedName.startsWith("as_media_") || normalizedName.startsWith("as_image_") || normalizedName.startsWith("as_audio_") || normalizedName.startsWith("as_video_") || normalizedCategory.includes("media")) {
    return [
      "Inspect media metadata before transforming or exporting.",
      "Use file_list/folder_list with file_pattern when applying the same probe, metadata, or conversion operation to many assets.",
      "Use targeted conversion or extraction tools instead of generic shell wrappers.",
      "Handle artwork, subtitles, chapters, and container metadata with purpose-built tools.",
      "Prefer probe-style tools first when you need to understand codecs, streams, or dimensions.",
    ];
  }
  if (normalizedName.startsWith("as_window_") || normalizedName.startsWith("as_input_") || normalizedName.startsWith("as_clipboard_") || normalizedName.startsWith("as_process_") || normalizedCategory.includes("desktop")) {
    return [
      "Inspect windows, processes, or clipboard state before automating input.",
      "Use focus, bounds, or listing tools to target the right app first.",
      "Prefer file or shell tools over GUI automation when both can solve the task.",
      "Use process-oriented tools when you need observability or control over local apps.",
    ];
  }
  if (["as_structured_data", "as_tabular_data", "as_database_query"].includes(normalizedName) || normalizedCategory.includes("data")) {
    return [
      "Read, validate, transform, or rewrite structured data with schema-aware tools.",
      "Use file_list/folder_list to apply the same read, validation, query, or rewrite across many matching files.",
      "Preview changes to serialized formats before writing when possible.",
      "Use merge or patch style tools for partial updates instead of full rewrites.",
      "Use as_tabular_data when querying tabular data rather than plain text parsing.",
    ];
  }
  if (normalizedName === "as_git_controller") {
    return [
      "Inspect repository state, stage selective changes, and move work through commits and pushes with structured parameters.",
      "Use git helpers when you want a bounded repo operation instead of a free-form shell command.",
      "Pair repo mutation tools with status or diff checks so the agent can verify what changed.",
    ];
  }
  if (normalizedName === "as_agent_task") {
    return [
      "Persist a workspace task queue across turns instead of relying on ephemeral chat memory.",
      "Coordinate larger multi-step work with explicit statuses, priorities, and appended execution notes.",
      "Find the next unfinished task quickly when the work needs to resume later.",
    ];
  }
  if (normalizedName.startsWith("as_project_")) {
    return [
      "Run a project verification sweep using locally detected lint, typecheck, test, and build commands.",
      "Collect high-signal bug markers before a deeper repair pass.",
      "Use these tools as fast verification gates before commits or handoff.",
    ];
  }
  if (normalizedName === "as_skill" || normalizedName === "as_skill_recommend" || normalizedName === "as_dynamic_tool") {
    return [
      "Create reusable local skills or dynamic tools when the same workflow keeps repeating.",
      "Generate a scaffold first, then validate it before relying on it from later turns.",
      "Use these helpers to gradually turn one-off work into maintained local capabilities.",
    ];
  }
  return [
    "Use this tool when its description matches the job more closely than a generic shell command.",
    "Inspect the parameter schema before calling it with non-trivial inputs.",
    "Prefer narrow, purpose-built tools when you want safer and more predictable results.",
  ];
}

function genericToolTips(toolName: string, category: string): string[] {
  const normalizedName = String(toolName || "").toLowerCase();
  const normalizedCategory = String(category || "").toLowerCase();
  if (normalizedName === "as_math") {
    return [
      "Plain expressions like sqrt(2) * pi are supported.",
      "Assignments persist in conversation scope, so reuse variables carefully.",
      "Use mode=list_functions and mode=list_constants for built-in discovery.",
    ];
  }
  if (normalizedName === "as_unit_conversion") {
    return [
      "If units are ambiguous, specify the category explicitly instead of relying on auto mode.",
      "Use list operations first when you are unsure about an alias or supported family.",
      "Currency conversions depend on exchange-rate data availability.",
    ];
  }
  if (normalizedCategory.includes("desktop")) {
    return [
      "For GUI automation, inspect or focus the target first to reduce accidental input.",
      "For process control, verify the right PID or window before terminating or automating.",
    ];
  }
  if (normalizedCategory.includes("web")) {
    return [
      "Choose between request tools and browser-interaction tools based on whether the site is static or dynamic.",
      "Archive or download tools are better when you need durable artifacts, not just extracted text.",
    ];
  }
  if (normalizedName.startsWith("as_git_")) {
    return [
      "Prefer status or diff before a destructive git action so the repository state is explicit.",
      "Use scoped paths instead of broad repo-wide mutations when you only need to touch a subset of files.",
    ];
  }
  if (normalizedName.includes("_file_") || normalizedCategory.includes("file") || normalizedName.startsWith("as_metadata_") || normalizedName.startsWith("as_media_") || normalizedName.startsWith("as_image_") || normalizedName.startsWith("as_mkv_") || normalizedName === "as_code_outline" || normalizedName === "as_pdf_extract_text") {
    return [
      "file_list is a real JSON array of paths; folder_list is a JSON array of folders to enumerate.",
      "file_pattern is a JavaScript regular expression matched against workspace-relative paths and basenames; file_pattern_flags accepts standard RegExp flags such as i.",
      "folder_recursive controls whether folder_list walks subfolders, and file_limit bounds enumerated targets.",
    ];
  }
  return [
    "If a task feels broad, pair this tool with as_tool_catalog or as_tool_help on adjacent tools first.",
  ];
}

function genericToolExamples(toolName: string, category: string): string[] {
  const normalizedName = String(toolName || "").toLowerCase();
  const normalizedCategory = String(category || "").toLowerCase();
  if (normalizedName === "as_math") {
    return [
      "Evaluate sqrt(2) * pi.",
      "Define r = 12 and evaluate 2 * pi * r.",
      "Inspect functions or constants before composing a larger expression.",
    ];
  }
  if (normalizedName === "as_unit_conversion") {
    return [
      "Convert 5 kilometers to miles.",
      "Convert 72 F to C.",
      "List units for a category before converting an uncommon alias.",
    ];
  }
  if (normalizedName === "as_file_copy_move") {
    return [
      "Copy a folder with action=\"copy\", source, destination, and overwrite=false.",
      "Move or rename a file with action=\"move\".",
      "Move every matching file from folder_list into a destination folder with file_pattern and folder_recursive.",
    ];
  }
  if (normalizedName === "as_file_metadata") {
    return [
      "Inspect rich filesystem metadata for a file or directory.",
      "Use detailed=true to merge extra exiftool fields when available.",
      "Pass file_list or folder_list to inspect many targets in one call.",
    ];
  }
  if (normalizedName === "as_file_create") {
    return [
      "Create a directory with action=\"directory\".",
      "Create a text file with action=\"file\" and content.",
      "Append data with action=\"append\" or write binary data with content_base64.",
    ];
  }
  if (normalizedName === "as_file_search") {
    return [
      "Find files by extension, wildcard name, regex, size range, date range, or attributes.",
      "Pass file_list or folder_list when the search should only consider a constructed target set.",
      "Use criteria_json for mixed AND/OR metadata searches.",
      "Search directories too by setting include_directories=true.",
    ];
  }
  if (normalizedName === "as_file_compare") {
    return [
      "Compare two directories by name and size.",
      "Add hash to compare_by when content identity matters.",
      "Use modified_tolerance_ms to avoid timestamp noise.",
    ];
  }
  if (normalizedName.endsWith("_controller")) {
    return [
      "Choose the action first, then provide only the parameters needed for that action.",
      "Call as_tool_help with this controller name when the exact action shape is unclear.",
      "Prefer the controller over older one-off operations from the same family.",
    ];
  }
  if (isToolAliasName(normalizedName)) {
    const alias = findToolAliasDefinition(normalizedName);
    return [
      alias ? `Alias maps to ${alias.controller}${alias.action ? ` with action="${alias.action}"` : ""}.` : "Alias maps to a consolidated controller call.",
      "Only call ax_* aliases when Enable Tool Aliases is on.",
      "If aliases are unavailable, use the general controller call shown in as_tool_help.",
    ];
  }
  if (normalizedName.includes("file_tree")) {
    return [
      "Inspect a workspace folder layout before planning changes.",
      "Get a shallow tree for a specific subdirectory instead of listing every file recursively.",
    ];
  }
  if (normalizedName.includes("file_list")) {
    return [
      "List the contents of a directory with metadata.",
      "Pass folder_list to list several folders in one call.",
      "Check a recursive subtree before running a rename or reorganization pass.",
    ];
  }
  if (normalizedName.includes("file_batch_rename")) {
    return [
      "Preview a regex rename across a folder.",
      "Apply a basename pattern to normalize a media or document collection.",
    ];
  }
  if (normalizedName.includes("file_find_duplicates")) {
    return [
      "Identify duplicate files before cleanup.",
      "Check whether copied assets or exports collapse to the same content hash.",
    ];
  }
  if (normalizedName.includes("serialize") || normalizedName.includes("deserialize")) {
    return [
      "Write structured JSON or YAML from object data.",
      "Read JSON or YAML into structured output before patching or validating it.",
    ];
  }
  if (normalizedName.includes("csv_")) {
    return [
      "Write CSV from a JSON array, then read or query it back.",
      "Sort or filter structured tabular data without manual text parsing.",
    ];
  }
  if (normalizedName.startsWith("as_http_request")) {
    return [
      "Call a JSON API with GET or POST.",
      "Inspect response bodies, headers, and status without opening a browser.",
    ];
  }
  if (normalizedName.startsWith("as_web_search") || normalizedName.startsWith("as_search_")) {
    return [
      "Find candidate sources before visiting or downloading them.",
      "Search a domain-specific knowledge source instead of the whole web when available.",
    ];
  }
  if (normalizedName.startsWith("as_web_archive") || normalizedName.startsWith("as_web_download")) {
    return [
      "Save a page artifact for later inspection.",
      "Download raw page content or a rendered archive instead of only extracting text.",
    ];
  }
  if (normalizedName.startsWith("as_process_") || normalizedName.startsWith("as_kill_process_tree")) {
    return [
      "List, inspect, start, or terminate local processes with verification.",
      "Use tree-aware termination when a target process spawns children or helper processes.",
    ];
  }
  if (normalizedName.startsWith("as_window_")) {
    return [
      "Find the right desktop window before automating input.",
      "Resize, focus, or inspect a target app window during GUI workflows.",
    ];
  }
  if (normalizedName.startsWith("as_input_")) {
    return [
      "Send text, combos, or stepwise sequences to the active app.",
      "Automate a short interaction only after confirming focus and window state.",
    ];
  }
  if (normalizedName.startsWith("as_clipboard_")) {
    return [
      "Read clipboard text, files, or image state before an automation step.",
      "Write clipboard content as a safer handoff than simulated typing.",
    ];
  }
  if (normalizedName.startsWith("as_media_") || normalizedName.startsWith("as_image_") || normalizedName.startsWith("as_mkv_")) {
    return [
      "Probe a media file before deciding how to transform it.",
      "Extract or rewrite metadata, streams, artwork, or container fields with targeted tools.",
    ];
  }
  if (normalizedName.startsWith("as_download_video")) {
    return [
      "Download a single video, playlist item, subtitles, or thumbnails using structured parameters.",
      "Prefer this over generic shell use of yt-dlp when you want safer defaults and clearer outputs.",
    ];
  }
  if (normalizedName.startsWith("as_sqlite_") || normalizedName.startsWith("as_postgres_") || normalizedName.startsWith("as_mysql_")) {
    return [
      "Run a focused read query against a database without building a custom script first.",
      "Inspect schema or rows during debugging, migration planning, or data verification.",
    ];
  }
  if (normalizedName.startsWith("as_deno_") || normalizedName.startsWith("as_python_") || normalizedName.startsWith("as_cpp_")) {
    return [
      "Run language-specific tasks with the plugin's configured runtime fallbacks.",
      "Use specialized execution helpers when you need a quick script instead of a full project scaffold.",
    ];
  }
  if (normalizedName.startsWith("as_git_")) {
    return [
      "Inspect repository state before staging, restoring, or pushing changes.",
      "Use explicit path lists for partial staging or restore flows when you need bounded git mutations.",
      "Pair status, diff, and log with commit or push tools to keep repo actions observable.",
      "Use auth and remote helpers before networked git operations when the environment may be fresh.",
    ];
  }
  if (normalizedName.startsWith("as_agent_task_")) {
    return [
      "Persist multi-step work across turns with explicit statuses, priorities, and output notes.",
      "Use task listing and next-task selection to keep larger agent runs coordinated.",
      "Append outputs as a running work log instead of forcing every detail back into the conversation.",
    ];
  }
  if (normalizedName.startsWith("as_skill_") || normalizedName.startsWith("as_tool_")) {
    return [
      "Scaffold reusable instructions or dynamic tools when a workflow repeats often enough to deserve structure.",
      "Validate the artifact before relying on it from later turns.",
      "Treat these as local capability-building tools, not just one-off file writers.",
    ];
  }
  if (normalizedName.startsWith("as_project_")) {
    return [
      "Run a structured verification pass before or after code changes to catch obvious regressions quickly.",
      "Use bug-scan style tools for a high-signal pass when you need triage before a deeper review.",
      "Pair verification tools with code search or outlines when findings need local follow-up.",
    ];
  }
  if (normalizedCategory.includes("file")) {
    return [
      "Inspect, search, preview, reorganize, or transform workspace files with purpose-built tools.",
    ];
  }
  if (normalizedCategory.includes("web")) {
    return [
      "Choose a web tool based on whether you need search, request/response control, dynamic interaction, or archival output.",
    ];
  }
  return [
    "Use this tool when its shape matches the task more directly than a generic fallback.",
  ];
}

function buildToolSpecificReference(toolDoc: any, detailLevel: string): Record<string, unknown> | null {
  const includeDetailedValues = detailLevel === "standard" || detailLevel === "detailed";
  switch (toolDoc?.name) {
    case "as_math":
      return getMathToolReference(includeDetailedValues);
    case "as_unit_conversion":
      return getUnitConversionToolReference(includeDetailedValues);
    default:
      return null;
  }
}

function actionEnumValuesFromSchema(schema: any): string[] {
  const actionProperty = schema?.properties?.action;
  if (!actionProperty) return [];
  if (Array.isArray(actionProperty.enum)) {
    return actionProperty.enum.map((value: unknown) => String(value));
  }
  if (Array.isArray(actionProperty.anyOf)) {
    return actionProperty.anyOf
      .flatMap((entry: any) => Array.isArray(entry?.enum) ? entry.enum : [])
      .map((value: unknown) => String(value));
  }
  return [];
}

function controllerActionExamples(toolName: string): Record<string, { summary: string; arguments: Record<string, unknown> }> {
  switch (toolName) {
    case "as_file_copy_move":
      return {
        copy: { summary: "Copy a file into an archive folder.", arguments: { action: "copy", source: "notes/today.md", destination: "archive/today.md", overwrite: false } },
        move: { summary: "Rename a draft file in place.", arguments: { action: "move", source: "drafts/spec-v1.md", destination: "drafts/spec-final.md", overwrite: false } },
        batch: { summary: "Move all matching screenshots into one folder.", arguments: { action: "move", folder_list: ["downloads"], file_pattern: "\\.(png|jpe?g)$", file_pattern_flags: "i", folder_recursive: true, destination: "media/screenshots", overwrite: false } },
      };
    case "as_file_create":
      return {
        file: { summary: "Create a new text file with starter content.", arguments: { action: "file", path: "docs/todo.txt", content: "Ship LM Studio regression fixes.\n", overwrite: false, fail_if_exists: true } },
        directory: { summary: "Create a nested folder for reports.", arguments: { action: "directory", path: "reports/daily", fail_if_exists: false } },
        append: { summary: "Append a log line to several matching files.", arguments: { action: "append", file_list: ["logs/a.log", "logs/b.log"], content: "[ok] local verify passed\n" } },
        open: { summary: "Open a file or folder with the platform handler.", arguments: { action: "open", path: "reports/daily" } },
      };
    case "as_file_watch":
      return {
        create: { summary: "Snapshot a directory for later change scans.", arguments: { action: "create", watch_id: "src-watch", directory: "src", recursive: true, include_hidden: false, limit: 5000 } },
        list: { summary: "List saved watcher definitions.", arguments: { action: "list" } },
        scan: { summary: "Scan a watcher and refresh its baseline snapshot.", arguments: { action: "scan", watch_id: "src-watch", refresh_snapshot: true, limit: 5000 } },
        remove: { summary: "Delete a saved watcher definition.", arguments: { action: "remove", watch_id: "src-watch" } },
      };
    case "as_file_organize":
      return {
        plan: { summary: "Create a reorganization plan for a downloads folder.", arguments: { action: "plan", source_directory: "downloads", destination_root: "organized", plan_name: "downloads-cleanup", limit: 500 } },
        list_plans: { summary: "List saved reorganization plans.", arguments: { action: "list_plans" } },
        preview: { summary: "Preview the moves in an existing plan.", arguments: { action: "preview", plan_id: "downloads-cleanup", limit: 200 } },
        apply: { summary: "Apply a previously reviewed plan.", arguments: { action: "apply", plan_id: "downloads-cleanup", overwrite: false, limit: 500 } },
      };
    case "as_memory_controller":
      return {
        list: { summary: "List matching memory entries in the current scope.", arguments: { action: "list", query: "lm studio", tag: "", global: false, limit: 20 } },
        upsert: { summary: "Create or update a durable memory note.", arguments: { action: "upsert", title: "Correct plugin data path", content: "Use ~/.cache/lm-studio/plugin-data/vykosx/agentic-studio.", tags: ["storage", "lm-studio"], global: false } },
        delete: { summary: "Delete one memory entry by id.", arguments: { action: "delete", id: "<memory-id>", global: false } },
        clear: { summary: "Clear matching memory entries from the selected scope.", arguments: { action: "clear", query: "temporary note", global: false, limit: 100 } },
      };
    case "as_todo_controller":
      return {
        list: { summary: "List open todos in the current scope.", arguments: { action: "list", status: "open", global: false } },
        upsert: { summary: "Create or update a todo item.", arguments: { action: "upsert", text: "Run npm run verify after refactor fixes", priority: "high", notes: "Needed before LM Studio testing", status: "open", global: false } },
        delete: { summary: "Delete one todo by id.", arguments: { action: "delete", id: "<todo-id>", global: false } },
        complete: { summary: "Mark a todo as done while preserving its text and notes.", arguments: { action: "complete", id: "<todo-id>", global: false } },
        reopen: { summary: "Reopen a previously completed todo.", arguments: { action: "reopen", id: "<todo-id>", global: false } },
        clear: { summary: "Clear todos from the selected filtered scope.", arguments: { action: "clear", status: "done", global: false } },
      };
    case "as_agent_task":
      return {
        create: { summary: "Create a persistent agent task with metadata.", arguments: { action: "create", title: "Stabilize post-refactor regressions", description: "Fix renamed tools, config UI, and path migration issues.", priority: "critical", status: "open", tags: ["refactor", "bugs"] } },
        get: { summary: "Fetch one task by id.", arguments: { action: "get", id: "<task-id>" } },
        list: { summary: "List tasks filtered by status or query.", arguments: { action: "list", status: "open", query: "refactor", limit: 50 } },
        next: { summary: "Return the highest-priority unfinished task.", arguments: { action: "next" } },
        update: { summary: "Patch an existing task using JSON.", arguments: { action: "update", id: "<task-id>", patch_json: "{\"status\":\"in_progress\",\"assignee\":\"primary-agent\"}" } },
        append_output: { summary: "Append a timestamped execution note to a task.", arguments: { action: "append_output", id: "<task-id>", text: "Migrated misplaced plugin-data directory and rebuilt dist." } },
        delete: { summary: "Delete a task record by id.", arguments: { action: "delete", id: "<task-id>" } },
      };
    case "as_environ_controller":
      return {
        list: { summary: "List environment variables, optionally filtering by name.", arguments: { action: "list", query: "PATH" } },
        get: { summary: "Read one environment variable.", arguments: { action: "get", name: "PATH" } },
        set: { summary: "Set an environment variable for the plugin process.", arguments: { action: "set", name: "MY_FLAG", value: "1" } },
        refresh: { summary: "Refresh process environment state from the host OS.", arguments: { action: "refresh" } },
        path_append: { summary: "Append one path entry to PATH in-process.", arguments: { action: "path_append", value: "C:\\tools\\bin" } },
      };
    case "as_process_controller":
      return {
        list: { summary: "List matching processes.", arguments: { action: "list", query: "node", include_command_line: true, limit: 50 } },
        details: { summary: "Inspect one process by PID.", arguments: { action: "details", pid: 1234 } },
        start: { summary: "Start a process in a chosen working directory.", arguments: { action: "start", command_line: "npm run dev", working_directory: "." } },
        kill: { summary: "Terminate one process by PID.", arguments: { action: "kill", pid: 1234, force: true, kill_related: true } },
        kill_tree: { summary: "Terminate a process and its children.", arguments: { action: "kill_tree", pid: 1234, force: true } },
        wait: { summary: "Wait for a process to exit.", arguments: { action: "wait", pid: 1234, timeout_ms: 60000, poll_interval_ms: 1000 } },
      };
    case "as_service_controller":
      return {
        list: { summary: "List services, optionally filtered by query.", arguments: { action: "list", query: "postgres", limit: 50 } },
        start: { summary: "Start a named service.", arguments: { action: "start", service_name: "postgresql-x64-17" } },
        stop: { summary: "Stop a named service.", arguments: { action: "stop", service_name: "postgresql-x64-17" } },
        restart: { summary: "Restart a named service.", arguments: { action: "restart", service_name: "postgresql-x64-17" } },
      };
    case "as_task_controller":
      return {
        list: { summary: "List scheduled tasks.", arguments: { action: "list", query: "backup", limit: 50 } },
        create: { summary: "Create a daily scheduled task.", arguments: { action: "create", task_name: "DailyBackup", schedule_type: "daily", command_line: "C:\\scripts\\backup.cmd", start_time: "09:00", days_interval: 1 } },
        delete: { summary: "Delete a scheduled task by name.", arguments: { action: "delete", task_name: "DailyBackup" } },
        run: { summary: "Run a scheduled task immediately.", arguments: { action: "run", task_name: "DailyBackup" } },
      };
    case "as_registry_controller":
      return {
        list: { summary: "List values under a Windows registry key.", arguments: { action: "list", key_path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" } },
        get: { summary: "Read one registry value.", arguments: { action: "get", key_path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", value_name: "MyApp" } },
        set: { summary: "Write one registry value.", arguments: { action: "set", key_path: "HKCU\\Software\\MyApp", value_name: "Enabled", value: "1", value_kind: "String" } },
        delete: { summary: "Delete a registry value or key.", arguments: { action: "delete", key_path: "HKCU\\Software\\MyApp", value_name: "Enabled", delete_mode: "value", recursive: false } },
      };
    case "as_window_controller":
      return {
        list: { summary: "List visible windows.", arguments: { action: "list", query: "LM Studio", limit: 25 } },
        foreground: { summary: "Inspect the current foreground window, or focus a target when selectors are provided.", arguments: { action: "foreground" } },
        focus: { summary: "Focus a window by title or process.", arguments: { action: "focus", query: "LM Studio" } },
        close: { summary: "Close a matching window.", arguments: { action: "close", query: "Untitled - Notepad" } },
        minimize: { summary: "Minimize a matching window.", arguments: { action: "minimize", query: "Browser" } },
        maximize: { summary: "Maximize a matching window.", arguments: { action: "maximize", query: "Browser" } },
        get_bounds: { summary: "Read a window's current geometry.", arguments: { action: "get_bounds", query: "LM Studio" } },
        set_bounds: { summary: "Move and resize a matching window.", arguments: { action: "set_bounds", query: "LM Studio", x: 40, y: 40, width: 1400, height: 900 } },
        controls: { summary: "List UI controls inside a target window on Windows. control_name, automation_id, and control_type may each be one string, a comma-separated list string, or a JSON array string for one-call multi-control reads. If this returns none, the app may be custom-drawn and you should switch to as_vision_target.", arguments: { action: "controls", query: "<app title>", automation_id: "[\"CalculatorResults\",\"CalculatorExpression\"]", limit: 10 } },
        invoke_control: { summary: "Invoke a named UI control inside a target window on Windows.", arguments: { action: "invoke_control", query: "<app title>", control_name: "OK" } },
      };
    case "as_clipboard_controller":
      return {
        read: { summary: "Read the clipboard, optionally saving an image to disk on Windows.", arguments: { action: "read", save_image_to_path: "" } },
        write: { summary: "Write text to the clipboard.", arguments: { action: "write", mode: "text", text: "Regression fixes verified." } },
      };
    case "as_input_controller":
      return {
        help: { summary: "Show valid actions, friendly key names, and sequence formats.", arguments: { action: "help" } },
        type: { summary: "Type text into the active window.", arguments: { action: "type", text: "npm run verify", send_enter: true } },
        hotkey: { summary: "Send a keyboard shortcut.", arguments: { action: "hotkey", combo: "ctrl+s" } },
        key_event: { summary: "Send a lower-level key event when SendKeys is unreliable.", arguments: { action: "key_event", key: "enter", key_action: "press", modifiers_json: "[]", repeat_count: 1 } },
        autohotkey_script: { summary: "Run a Windows-only AutoHotkey v2 fallback script for stubborn automation. Runtime errors are returned headlessly, and targeted calls inject AgenticWindow variables plus MouseDown/MouseUp helpers.", arguments: { action: "autohotkey_script", query: "<app title>", script: "AgenticWindowMouseMove(620, 430, 4)\nSleep(100)\nMouseDown(\"Left\")\nSleep(100)\nAgenticWindowMouseMove(700, 430, 8)\nSleep(100)\nMouseUp(\"Left\")", script_timeout_ms: 30000 } },
        sequence: { summary: "Run a structured keyboard sequence.", arguments: { action: "sequence", steps_json: "[{\"action\":\"type\",\"text\":\"hello\"},{\"action\":\"press\",\"key\":\"enter\"}]" } },
        mouse: { summary: "Move or click the mouse at a coordinate, including richer press/down/up actions.", arguments: { action: "mouse", mouse_action: "middle_click", coordinate_space: "window", query: "<app title>", x: 120, y: 240, move_steps: 12, move_duration_ms: 180 } },
        scroll: { summary: "Scroll the active window.", arguments: { action: "scroll", amount: -4, scroll_axis: "vertical" } },
        drag: { summary: "Drag the mouse between two coordinates with smooth motion.", arguments: { action: "drag", coordinate_space: "window", query: "<app title>", from_x: 100, from_y: 100, to_x: 500, to_y: 400, drag_button: "left", move_steps: 30, move_duration_ms: 400 } },
      };
    case "as_git_controller":
      return {
        status: { summary: "Show repository status.", arguments: { action: "status", directory: ".", porcelain: false } },
        diff: { summary: "Show a diff for the working tree or index.", arguments: { action: "diff", directory: ".", staged: false, stat: false, context_lines: 3, pathspec: "src/tools/meta.ts" } },
        log: { summary: "Show recent commits.", arguments: { action: "log", directory: ".", limit: 10 } },
        show: { summary: "Show one revision.", arguments: { action: "show", directory: ".", revision: "HEAD", patch: true, stat: false } },
        init: { summary: "Initialize a repository.", arguments: { action: "init", directory: ".", branch: "main", bare: false } },
        clone: { summary: "Clone a repository into the workspace.", arguments: { action: "clone", repo_url: "https://github.com/example/repo.git", destination: "repo", branch: "main", depth: 1, recurse_submodules: false } },
        add: { summary: "Stage selected paths or everything.", arguments: { action: "add", directory: ".", paths_json: "[\"src/tools/meta.ts\",\"src/config.ts\"]", all: false, update: false, force: false } },
        commit: { summary: "Create a commit.", arguments: { action: "commit", directory: ".", message: "Fix post-refactor regressions", all: false, no_verify: false } },
        branch_list: { summary: "List branches.", arguments: { action: "branch_list", directory: ".", all: true, verbose: true } },
        branch_create: { summary: "Create a branch, optionally checking it out.", arguments: { action: "branch_create", directory: ".", name: "fix/refactor-regressions", start_point: "HEAD", checkout: true, force: false } },
        checkout: { summary: "Checkout a branch or revision.", arguments: { action: "checkout", directory: ".", target: "main", force: false, create_branch: false } },
        restore: { summary: "Restore selected files from a source revision.", arguments: { action: "restore", directory: ".", paths_json: "[\"src/config.ts\"]", source: "HEAD", staged: false, worktree: true } },
        fetch: { summary: "Fetch from a remote.", arguments: { action: "fetch", directory: ".", remote: "origin", all: false, prune: true, tags: false } },
        pull: { summary: "Pull from a remote branch.", arguments: { action: "pull", directory: ".", remote: "origin", branch: "main", rebase: false, ff_only: true } },
        push: { summary: "Push a branch to a remote.", arguments: { action: "push", directory: ".", remote: "origin", branch: "main", set_upstream: false, force_with_lease: false } },
        reset: { summary: "Reset HEAD, with hard reset guarded by confirmation.", arguments: { action: "reset", directory: ".", revision: "HEAD~1", mode: "mixed", confirm_destructive: false } },
        stash_push: { summary: "Create a stash entry.", arguments: { action: "stash_push", directory: ".", message: "wip before repro", include_untracked: true, keep_index: false } },
        stash_list: { summary: "List recent stashes.", arguments: { action: "stash_list", directory: ".", limit: 10 } },
        stash_apply: { summary: "Apply or pop a stash.", arguments: { action: "stash_apply", directory: ".", stash_ref: "stash@{0}", pop: false, restore_index: false } },
        clean: { summary: "Preview or remove untracked files.", arguments: { action: "clean", directory: ".", dry_run: true, include_ignored: false, directories_only: false, confirm_destructive: false } },
        remote_list: { summary: "List git remotes.", arguments: { action: "remote_list", directory: ".", verbose: true } },
        auth_status: { summary: "Check GitHub CLI authentication state.", arguments: { action: "auth_status", hostname: "github.com" } },
        login: { summary: "Authenticate gh with web or a token env var.", arguments: { action: "login", hostname: "github.com", git_protocol: "https", token_env_var: "GITHUB_TOKEN", use_web: false } },
      };
    case "as_dynamic_tool":
      return {
        list: { summary: "List saved Python-backed dynamic tools.", arguments: { action: "list" } },
        scaffold: { summary: "Scaffold a tool from example arguments.", arguments: { action: "scaffold", name: "slugify_text", description: "Convert text to a URL slug.", example_args_json: "{\"text\":\"Hello World\"}", overwrite: false } },
        create: { summary: "Create or replace a tool from explicit schema and code.", arguments: { action: "create", name: "slugify_text", description: "Convert text to a URL slug.", args_schema: "{\"type\":\"object\",\"properties\":{\"text\":{\"type\":\"string\"}},\"required\":[\"text\"]}", python_code: "def run(args):\n    return {\"slug\": args[\"text\"].lower().replace(\" \", \"-\")}\n", overwrite: true } },
        validate: { summary: "Validate stored schema JSON and Python syntax.", arguments: { action: "validate", name: "slugify_text" } },
        call: { summary: "Run a saved dynamic tool with JSON args.", arguments: { action: "call", name: "slugify_text", args_json: "{\"text\":\"Hello World\"}" } },
        delete: { summary: "Delete a saved dynamic tool.", arguments: { action: "delete", name: "slugify_text" } },
      };
    case "as_archive":
      return {
        list: { summary: "List entries inside a zip or tar archive.", arguments: { action: "list", archive_path: "artifacts/build.zip", limit: 200 } },
        extract: { summary: "Extract an archive into a destination folder.", arguments: { action: "extract", archive_path: "artifacts/build.zip", destination: "tmp/unpacked", overwrite: false } },
        compress: { summary: "Compress matching files to zstd outputs.", arguments: { action: "compress", folder_list: ["reports"], file_pattern: "\\.json$", output_path: "reports/compressed", overwrite: true, level: 10 } },
        uncompress: { summary: "Expand a zstd-compressed file.", arguments: { action: "uncompress", path: "reports/full.json.zst", output_path: "reports/full.json", overwrite: true } },
        stream: { summary: "Read a decompressed byte range from a zstd file.", arguments: { action: "stream", path: "reports/full.json.zst", offset_bytes: 0, length_bytes: 4096, encoding: "utf8" } },
      };
    case "as_tabular_data":
      return {
        read: { summary: "Read CSV rows into structured objects.", arguments: { action: "read", path: "data/users.csv", delimiter: ",", has_header: true, limit: 100 } },
        query: { summary: "Filter and sort a CSV file.", arguments: { action: "query", path: "data/users.csv", filters_json: "{\"role\":\"admin\"}", sort_by: "email", descending: false, limit: 50 } },
        write: { summary: "Write rows to a CSV file.", arguments: { action: "write", path: "data/out.csv", rows_json: "[{\"name\":\"Alice\",\"role\":\"admin\"}]", include_header: true, overwrite: true } },
      };
    case "as_structured_data":
      return {
        read: { summary: "Read JSON or YAML into structured output.", arguments: { action: "read", path: "config/settings.json", format: "auto" } },
        write: { summary: "Write JSON or YAML data from a JSON payload.", arguments: { action: "write", path: "config/settings.json", format: "json", data_json: "{\"enabled\":true}", overwrite: true } },
        validate: { summary: "Validate that a JSON or YAML file parses cleanly.", arguments: { action: "validate", path: "config/settings.yaml", format: "auto" } },
        merge_patch: { summary: "Apply a JSON merge patch to an existing JSON file.", arguments: { action: "merge_patch", path: "package.json", patch_json: "{\"scripts\":{\"verify\":\"npm run build && npm run smoke\"}}", create_if_missing: false } },
      };
    case "as_web_extract":
      return {
        visit: { summary: "Fetch a page and return title plus stripped text.", arguments: { action: "visit", url: "https://example.com", timeout_ms: 30000 } },
        images: { summary: "Extract image candidates from a page.", arguments: { action: "images", url: "https://example.com/gallery", limit: 20 } },
        archive: { summary: "Save a rendered page as MHTML, PDF, or HTML.", arguments: { action: "archive", url: "https://example.com", output_path: "captures/example.mhtml", format: "mhtml", wait_until: "networkidle" } },
        firecrawl_scrape: { summary: "Scrape a page through Firecrawl.", arguments: { action: "firecrawl_scrape", url: "https://example.com", formats_json: "[\"markdown\"]", timeout_ms: 120000 } },
        firecrawl_map: { summary: "Map URLs discovered from a root page.", arguments: { action: "firecrawl_map", url: "https://example.com/docs", query: "api" } },
        firecrawl_search: { summary: "Run a Firecrawl search query.", arguments: { action: "firecrawl_search", query: "LM Studio plugins" } },
        firecrawl_crawl: { summary: "Launch and poll a Firecrawl crawl job.", arguments: { action: "firecrawl_crawl", url: "https://example.com/docs", wait_timeout_ms: 300000, poll_interval_ms: 3000 } },
        firecrawl_agent: { summary: "Use Firecrawl's agent workflow with a prompt.", arguments: { action: "firecrawl_agent", url: "https://example.com", prompt: "Extract pricing and feature tiers." } },
        firecrawl_interact: { summary: "Interact with a scraped page using a prompt or code.", arguments: { action: "firecrawl_interact", url: "https://example.com", prompt: "Find the main CTA text." } },
        browser_script: { summary: "Run a bounded Playwright-backed browser script.", arguments: { action: "browser_script", url: "https://example.com", input_json: "{\"selector\":\"h1\"}", script_js: "return { selector: input.selector };", output_directory: "browser-output" } },
      };
    case "as_skill":
      return {
        list: { summary: "List built-in and custom skills.", arguments: { action: "list", query: "planning", limit: 20 } },
        read: { summary: "Read one skill's full content.", arguments: { action: "read", name: "project-planning" } },
        create: { summary: "Create or overwrite a custom skill file.", arguments: { action: "create", name: "release-checklist", content: "# release-checklist\n\nSteps for publishing.\n", overwrite: true } },
        scaffold: { summary: "Create a starter skill template.", arguments: { action: "scaffold", name: "release-checklist", summary: "Guide for release preparation.", overwrite: false } },
        validate: { summary: "Validate a skill's expected structure.", arguments: { action: "validate", name: "release-checklist" } },
        delete: { summary: "Delete a custom skill.", arguments: { action: "delete", name: "release-checklist" } },
      };
    default:
      return {};
  }
}

function buildActionExamples(toolName: string, runtimeSchemaValue: any, detailLevel: string): Array<Record<string, unknown>> {
  const examplesByAction = controllerActionExamples(toolName);
  const actions = actionEnumValuesFromSchema(runtimeSchemaValue);
  if (actions.length === 0 || Object.keys(examplesByAction).length === 0) return [];
  return actions.map((action) => {
    const example = examplesByAction[action];
    return example
      ? {
        action,
        summary: example.summary,
        call: {
          tool: toolName,
          arguments: example.arguments,
        },
      }
      : {
        action,
        summary: "This action is available on the controller.",
      };
  }).filter((entry) => detailLevel === "standard" || detailLevel === "detailed" || "call" in entry);
}

function buildFileSelectionGuidance(runtimeSchemaValue: any, detailLevel: string): string | null {
  const properties = runtimeSchemaValue?.properties || {};
  if (!properties || (!("path" in properties) && !("file_list" in properties) && !("folder_list" in properties))) {
    return null;
  }
  if (detailLevel === "detailed") {
    return "You can pass files with path, file_list, folder_list, or any mix of them in one call. Explicit files from path and file_list are included directly, folder_list is expanded into files dynamically, and file_pattern/file_pattern_flags can further filter the combined target set. folder_recursive controls subfolder enumeration, include_hidden controls hidden-folder traversal during folder expansion, and file_limit bounds the final selection.";
  }
  return "You can pass targets with path, file_list, folder_list, or any mix of them. folder_list is expanded dynamically, then file_pattern can filter the combined target set.";
}

function buildDetailedToolHelp(toolDoc: any, runtimeSchemaValue: any, detailLevel: string): Record<string, unknown> {
  const actionExamples = buildActionExamples(toolDoc.name, runtimeSchemaValue, detailLevel);
  const parameters = schemaParameterSummary(runtimeSchemaValue).map((entry) => ({
    name: entry.name,
    type: entry.type,
    required: entry.required,
    description: entry.description,
    enum: detailLevel === "detailed" ? entry.enum : undefined,
    default: detailLevel === "detailed" ? entry.default : undefined,
  }));
  const purpose = toolDoc.whenToUse || toolDoc.description;
  const fileSelection = buildFileSelectionGuidance(runtimeSchemaValue, detailLevel);
  const compact = {
    tool: {
      name: toolDoc.name,
      description: detailLevel === "detailed" ? toolDoc.description : undefined,
      category: toolDoc.category,
      profile: toolDoc.profile,
    },
    purpose,
    fileSelection: fileSelection || undefined,
    schema: runtimeSchemaValue || undefined,
    parameters: parameters.length > 0 ? parameters : undefined,
    usage: actionExamples.length > 0 ? actionExamples.slice(0, 6) : genericToolExamples(toolDoc.name, toolDoc.category).slice(0, 3),
  };
  if (detailLevel !== "detailed") return compact;
  return {
    ...compact,
    tool: {
      ...compact.tool,
      plugin: toolDoc.plugin,
      availability: toolDoc.availability,
    },
    useCases: genericToolUseCases(toolDoc.name, toolDoc.category).slice(0, 5),
    tips: genericToolTips(toolDoc.name, toolDoc.category).slice(0, 4),
    reference: buildToolSpecificReference(toolDoc, detailLevel),
  };
}

export function registerMetaTools(ctx: ToolModuleContext, tools: any[]): void {
const { tool, z, safeTool, workspaceRoot, discoverToolDocumentation, discoverPluginInventory, filterDisabledOnly, detectEnabledPluginsFromLmStudioState, normalizeToolProfile, currentToolProfile, currentRequestedToolNames, allowIndividualToolRequests, getCurrentConversationIdFromLmStudioState, writeCurrentCavemanState, writeStoredRequestedTools, writeStoredToolProfile, resolveDefaultToolOutputPath, maybeWriteToolOutputToFile, findMatchingTool, normalizeQueryToolList, runtimeToolSchema, writeToFileParameter, compactToolRecord, basicToolRecord, standardToolRecord, summarizeToolNamesByPlugin, findSimilarTools, recommendToolsForGoal, ctl, path, json, rawJson, mergeDefined, effectiveCavemanMode, cavemanState, cavemanControl, configSchematics } = ctx as any;
  const normalizeMetaScope = (scope: string) => scope === "available" ? "enabled" : scope;
  const recommendationDiscoveryProfile = (scope: string, requestedProfile: string) => scope === "own" ? "full" : requestedProfile;
  const profileValues = ["minimal", "file_management", "multimedia", "web", "research", "data", "desktop", "system_admin", "automation", "development", "balanced", "full"] as const;
  const oneOffVsProfileGuidance = allowIndividualToolRequests
    ? "If the user needs one tool from another profile for a one-off task, prefer requesting that individual tool with as_request_tool. If they expect repeated work in that category, tell them they can switch profiles instead."
    : "Switch profiles when the next task needs tools outside the current profile.";

  tools.push(tool({
    name: "as_caveman_status",
    description: "Manage conversation-scoped caveman prompt/result behavior. Use skip_next_tool to bypass caveman formatting for the very next tool result in the current turn, skip_turn to disable caveman for the rest of the current turn immediately after this call, skip_next_turn to disable it for the next turn, default to return to whatever the plugin config is set to, or set persistent conversation override mode with normal, caveman, or caveman_compress.",
    parameters: {
      action: z.enum(["skip_next_tool", "skip_turn", "skip_next_turn", "default", "normal", "caveman", "caveman_compress"]).default("skip_next_tool"),
    },
    implementation: safeTool("as_caveman_status", async ({ action }) => {
      const normalizedAction = String(action || "skip_next_tool");
      let nextState;
      if (normalizedAction === "skip_next_tool") {
        cavemanControl.skipNextToolPending = true;
        nextState = await writeCurrentCavemanState({ skipNextTool: true });
      } else if (normalizedAction === "skip_turn") {
        cavemanControl.skipTurnActive = true;
        nextState = await writeCurrentCavemanState({ skipTurnStage: "active" });
      } else if (normalizedAction === "skip_next_turn") {
        nextState = await writeCurrentCavemanState({ skipTurnStage: "pending" });
      } else if (normalizedAction === "default") {
        cavemanControl.effectiveCavemanMode = ((ctl.getPluginConfig(configSchematics).get("cavemanSkillProfile") as string | undefined) || "normal");
        cavemanControl.skipNextToolPending = false;
        cavemanControl.skipTurnActive = false;
        nextState = await writeCurrentCavemanState({
          modeOverride: null,
          skipNextTool: false,
          skipTurnStage: "idle",
        });
      } else {
        cavemanControl.effectiveCavemanMode = normalizedAction;
        cavemanControl.skipNextToolPending = false;
        cavemanControl.skipTurnActive = false;
        nextState = await writeCurrentCavemanState({
          modeOverride: normalizedAction,
          skipNextTool: false,
          skipTurnStage: "idle",
        });
      }
      return rawJson({
        success: true,
        action: normalizedAction,
        currentProfile: currentToolProfile,
        previousModeOverride: cavemanState.modeOverride,
        modeOverride: nextState.modeOverride,
        effectiveModeNow: cavemanControl.effectiveCavemanMode,
        skipNextToolPending: cavemanControl.skipNextToolPending,
        skipTurnActive: cavemanControl.skipTurnActive,
        skipNextTurnPending: nextState.skipTurnStage === "pending",
        note: normalizedAction === "skip_next_tool"
          ? "The next tool result in the current turn will bypass caveman formatting."
          : normalizedAction === "skip_turn"
            ? "Caveman formatting is disabled for the rest of the current turn. Stop acting as caveman for the remainder of this turn. The prompt already injected for this turn cannot be removed retroactively."
            : normalizedAction === "skip_next_turn"
              ? "Caveman formatting will be disabled for the next turn, including prompt injection and tool-result compaction for that turn."
              : normalizedAction === "default"
                ? "Conversation override cleared. Caveman behavior now follows the plugin config again."
              : normalizedAction === "normal"
                ? "Conversation override now forces normal mode until changed again."
                : normalizedAction === "caveman"
                  ? "Conversation override now forces caveman mode until changed again."
                  : "Conversation override now forces caveman + compression mode until changed again.",
        instruction: normalizedAction === "skip_next_turn"
          ? "Use the next turn to benefit from the skip-next-turn override."
          : normalizedAction === "skip_turn" || normalizedAction === "skip_next_tool"
            ? normalizedAction === "skip_turn"
              ? "Continue the current turn normally, but stop acting as caveman immediately after this tool call. The caveman override is off for the rest of this turn."
              : "Continue the current turn normally; the caveman override takes effect immediately after this tool call."
            : "Persistent mode override saved for this conversation and applies immediately to subsequent tool results.",
      });
    }),
  }));

tools.push(tool({
    name: "as_set_tool_profile",
    description: allowIndividualToolRequests
      ? "Set the agentic-studio tool profile for subsequent turns. Prefer as_request_tool for a one-off tool from another profile, and switch profiles when the user expects ongoing work in that category. After switching, wait until the next turn before using newly enabled tools. Respect default tool parameters unless a task explicitly needs different values."
      : "Set the agentic-studio tool profile for subsequent turns. After switching, wait until the next turn before using newly enabled tools. Respect default tool parameters unless a task explicitly needs different values.",
    parameters: {
      profile: z.enum(profileValues),
    },
    implementation: safeTool("as_set_tool_profile", async ({ profile }) => {
      const nextProfile = normalizeToolProfile(profile);
      const conversationId = await getCurrentConversationIdFromLmStudioState();
      await writeStoredToolProfile(nextProfile, conversationId);
      return json({
        success: true,
        previousProfile: currentToolProfile,
        currentProfile: nextProfile,
        conversationScoped: !!conversationId,
        note: "The new profile should appear on the next turn.",
        nextTurnRequired: true,
        instruction: "Stop after this call. Do not use newly enabled tools until the next turn.",
      });
    }),
  }));

  if (allowIndividualToolRequests) {
    tools.push(tool({
      name: "as_request_tool",
      description: "Enable one or more specific agentic-studio tools for subsequent turns without switching the whole tool profile. Prefer this when the user needs a one-off tool from another profile. If they expect to keep using tools from that category, tell them they can switch profiles instead. After enabling a requested tool, stop the turn and only call that tool on the next turn.",
      parameters: {
        action: z.enum(["enable", "disable", "list", "clear"]).default("enable").describe("Use enable to request individual tools for the next turn, disable to remove named tools, list to inspect the currently requested extra tools, or clear to remove all individually requested tools."),
        tool_name: z.union([z.string(), z.array(z.string())]).default("").describe("One tool name or a list of tool names to enable or disable individually. Prefer individual tool requests for one-off work from another profile."),
      },
      implementation: safeTool("as_request_tool", async ({ action, tool_name }) => {
        const normalizedAction = String(action || "enable");
        const requestedNames = Array.from(new Set(normalizeQueryToolList(tool_name)));
        const enabledPlugins = await detectEnabledPluginsFromLmStudioState();
        const docs = await discoverToolDocumentation(
          "own",
          enabledPlugins,
          "live_only",
          tools,
          currentToolProfile,
          "full",
          currentRequestedToolNames,
          allowIndividualToolRequests,
        );
        const liveToolNames = new Set(
          docs
            .filter((doc) => doc.availability === "live")
            .map((doc) => doc.name),
        );
        if (normalizedAction === "list") {
          return json({
            success: true,
            currentProfile: currentToolProfile,
            individuallyRequestedTools: currentRequestedToolNames,
            note: "These extra tools stay available alongside the current profile for later turns in this conversation scope.",
          });
        }
        const conversationId = await getCurrentConversationIdFromLmStudioState();
        if (normalizedAction === "clear") {
          await writeStoredRequestedTools([], conversationId);
          return json({
            success: true,
            currentProfile: currentToolProfile,
            individuallyRequestedTools: [],
            nextTurnRequired: true,
            instruction: "Stop after this call. The tool list changes on the next turn.",
          });
        }
        if (requestedNames.length === 0) {
          throw new Error("Provide at least one tool name for enable or disable.");
        }
        const matched = requestedNames.map((requestedName) => {
          const matchedTool = findMatchingTool(docs, requestedName);
          if (!matchedTool) {
            return {
              requestedToolName: requestedName,
              success: false,
              error: `No agentic-studio tool matched "${requestedName}".`,
            };
          }
          return {
            requestedToolName: requestedName,
            toolName: matchedTool.name,
            alreadyLive: liveToolNames.has(matchedTool.name),
          };
        });
        const failures = matched.filter((entry) => !entry.success && entry.error);
        if (failures.length > 0) {
          return json({
            success: false,
            currentProfile: currentToolProfile,
            individuallyRequestedTools: currentRequestedToolNames,
            failures,
          });
        }
        const matchedToolNames = matched.map((entry) => entry.toolName);
        const nextRequestedTools = normalizedAction === "disable"
          ? currentRequestedToolNames.filter((name: string) => !matchedToolNames.includes(name))
          : Array.from(new Set([
            ...currentRequestedToolNames,
            ...matchedToolNames.filter((name) => !liveToolNames.has(name)),
          ]));
        await writeStoredRequestedTools(nextRequestedTools, conversationId);
        return json({
          success: true,
          action: normalizedAction,
          currentProfile: currentToolProfile,
          requestedTools: matched.map((entry) => ({
            requestedToolName: entry.requestedToolName,
            toolName: entry.toolName,
            alreadyLive: entry.alreadyLive,
          })),
          individuallyRequestedTools: nextRequestedTools,
          nextTurnRequired: true,
          note: normalizedAction === "disable"
            ? "Removed the named tools from the extra tool set."
            : "Requested tools should appear on the next turn.",
          instruction: normalizedAction === "disable"
            ? "Stop after this call. The tool list changes on the next turn."
            : "Stop after this call. Do not call the newly requested tool until the next turn.",
        });
      }),
    }));
  }

tools.push(tool({
    name: "as_tool_catalog",
    description: "List tools compactly. Names first; query specific tools only when needed. Respect tool defaults unless a task clearly requires non-default parameters.",
    parameters: {
      scope: z.enum(["available", "own", "enabled", "disabled", "all"]).default("available"),
      profile: z.enum(profileValues).optional(),
      category: z.string().default(""),
      query: z.string().default(""),
      detailed: z.boolean().default(false),
      query_tool: z.union([z.string(), z.array(z.string())]).default(""),
      write_to_file: writeToFileParameter,
      limit: z.number().int().min(1).max(5000).default(500),
    },
    implementation: safeTool("as_tool_catalog", async ({ scope, profile, category, query, detailed, query_tool, write_to_file, limit }) => {
      const enabledPlugins = await detectEnabledPluginsFromLmStudioState();
      const requestedProfile = normalizeToolProfile(profile || currentToolProfile);
      const normalizedScope = normalizeMetaScope(scope as string);
      const discoveryProfile = recommendationDiscoveryProfile(normalizedScope, requestedProfile);
      let docs = await discoverToolDocumentation(
        normalizedScope as "own" | "enabled" | "disabled" | "all",
        enabledPlugins,
        normalizedScope === "own" || normalizedScope === "enabled" ? "live_only" : "all_installed",
        tools,
        currentToolProfile,
        discoveryProfile,
        currentRequestedToolNames,
        allowIndividualToolRequests,
      );
      if ((category as string).trim()) {
        const wanted = (category as string).trim().toLowerCase();
        docs = docs.filter((doc) => doc.category.toLowerCase().includes(wanted));
      }
      if ((query as string).trim()) {
        const wanted = (query as string).trim().toLowerCase();
        docs = docs.filter((doc) =>
          doc.name.toLowerCase().includes(wanted)
          || doc.plugin.toLowerCase().includes(wanted)
          || doc.description.toLowerCase().includes(wanted)
          || (doc.whenToUse || "").toLowerCase().includes(wanted));
      }
      const slicedDocs = docs.slice(0, limit as number);
      const slicedTools = slicedDocs.filter((doc) => !isToolAliasName(doc.name));
      const slicedAliases = slicedDocs.filter((doc) => isToolAliasName(doc.name));
      const pluginInventory = await discoverPluginInventory(docs, enabledPlugins);
      const requestedTools = normalizeQueryToolList(query_tool);
      const matchedTools = requestedTools
        .map((item) => findMatchingTool(slicedDocs, item))
        .filter((item): item is ToolDocumentation => !!item);
      const payload = matchedTools.length > 0
        ? {
          scope,
          mode: normalizedScope === "own" ? "own_plugin_only" : normalizedScope,
          currentProfile: currentToolProfile,
          requestedProfile,
          individuallyRequestedTools: currentRequestedToolNames,
          enabledPlugins,
          aliasesEnabled: aliasesEnabled(ctl),
          pluginInventory: detailed ? pluginInventory : undefined,
          queriedTools: requestedTools,
          tools: matchedTools.map((matchedTool) => detailed
            ? {
              ...standardToolRecord(matchedTool, false),
              schema: scope === "own" ? runtimeToolSchema(tools, matchedTool.name) : undefined,
            }
            : basicToolRecord(matchedTool)),
          similarTools: detailed
            ? matchedTools.flatMap((matchedTool) => findSimilarTools(slicedDocs, matchedTool).map((doc) => compactToolRecord(doc))).slice(0, 12)
            : [],
        }
        : {
          scope,
          mode: normalizedScope === "own" ? "own_plugin_only" : normalizedScope,
          currentProfile: currentToolProfile,
          requestedProfile,
          individuallyRequestedTools: currentRequestedToolNames,
          count: slicedDocs.length,
          toolCount: slicedTools.length,
          aliasCount: slicedAliases.length,
          aliasesEnabled: aliasesEnabled(ctl),
          enabledPlugins,
          pluginInventory: detailed ? pluginInventory : undefined,
          tools: detailed
            ? slicedTools.map((doc) => ({
              ...standardToolRecord(doc, false),
              schema: scope === "own" ? runtimeToolSchema(tools, doc.name) : undefined,
            }))
            : slicedTools.map((doc) => doc.name),
          aliases: detailed
            ? slicedAliases.map((doc) => ({
              ...standardToolRecord(doc, false),
              schema: scope === "own" ? runtimeToolSchema(tools, doc.name) : undefined,
              aliasNote: "ax_* aliases require Enable Tool Aliases. Use the matching as_* controller when aliases are unavailable.",
            }))
            : slicedAliases.map((doc) => doc.name),
        };
      const effectiveWritePath = resolveDefaultToolOutputPath(write_to_file as string, "tool-catalog", detailed ? "standard" : "summary");
      const writtenPath = await maybeWriteToolOutputToFile(workspaceRoot, effectiveWritePath, payload);
      const response = mergeDefined({
        scope,
        mode: normalizedScope === "own" ? "own_plugin_only" : normalizedScope,
        detailed,
        currentProfile: currentToolProfile,
        requestedProfile,
        individuallyRequestedTools: currentRequestedToolNames,
        count: slicedDocs.length,
        toolCount: slicedTools.length,
        aliasCount: slicedAliases.length,
        aliasesEnabled: aliasesEnabled(ctl),
        enabledPlugins,
        pluginInventory: detailed ? pluginInventory : undefined,
        note: "Prefer names first. Aliases are listed separately and require Enable Tool Aliases; use as_* controller calls when aliases are unavailable.",
        profileSwitchGuidance: requestedProfile !== currentToolProfile
          ? allowIndividualToolRequests
            ? "Prefer as_request_tool for a one-off tool from another profile. Switch profiles when the user expects ongoing work in that category. If you do switch, stop immediately after switching and wait for the next turn before calling the newly enabled tool."
            : "Switch profile only if needed. If you switch because the next step needs that profile, stop immediately after switching and wait for the next turn before calling the newly enabled tool."
          : undefined,
        writtenToFile: writtenPath || undefined,
        followupHint: writtenPath
          ? "Read the file only if needed."
          : undefined,
        ...(matchedTools.length > 0
          ? {
            queriedTools: requestedTools,
            tools: matchedTools.map((matchedTool) => detailed
              ? {
                ...standardToolRecord(matchedTool, false),
                schema: scope === "own" ? runtimeToolSchema(tools, matchedTool.name) : undefined,
              }
              : basicToolRecord(matchedTool)),
            similarTools: detailed
              ? matchedTools.flatMap((matchedTool) => findSimilarTools(slicedDocs, matchedTool).map((doc) => compactToolRecord(doc))).slice(0, 12)
              : [],
          }
          : {
            tools: detailed
              ? slicedTools.slice(0, Math.min(slicedTools.length, 100)).map((doc) => ({
                ...standardToolRecord(doc, false),
                schema: scope === "own" ? runtimeToolSchema(tools, doc.name) : undefined,
              }))
              : slicedTools.map((doc) => doc.name),
            aliases: detailed
              ? slicedAliases.slice(0, Math.min(slicedAliases.length, 100)).map((doc) => ({
                ...standardToolRecord(doc, false),
                schema: scope === "own" ? runtimeToolSchema(tools, doc.name) : undefined,
                aliasNote: "ax_* aliases require Enable Tool Aliases. Use the matching as_* controller when aliases are unavailable.",
              }))
              : slicedAliases.map((doc) => doc.name),
          }),
      });
      return json(response);
    }),
  }));

tools.push(tool({
    name: "as_tool_help",
    description: "Recommend tools for a goal, or return compact/detailed help for one or more specific tools. Respect tool defaults unless a task clearly requires non-default parameters.",
    parameters: {
      goal: z.string().default(""),
      tool_name: z.union([z.string(), z.array(z.string())]).default(""),
      tool_names: z.array(z.string()).default([]),
      scope: z.enum(["available", "own", "enabled", "disabled", "all"]).default("available"),
      profile: z.enum(profileValues).optional(),
      detail_level: z.enum(["summary", "compact", "standard", "detailed"]).default("compact"),
      write_to_file: writeToFileParameter,
    },
    implementation: safeTool("as_tool_help", async ({ goal, tool_name, tool_names, scope, profile, detail_level, write_to_file }) => {
      const enabledPlugins = await detectEnabledPluginsFromLmStudioState();
      const requestedProfile = normalizeToolProfile(profile || currentToolProfile);
      const normalizedDetailLevel = detail_level === "standard" ? "detailed" : detail_level;
      const normalizedScope = normalizeMetaScope(scope as string);
      const discoveryProfile = recommendationDiscoveryProfile(normalizedScope, requestedProfile);
      const docs = await discoverToolDocumentation(
        normalizedScope as "own" | "enabled" | "disabled" | "all",
        enabledPlugins,
        normalizedScope === "own" || normalizedScope === "enabled" ? "live_only" : "all_installed",
        tools,
        currentToolProfile,
        discoveryProfile,
        currentRequestedToolNames,
        allowIndividualToolRequests,
      );
      const requestedToolNames = Array.from(new Set([
        ...normalizeQueryToolList(tool_name),
        ...normalizeQueryToolList(tool_names),
      ]));
      if (requestedToolNames.length > 0) {
        const toolResults = requestedToolNames.map((requestedName) => {
          const aliasDefinition = findToolAliasDefinition(requestedName as string);
          const matchedTool = findMatchingTool(docs, requestedName) || (aliasDefinition ? findMatchingTool(docs, aliasDefinition.controller) : null);
          if (!matchedTool) {
            if (aliasDefinition) {
              return mergeDefined({
                toolName: aliasDefinition.name,
                requestedToolName: requestedName !== aliasDefinition.name ? requestedName : undefined,
                isAlias: true,
                aliasesEnabled: aliasesEnabled(ctl),
                generalCall: aliasDefinition.generalCall,
                note: "This is an ax_* alias. If aliases are unavailable, call the general as_* controller schema instead.",
              });
            }
            return {
              toolName: requestedName,
              requestedToolName: requestedName,
              success: false,
              error: `No tool matched "${requestedName}".`,
            };
          }
          const schema = scope === "own" ? runtimeToolSchema(tools, matchedTool.name) : null;
          return mergeDefined({
            toolName: aliasDefinition ? aliasDefinition.name : matchedTool.name,
            requestedToolName: aliasDefinition || requestedName !== matchedTool.name ? requestedName : undefined,
            isAlias: aliasDefinition ? true : undefined,
            aliasTarget: aliasDefinition ? aliasDefinition.controller : undefined,
            aliasesEnabled: aliasDefinition ? aliasesEnabled(ctl) : undefined,
            generalCall: aliasDefinition ? aliasDefinition.generalCall : undefined,
            help: buildDetailedToolHelp(matchedTool, schema, normalizedDetailLevel as string),
            similarTools: normalizedDetailLevel === "detailed"
              ? findSimilarTools(docs, matchedTool).map((doc) => compactToolRecord(doc)).slice(0, 8)
              : undefined,
          });
        });
        const payload = {
          requestedToolNames,
          enabledPlugins,
          detailLevel: normalizedDetailLevel,
          currentProfile: currentToolProfile,
          requestedProfile,
          individuallyRequestedTools: currentRequestedToolNames,
          tools: toolResults,
        };
        const effectiveWritePath = resolveDefaultToolOutputPath(write_to_file as string, `${requestedToolNames[0]}-help`, normalizedDetailLevel as string);
        const writtenPath = await maybeWriteToolOutputToFile(workspaceRoot, effectiveWritePath, payload);
        return json(mergeDefined({
          requestedToolNames,
          enabledPlugins,
          detailLevel: normalizedDetailLevel,
          currentProfile: currentToolProfile,
          requestedProfile,
          individuallyRequestedTools: currentRequestedToolNames,
          writtenToFile: writtenPath || undefined,
          followupHint: writtenPath
            ? "Read the exported file only if you need the fuller reference detail."
            : undefined,
          tools: toolResults,
        }));
      }
      const recommendations = recommendToolsForGoal(goal as string, docs);
      const payload = {
        goal,
        enabledPlugins,
        detailLevel: normalizedDetailLevel,
        currentProfile: currentToolProfile,
        requestedProfile,
        individuallyRequestedTools: currentRequestedToolNames,
        note: scope === "own"
          ? allowIndividualToolRequests
            ? "Recommendations include current and hidden agentic-studio tools. Tools marked profile_switch_required can be requested individually with as_request_tool for one-off use, or reached by switching profiles."
            : "Recommendations include current and hidden agentic-studio tools. Tools marked profile_switch_required need a profile change before they become callable."
          : normalizedScope === "enabled"
            ? "Recommendations are limited to tools available now from enabled plugins."
            : "Recommendations consider all installed plugins on disk. Use availability to distinguish enabled/live tools from installed-but-disabled ones.",
        profileSwitchGuidance: requestedProfile !== currentToolProfile
          ? allowIndividualToolRequests
            ? "If a recommended tool is profile_switch_required, prefer as_request_tool for one-off use. If you switch profiles instead, stop immediately and do not call the newly enabled tool until the next turn."
            : "If a recommended tool is profile_switch_required, switch profiles, then stop immediately. Do not continue the response or call the new-profile tool until the next turn."
          : null,
        recommendedWorkflow: (() => {
          const lower = String(goal).toLowerCase();
          if (/\b(downloads|organize|reorganize|cleanup|categorize)\b/.test(lower)) {
            return [
              "Use as_file_organize with action=\"plan\" first.",
              "Review with as_file_organize action=\"preview\".",
              "Inspect duplicates with as_file_find_duplicates if needed.",
              "Apply with as_file_organize action=\"apply\".",
              "Use as_file_restore if you need to restore trashed items.",
            ];
          }
          if (/\b(yaml|json|config)\b/.test(lower)) {
            return [
              "Use as_structured_data to validate, inspect, transform, merge-patch, or serialize JSON/YAML.",
              "Use as_file_patch for targeted text/code edits with preview diffs.",
              "Use as_file_read or as_file_write for generic file reads and full rewrites.",
            ];
          }
          if (/\b(media|video|audio|image|metadata|exif|mkv)\b/.test(lower)) {
            return [
              "Inspect first with as_media_probe, as_file_metadata, or as_image_identify.",
              "Transform with as_media_transform, as_image_convert, or as_mkv_edit.",
            ];
          }
          if (/\b(scrape|crawl|extract|archive|mhtml|download images|website)\b/.test(lower)) {
            return [
              "Use as_web_extract for scrape, crawl, map, archive, browser-script, or Firecrawl-backed extraction actions.",
              "Use as_multi_website_search for site-specific searches such as Wikipedia, Reddit, StackOverflow, YouTube, Hacker News, GitHub, npm, arXiv, MDN, or MSDN/Microsoft Learn.",
              "Use as_web_download for deterministic downloads, share-link normalization, or page download-option discovery.",
            ];
          }
          if (/\b(youtube|playlist|yt-dlp|video download|subtitles|thumbnail|audio track)\b/.test(lower)) {
            return [
              "Use as_download_video for YouTube and other yt-dlp-supported media platforms.",
              "Use structured parameters for playlists, subtitles, thumbnails, metadata, and format preferences.",
              "Use extra_args only for site-specific yt-dlp flags that are not already covered by the structured fields.",
            ];
          }
          if (/\b(postgres|postgresql|mysql|mariadb|database|sql)\b/.test(lower)) {
            return [
              "Use as_database_query with driver=\"sqlite\", \"postgres\", or \"mysql\" for read-only SQL queries.",
              "Prefer connection_ref/environment configuration for server databases rather than putting secrets in prompts.",
            ];
          }
          if (/\b(window|clipboard|keyboard|mouse|desktop|gui)\b/.test(lower)) {
            return [
              "Inspect and focus the target window first with as_window_controller.",
              "Call as_input_controller with action=\"help\" before inventing key names or sequence formats.",
              "Use as_clipboard_controller for data handoff.",
              "Verify after each meaningful input burst or click with a fresh screenshot plus OCR or vision unless the same interaction is already known to work.",
              "Use as_screenshot_capture with source=\"region\" for tight crops when a full-screen screenshot makes a control hard to inspect.",
              "If the normal desktop tools keep failing on Windows, use as_input_controller with action=\"autohotkey_script\" as a last-resort AutoHotkey v2 fallback.",
              "Use as_input_controller and as_window_controller only when file or shell tools cannot accomplish the task safely.",
            ];
          }
          if (/\b(delegate|subagent|review|refactor|research)\b/.test(lower)) {
            return [
              "Use consult_secondary_agent for the bounded subtask.",
              "Enable tools only when the delegated task genuinely needs them.",
              "Use a role like reviewer, coder, organizer, or researcher when appropriate.",
            ];
          }
          return [
            "Use as_tool_catalog if you need the full tool list.",
            ...(allowIndividualToolRequests ? ["Use as_request_tool for a one-off tool from another profile."] : []),
            "Prefer specialized tools over generic shell commands when available.",
          ];
        })(),
        recommendedTools: normalizedDetailLevel === "summary"
          ? recommendations.map((doc) => compactToolRecord(doc))
          : recommendations.map((doc) => standardToolRecord(doc, normalizedDetailLevel === "detailed")),
      };
      const effectiveWritePath = resolveDefaultToolOutputPath(write_to_file as string, "tool-help", normalizedDetailLevel as string);
      const writtenPath = await maybeWriteToolOutputToFile(workspaceRoot, effectiveWritePath, payload);
      return json(mergeDefined({
        goal,
        enabledPlugins,
        detailLevel: normalizedDetailLevel,
        currentProfile: currentToolProfile,
        requestedProfile,
        individuallyRequestedTools: currentRequestedToolNames,
        note: scope === "own"
          ? allowIndividualToolRequests
            ? "Recommendations include current and hidden agentic-studio tools. Tools marked profile_switch_required can be requested individually with as_request_tool for one-off use, or reached by switching profiles."
            : "Recommendations include current and hidden agentic-studio tools. Tools marked profile_switch_required need a profile change before they become callable."
          : normalizedScope === "enabled"
            ? "Recommendations are limited to tools available now from enabled plugins."
            : "Recommendations consider all installed plugins on disk. Use availability to distinguish enabled/live tools from installed-but-disabled ones.",
        profileSwitchGuidance: requestedProfile !== currentToolProfile
          ? allowIndividualToolRequests
            ? "If a recommended tool is profile_switch_required, prefer as_request_tool for one-off use. If you switch profiles instead, stop immediately and do not call the newly enabled tool until the next turn."
            : "If a recommended tool is profile_switch_required, switch profiles, then stop immediately. Do not continue the response or call the new-profile tool until the next turn."
          : undefined,
        writtenToFile: writtenPath || undefined,
        followupHint: writtenPath
          ? "Read the exported file only if you need the richer recommendation detail; otherwise use the compact response here."
          : undefined,
        recommendedWorkflow: payload.recommendedWorkflow,
        recommendedTools: normalizedDetailLevel === "summary"
          ? recommendations.slice(0, Math.min(recommendations.length, 10)).map((doc) => compactToolRecord(doc))
          : recommendations.slice(0, Math.min(recommendations.length, 40)).map((doc) => standardToolRecord(doc, normalizedDetailLevel === "detailed")),
      }));
    }),
  }));
}
