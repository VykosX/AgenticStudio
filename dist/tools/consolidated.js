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
exports.SUPERSEDED_TOOL_NAMES = exports.TOOL_ALIAS_DEFINITIONS = void 0;
exports.aliasesEnabled = aliasesEnabled;
exports.findToolAliasDefinition = findToolAliasDefinition;
exports.isToolAliasName = isToolAliasName;
exports.finalizeConsolidatedToolSurface = finalizeConsolidatedToolSurface;
exports.registerConsolidatedTools = registerConsolidatedTools;
const config_1 = require("../config");
exports.TOOL_ALIAS_DEFINITIONS = [
    { name: "ax_file_copy", controller: "as_file_copy_move", action: "copy", description: "Alias for copying a file or directory.", generalCall: { tool: "as_file_copy_move", arguments: { action: "copy", source: "<path>", destination: "<path>", overwrite: false } } },
    { name: "ax_file_move", controller: "as_file_copy_move", action: "move", description: "Alias for moving or renaming a file or directory.", generalCall: { tool: "as_file_copy_move", arguments: { action: "move", source: "<path>", destination: "<path>", overwrite: false } } },
    { name: "ax_file_mkdir", controller: "as_file_create", action: "directory", description: "Alias for creating a directory.", generalCall: { tool: "as_file_create", arguments: { action: "directory", path: "<path>" } } },
    { name: "ax_file_search", controller: "as_file_search", description: "Alias for recursive file metadata search.", generalCall: { tool: "as_file_search", arguments: { directory: ".", criteria_json: "[...]", join: "and" } } },
    { name: "ax_file_restore", controller: "as_file_restore", description: "Alias for restoring an item from plugin trash.", generalCall: { tool: "as_file_restore", arguments: { trash_name: "<trash entry>", destination: "<path>", overwrite: false } } },
    { name: "ax_memory_list", controller: "as_memory_controller", action: "list", description: "Alias for listing memory.", generalCall: { tool: "as_memory_controller", arguments: { action: "list", query: "", limit: 100 } } },
    { name: "ax_memory_save", controller: "as_memory_controller", action: "upsert", description: "Alias for saving a memory entry.", generalCall: { tool: "as_memory_controller", arguments: { action: "upsert", title: "<title>", content: "<content>", tags: [] } } },
    { name: "ax_todo_list", controller: "as_todo_controller", action: "list", description: "Alias for listing todos.", generalCall: { tool: "as_todo_controller", arguments: { action: "list", status: "all" } } },
    { name: "ax_todo_add", controller: "as_todo_controller", action: "upsert", description: "Alias for adding a todo.", generalCall: { tool: "as_todo_controller", arguments: { action: "upsert", text: "<todo>", priority: "normal" } } },
    { name: "ax_env_get", controller: "as_environ_controller", action: "get", description: "Alias for reading one environment variable.", generalCall: { tool: "as_environ_controller", arguments: { action: "get", name: "<NAME>" } } },
    { name: "ax_env_set", controller: "as_environ_controller", action: "set", description: "Alias for setting one environment variable.", generalCall: { tool: "as_environ_controller", arguments: { action: "set", name: "<NAME>", value: "<value>" } } },
    { name: "ax_process_list", controller: "as_process_controller", action: "list", description: "Alias for listing processes.", generalCall: { tool: "as_process_controller", arguments: { action: "list", query: "", limit: 200 } } },
    { name: "ax_process_kill", controller: "as_process_controller", action: "kill", description: "Alias for terminating a process by PID.", generalCall: { tool: "as_process_controller", arguments: { action: "kill", pid: 1234, force: true } } },
    { name: "ax_clipboard_read", controller: "as_clipboard_controller", action: "read", description: "Alias for reading clipboard text or metadata.", generalCall: { tool: "as_clipboard_controller", arguments: { action: "read" } } },
    { name: "ax_clipboard_write", controller: "as_clipboard_controller", action: "write", description: "Alias for writing clipboard text.", generalCall: { tool: "as_clipboard_controller", arguments: { action: "write", mode: "text", text: "<text>" } } },
    { name: "ax_window_list", controller: "as_window_controller", action: "list", description: "Alias for listing visible windows.", generalCall: { tool: "as_window_controller", arguments: { action: "list", query: "" } } },
    { name: "ax_window_focus", controller: "as_window_controller", action: "focus", description: "Alias for focusing a matching window.", generalCall: { tool: "as_window_controller", arguments: { action: "focus", query: "<title or process>" } } },
    { name: "ax_input_type", controller: "as_input_controller", action: "type", description: "Alias for typing text into the active window.", generalCall: { tool: "as_input_controller", arguments: { action: "type", text: "<text>", send_enter: false } } },
    { name: "ax_input_hotkey", controller: "as_input_controller", action: "hotkey", description: "Alias for sending a keyboard shortcut.", generalCall: { tool: "as_input_controller", arguments: { action: "hotkey", combo: "ctrl+a" } } },
    { name: "ax_task_list", controller: "as_task_controller", action: "list", description: "Alias for listing scheduled tasks.", generalCall: { tool: "as_task_controller", arguments: { action: "list", query: "" } } },
    { name: "ax_service_list", controller: "as_service_controller", action: "list", description: "Alias for listing services.", generalCall: { tool: "as_service_controller", arguments: { action: "list", query: "" } } },
    { name: "ax_registry_get", controller: "as_registry_controller", action: "get", description: "Alias for reading a Windows registry value.", generalCall: { tool: "as_registry_controller", arguments: { action: "get", key_path: "HKCU\\Software", value_name: "<value>" } } },
];
exports.SUPERSEDED_TOOL_NAMES = new Set([
    "as_file_mkdir",
    "as_file_copy",
    "as_file_move",
    "as_file_trash_list",
    "as_file_trash_restore",
    "as_file_watch_create",
    "as_file_watch_list",
    "as_file_watch_scan",
    "as_file_watch_remove",
    "as_file_plan_reorganization",
    "as_file_list_reorganization_plans",
    "as_file_preview_moves",
    "as_file_apply_reorganization",
    "as_file_open",
    "as_memory_list",
    "as_memory_upsert",
    "as_memory_delete",
    "as_todo_list",
    "as_todo_upsert",
    "as_todo_delete",
    "as_env_list",
    "as_env_get",
    "as_env_set",
    "as_env_refresh",
    "as_process_list",
    "as_process_details",
    "as_process_kill",
    "as_kill_process_tree",
    "as_process_start",
    "as_process_wait",
    "as_service_list",
    "as_service_control",
    "as_registry_list",
    "as_registry_get_value",
    "as_registry_set_value",
    "as_registry_delete",
    "as_task_schedule_list",
    "as_task_schedule_create",
    "as_task_schedule_delete",
    "as_task_schedule_run",
    "as_window_list",
    "as_window_focus",
    "as_window_close",
    "as_window_minimize",
    "as_window_get_foreground",
    "as_window_get_bounds",
    "as_window_maximize",
    "as_window_set_bounds",
    "as_clipboard_read",
    "as_clipboard_write",
    "as_input_keyboard",
    "as_input_keyboard_combo",
    "as_input_keyboard_sequence",
    "as_input_mouse",
    "as_input_mouse_scroll",
    "as_input_mouse_drag",
    "as_tool_catalog_disabled",
]);
function aliasesEnabled(ctl) {
    return ctl.getPluginConfig(config_1.configSchematics).get("enableToolAliases") ?? false;
}
function findToolAliasDefinition(name) {
    const normalized = String(name || "").trim().toLowerCase();
    return exports.TOOL_ALIAS_DEFINITIONS.find((entry) => entry.name.toLowerCase() === normalized) || null;
}
function isToolAliasName(name) {
    return String(name || "").startsWith("ax_");
}
function finalizeConsolidatedToolSurface(tools, ctl) {
    const exposeAliases = aliasesEnabled(ctl);
    const seen = new Set();
    const publicTools = [];
    for (const registeredTool of tools) {
        const name = String(registeredTool?.name || "");
        if (!name || seen.has(name))
            continue;
        if (exports.SUPERSEDED_TOOL_NAMES.has(name))
            continue;
        if (!exposeAliases && isToolAliasName(name))
            continue;
        seen.add(name);
        publicTools.push(registeredTool);
    }
    return publicTools;
}
function registerConsolidatedTools(ctx, tools) {
    const { tool, z, safeTool, requireCommandExecution, workspaceRoot, resolveInsideWorkspace, resolveInsideDirectory, workspaceTrashDirectory, reorgPlansDirectory, fileWatchersDirectory, appendOperationLog, batchFileSelectionParameters, readOperationLog, overwriteMove, movePathToWorkspaceTrash, fileExists, collectFiles, describePath, resolveBatchFileTargets, quote, runCommand, powerShellCommand, buildCommandResponse, executeManagedCommand, refreshProcessEnvironmentFromWindowsRegistry, getWatcherDefaultLimit, getDirectoryDeleteConfirmationCount, getFileDeletionMode, getScreenshotDirectorySetting, screenshotsDirectory, escapeForPowerShellSingleQuoted, ctl, env, shell, timeoutMs, maxOutputBytes, process, path, fsp, Buffer, json, normalize, configSchematics, } = ctx;
    const internalToolMap = new Map();
    for (const registeredTool of tools) {
        const name = String(registeredTool?.name || "");
        if (name && !internalToolMap.has(name))
            internalToolMap.set(name, registeredTool);
    }
    const callTool = async (name, args = {}) => {
        const target = internalToolMap.get(name);
        const implementation = target?.implementation;
        if (typeof implementation !== "function") {
            throw new Error(`Internal tool '${name}' is not available.`);
        }
        return await implementation(args);
    };
    const aliasDisabled = (definition) => json({
        success: false,
        aliasDisabled: true,
        alias: definition.name,
        note: "Aliases are off. Use the general controller call.",
        generalCall: definition.generalCall,
    });
    const unsupported = (toolName, supportedPlatforms, message) => json({
        success: false,
        unsupported: true,
        tool: toolName,
        supportedPlatforms,
        message: message || `${toolName} is not supported on ${process.platform}.`,
    });
    const parseJsonArray = (value, fieldName) => {
        const parsed = JSON.parse(String(value || "[]"));
        if (!Array.isArray(parsed))
            throw new Error(`${fieldName} must be a JSON array.`);
        return parsed;
    };
    const fileSelectionParameters = batchFileSelectionParameters(z);
    const hasBatchSelection = (params) => Array.isArray(params.file_list) && params.file_list.length > 0
        || Array.isArray(params.folder_list) && params.folder_list.length > 0
        || String(params.file_pattern || "").trim();
    const commandExists = async (commands) => {
        for (const command of commands) {
            const check = process.platform === "win32" ? `where ${command}` : `command -v ${command}`;
            const result = await runCommand(check, { cwd: workspaceRoot, shell, env }, 10000, 20000);
            if (!result.error && result.exitCode === 0)
                return command;
        }
        return null;
    };
    const desktopSkillReminderFields = {
        recommendedSkillTool: "as_skill_recommend",
        skillInstruction: "Use as_skill_recommend before multi-step desktop work unless the user wants raw tools.",
        verificationReminder: "Try one burst, then verify. If it fails, split and verify more often.",
    };
    const parseJsonObjectMaybe = (value) => {
        if (!value)
            return null;
        if (typeof value === "object" && !Array.isArray(value))
            return value;
        if (typeof value !== "string")
            return null;
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? parsed
                : null;
        }
        catch {
            return null;
        }
    };
    const unwrapNestedToolResult = (value) => {
        const parsed = parseJsonObjectMaybe(value);
        if (!parsed)
            return null;
        const nested = parseJsonObjectMaybe(parsed.result);
        return nested || parsed;
    };
    const withDesktopSkillReminder = (response) => {
        const parsed = parseJsonObjectMaybe(response);
        if (!parsed)
            return response;
        return json({
            ...parsed,
            ...desktopSkillReminderFields,
        });
    };
    const withInputDispatchReminder = (response) => {
        const parsed = parseJsonObjectMaybe(response);
        if (!parsed)
            return response;
        return json({
            ...parsed,
            ...desktopSkillReminderFields,
            successScope: "dispatch_only",
            verificationRequired: true,
        });
    };
    const inputHelpPayload = () => json({
        success: true,
        action: "help",
        actions: {
            type: "Type text.",
            paste_text: "Paste text.",
            press: "Press one named key like escape, enter, delete, multiply, divide, decimal, or ctrl+a.",
            hotkey: "Send a shortcut like ctrl+a or alt+f4.",
            key_event: "Send lower-level key down/up/press.",
            autohotkey_script: "Run an AutoHotkey v2 fallback on Windows.",
            sequence: "Send a short multi-step batch.",
            mouse: "Move or click with left/right/middle, double/triple, and down/up.",
            scroll: "Scroll.",
            drag: "Drag with button choice and timing.",
        },
        mouseActions: [
            "move", "left_click", "right_click", "middle_click", "double_click", "triple_click",
            "left_down", "left_up", "right_down", "right_up", "middle_down", "middle_up",
        ],
        keyNameGroups: {
            basic: ["enter", "escape", "tab", "space", "backspace", "delete"],
            navigation: ["left", "right", "up", "down", "home", "end", "pageup", "pagedown", "insert"],
            modifiers: ["ctrl", "alt", "shift", "win"],
            operators: ["add", "plus", "subtract", "minus", "multiply", "times", "divide", "decimal"],
            patterns: ["num0..num9", "f1..f12"],
        },
        inputGuidance: [
            "Prefer named keys from this help over guessed punctuation when an app expects a real key press.",
            "If a press-like result reports an empty combo or empty key dispatch, treat it as failure and verify immediately.",
            "Try one burst first when the app is likely to accept it.",
            "For hosted Windows apps, prefer window_id.",
        ],
        coordinateGuidance: {
            defaultSpace: "screen",
            windowRelative: "Set coordinate_space='window' with a window selector for window-relative x/y.",
        },
        screenshotGuidance: [
            "Use source='region' for tight visual checks instead of recapturing the whole screen.",
            "For app-local crops, pair source='region' with coordinate_space='window'.",
            "Use include_cursor=true when pointer position matters.",
            "Compare requestedCoordinates, resolvedCoordinates, targetWindowBounds, and windowRelativeCursor before guessing another nearby point.",
        ],
        keyEventSchema: {
            example: { action: "key_event", key: "enter", key_action: "press", modifiers_json: "[]", repeat_count: 1 },
            note: "Use key_action='press', 'down', or 'up'. modifiers_json accepts values like [\"ctrl\",\"shift\"].",
        },
        autoHotkeySchema: {
            example: {
                action: "autohotkey_script",
                script: "AgenticWindowDrag(620, 430, 700, 430)\nSleep(150)\nAgenticWindowClick(742, 510)",
                script_timeout_ms: 30000,
            },
            notes: [
                "Windows-only and v2-only.",
                "Try normal tools first.",
                "Errors come back headlessly in the tool result.",
                "With window targeting, use AgenticWindowMouseMove, AgenticWindowClick, AgenticWindowDrag, MouseDown, and MouseUp.",
            ],
        },
        sequenceSchema: {
            acceptedStepShapes: [
                { text: "hello", delay_ms: 80 },
                { combo: "ctrl+a", delay_ms: 80 },
                { action: "press", key: "enter", delay_ms: 80 },
            ],
            notes: [
                "Steps accept text, combo, key, or press directly. action/type plus value, key, or text also works.",
                "Windows sequences run from temporary scripts, so moderate batches avoid the old command-length limit.",
                "Prefer one short sequence call before many separate tool calls.",
            ],
        },
        verificationReminder: desktopSkillReminderFields.verificationReminder,
    });
    const tryParseFriendlyPressSpec = (value) => {
        const raw = String(value ?? "").trim();
        if (!raw)
            return null;
        if (raw.startsWith("^") || raw.startsWith("%") || raw.startsWith("+") || raw.includes("{")) {
            return null;
        }
        const parts = raw.toLowerCase().replace(/\s+/g, "").split("+").filter(Boolean);
        if (parts.length === 0)
            return null;
        const modifiers = [];
        const keys = [];
        for (const part of parts) {
            if (part === "ctrl" || part === "control")
                modifiers.push("ctrl");
            else if (part === "alt" || part === "option")
                modifiers.push("alt");
            else if (part === "shift")
                modifiers.push("shift");
            else if (part === "win" || part === "leftwin" || part === "rightwin")
                modifiers.push("win");
            else
                keys.push(part);
        }
        if (keys.length !== 1)
            return null;
        return { key: keys[0], modifiers };
    };
    const resolveWindowBoundsForPid = async (pid) => {
        const raw = await callTool("as_window_get_bounds", { pid });
        const wrapper = parseJsonObjectMaybe(raw);
        const bounds = parseJsonObjectMaybe(wrapper?.result);
        if (!wrapper?.success || !bounds) {
            throw new Error("Unable to resolve target window bounds for window-relative input.");
        }
        return {
            x: Number(bounds.x),
            y: Number(bounds.y),
            width: Number(bounds.width),
            height: Number(bounds.height),
        };
    };
    const clampInputDelayMs = (value, fallback = 100) => Math.max(0, Math.min(10000, Math.trunc(Number(value ?? fallback) || 0)));
    const waitInputDelay = async (delayMs) => {
        if (delayMs > 0)
            await new Promise((resolve) => setTimeout(resolve, delayMs));
    };
    const sh = async (command, cwd = workspaceRoot) => executeManagedCommand(ctl, command, { cwd, shell, env }, timeoutMs, maxOutputBytes);
    const mapBaseArgs = (params) => ({
        query: params.query ?? "",
        limit: params.limit ?? 200,
    });
    const normalizeRegistryControllerValue = (value, kind) => {
        const raw = String(value ?? "");
        if (kind === "DWord" || kind === "QWord") {
            const numeric = Number(raw);
            if (!Number.isFinite(numeric)) {
                throw new Error(`value must be numeric when value_kind='${kind}'.`);
            }
            return Math.trunc(numeric);
        }
        if (kind === "MultiString") {
            const trimmed = raw.trim();
            if (!trimmed)
                return [];
            if (trimmed.startsWith("[")) {
                const parsed = JSON.parse(trimmed);
                if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
                    throw new Error("value must be a JSON string array or a newline-delimited string when value_kind='MultiString'.");
                }
                return parsed;
            }
            return raw.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
        }
        if (kind === "Binary") {
            const trimmed = raw.trim();
            if (!trimmed)
                return [];
            if (trimmed.startsWith("[")) {
                const parsed = JSON.parse(trimmed);
                if (!Array.isArray(parsed) || parsed.some((entry) => !Number.isFinite(Number(entry)) || Number(entry) < 0 || Number(entry) > 255)) {
                    throw new Error("value must be a JSON byte array or a hex string when value_kind='Binary'.");
                }
                return parsed.map((entry) => Math.trunc(Number(entry)));
            }
            const hex = trimmed.replace(/^0x/i, "").replace(/[\s,:-]+/g, "");
            if (!hex || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) {
                throw new Error("value must be a JSON byte array or an even-length hex string when value_kind='Binary'.");
            }
            return Array.from({ length: hex.length / 2 }, (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16));
        }
        return raw;
    };
    const resolveWindowTargetForController = async (processId, windowId, query, windowTitle, actionName, limit = 100) => {
        const useAutomationPid = /^(controls|invoke_control|send_message)$/i.test(String(actionName || ""));
        const pickPid = (entry) => {
            const sourcePid = Number(entry?.ProcessId);
            const automationPid = Number(entry?.automationProcessId);
            const preferred = useAutomationPid ? automationPid : sourcePid;
            const fallback = useAutomationPid ? sourcePid : automationPid;
            if (Number.isFinite(preferred) && preferred > 0)
                return Math.trunc(preferred);
            if (Number.isFinite(fallback) && fallback > 0)
                return Math.trunc(fallback);
            return NaN;
        };
        const pickWindowId = (entry) => {
            const candidates = useAutomationPid
                ? [entry?.automationWindowId, entry?.resolvedWindowId, entry?.MainWindowHandle, entry?.SourceMainWindowHandle]
                : [entry?.resolvedWindowId, entry?.MainWindowHandle, entry?.SourceMainWindowHandle, entry?.automationWindowId];
            for (const candidate of candidates) {
                const value = String(candidate || "").trim();
                if (value)
                    return value;
            }
            return "";
        };
        const scoreWindow = (entry, rawSearch) => {
            const search = rawSearch.toLowerCase();
            const title = String(entry?.MainWindowTitle || "").trim().toLowerCase();
            const processName = String(entry?.ProcessName || entry?.automationProcessName || "").trim().toLowerCase();
            const processPath = String(entry?.Path || entry?.automationPath || "").trim().toLowerCase();
            const className = String(entry?.ClassName || entry?.automationClassName || "").trim().toLowerCase();
            const titleWords = title.split(/\s+/).filter(Boolean);
            const documentLikeTitle = titleWords.length >= 3 && /[-:\[\]\(\)]/.test(title);
            let value = 0;
            if (title === search)
                value -= 1000;
            else if (processName === search)
                value -= 900;
            else if (title.startsWith(search))
                value -= 700;
            else if (processName.startsWith(search))
                value -= 620;
            else if (titleWords.includes(search))
                value -= 520;
            else if (title.includes(search))
                value -= 320;
            else if (processName.includes(search))
                value -= 240;
            if (documentLikeTitle && processName !== search && !processName.startsWith(search))
                value += 180;
            if (/^(applicationframehost|shellexperiencehost|textinputhost)$/.test(processName))
                value += 80;
            if (className === "applicationframewindow")
                value += 20;
            if (processPath.startsWith("c:\\windows\\system32\\"))
                value += 25;
            return value;
        };
        if (typeof processId === "number" && Number.isFinite(processId) && processId > 0) {
            return { pid: Math.trunc(processId), windowId: "", entry: null };
        }
        const exactWindowId = String(windowId || "").trim();
        if (exactWindowId) {
            const raw = await callTool("as_window_list", { query: "", limit: 5000 });
            const parsed = JSON.parse(raw);
            const windows = Array.isArray(parsed?.windows) ? parsed.windows : [];
            const exactMatch = windows.find((entry) => String(entry?.WindowId || "").trim() === exactWindowId
                || String(entry?.MainWindowHandle || "").trim() === exactWindowId
                || String(entry?.SourceMainWindowHandle || "").trim() === exactWindowId
                || String(entry?.resolvedWindowId || "").trim() === exactWindowId
                || String(entry?.ProcessId || "").trim() === exactWindowId);
            if (!exactMatch) {
                return { pid: NaN, windowId: exactWindowId, entry: null };
            }
            const pid = pickPid(exactMatch);
            const resolvedWindowId = pickWindowId(exactMatch) || exactWindowId;
            return { pid, windowId: resolvedWindowId, entry: exactMatch };
        }
        const search = String(windowTitle || query || "").trim();
        if (!search) {
            throw new Error(`${actionName} requires process_id, window_id, or a non-empty query/window_title.`);
        }
        const raw = await callTool("as_window_list", { query: search, limit: Math.max(1, Number(limit) || 1) });
        const parsed = JSON.parse(raw);
        const windows = Array.isArray(parsed?.windows) ? parsed.windows : [];
        if (windows.length === 0) {
            throw new Error(`No matching window found for '${search}'.`);
        }
        const preferredWindow = [...windows].sort((left, right) => {
            return scoreWindow(left, search) - scoreWindow(right, search);
        })[0];
        const pid = pickPid(preferredWindow);
        return { pid, windowId: pickWindowId(preferredWindow), entry: preferredWindow };
    };
    const resolveWindowPidForController = async (processId, windowId, query, windowTitle, actionName, limit = 100) => {
        const target = await resolveWindowTargetForController(processId, windowId, query, windowTitle, actionName, limit);
        if (!Number.isFinite(target?.pid) || Number(target.pid) <= 0) {
            if (String(windowId || "").trim()) {
                throw new Error(`Could not resolve a PID for exact window_id '${String(windowId || "").trim()}'.`);
            }
            throw new Error(`Could not resolve a PID for window '${String(windowTitle || query || "").trim()}'.`);
        }
        return Math.trunc(Number(target.pid));
    };
    tools.push(tool({
        name: "as_file_copy_move",
        description: "Copy or move one file, many files, or whole folders with a single action-based operation. Supports file_list, folder_list, file_pattern, and recursive folder enumeration.",
        parameters: {
            action: z.enum(["copy", "move"]).default("copy"),
            source: z.string().default(""),
            destination: z.string(),
            overwrite: z.boolean().default(false),
            ...fileSelectionParameters,
        },
        implementation: safeTool("as_file_copy_move", async (params) => callTool(params.action === "move" ? "as_file_move" : "as_file_copy", params)),
    }));
    tools.push(tool({
        name: "as_file_create",
        description: "Create a file or directory, optionally writing/appending text or binary content, and optionally opening the result.",
        parameters: {
            action: z.enum(["file", "directory", "append", "open"]).default("file"),
            path: z.string().default(""),
            target: z.string().default(""),
            ...fileSelectionParameters,
            content: z.string().default(""),
            content_base64: z.string().default(""),
            encoding: z.string().default("utf8"),
            overwrite: z.boolean().default(false),
            fail_if_exists: z.boolean().default(true),
            open_after_create: z.boolean().default(false),
        },
        implementation: safeTool("as_file_create", async (params) => {
            const { action, path: relPath, target, content, content_base64, encoding, overwrite, fail_if_exists, open_after_create } = params;
            const selectedPath = String(relPath || target || "").trim();
            const targets = await resolveBatchFileTargets({
                workspaceRoot,
                resolvePath: resolveInsideWorkspace,
                primaryPath: selectedPath,
                fileList: params.file_list,
                folderList: action === "directory" ? [] : params.folder_list,
                filePattern: params.file_pattern,
                filePatternFlags: params.file_pattern_flags,
                folderRecursive: params.folder_recursive,
                includeHidden: params.include_hidden,
                fileLimit: params.file_limit,
                mustExist: action === "open",
                requireFiles: action !== "directory",
                includeDirectories: action === "directory" || action === "open",
            });
            if (action === "open") {
                const results = [];
                for (const entry of targets) {
                    results.push({ path: entry.relativePath, result: JSON.parse(await callTool("as_file_open", { target: entry.relativePath })) });
                }
                return json(results.length === 1 ? results[0].result : { count: results.length, results });
            }
            if (action === "directory") {
                const results = [];
                for (const entry of targets) {
                    if (await fileExists(entry.fullPath) && fail_if_exists) {
                        results.push({ path: entry.relativePath, status: "skipped", reason: "Directory already exists." });
                        continue;
                    }
                    await fsp.mkdir(entry.fullPath, { recursive: true });
                    if (open_after_create)
                        await callTool("as_file_open", { target: entry.relativePath });
                    results.push({ success: true, action, path: entry.relativePath });
                }
                return json({ success: true, count: results.length, results });
            }
            const payload = String(content_base64 || "").trim()
                ? Buffer.from(String(content_base64), "base64")
                : Buffer.from(String(content || ""), encoding);
            const results = [];
            for (const entry of targets) {
                const exists = await fileExists(entry.fullPath);
                if (exists && action !== "append" && !overwrite && fail_if_exists) {
                    results.push({ path: entry.relativePath, status: "skipped", reason: "File already exists." });
                    continue;
                }
                await fsp.mkdir(path.dirname(entry.fullPath), { recursive: true });
                if (action === "append") {
                    await fsp.appendFile(entry.fullPath, payload);
                }
                else {
                    await fsp.writeFile(entry.fullPath, payload, { flag: overwrite ? "w" : (fail_if_exists ? "wx" : "w") });
                }
                await appendOperationLog(workspaceRoot, {
                    tool: "as_file_create",
                    action,
                    path: entry.relativePath,
                    bytesWritten: payload.length,
                });
                let openResult = null;
                if (open_after_create)
                    openResult = await callTool("as_file_open", { target: entry.relativePath });
                results.push({ success: true, action, path: entry.relativePath, bytesWritten: payload.length, openResult: openResult ? JSON.parse(openResult) : null });
            }
            return json(results.length === 1 ? results[0] : { success: true, count: results.length, results });
        }),
    }));
    tools.push(tool({
        name: "as_file_restore",
        description: "Restore one or more items from agentic-studio trash to workspace paths.",
        parameters: {
            trash_name: z.string().default(""),
            file_list: z.array(z.string()).default([]),
            destination: z.string().default(""),
            destination_directory: z.string().default(""),
            overwrite: z.boolean().default(false),
        },
        implementation: safeTool("as_file_restore", async (params) => {
            const names = [String(params.trash_name || "").trim(), ...(params.file_list || []).map((entry) => String(entry || "").trim())].filter(Boolean);
            if (names.length === 0)
                throw new Error("trash_name or file_list is required.");
            if (names.length === 1) {
                const destination = String(params.destination || params.destination_directory || "").trim();
                if (!destination)
                    throw new Error("destination is required.");
                return await callTool("as_file_trash_restore", { trash_name: names[0], destination, overwrite: params.overwrite });
            }
            const destinationRoot = String(params.destination_directory || params.destination || "").trim();
            if (!destinationRoot)
                throw new Error("destination_directory or destination is required when restoring multiple items.");
            const results = [];
            for (const trashName of names) {
                const destination = path.join(destinationRoot, trashName);
                results.push({ trashName, result: JSON.parse(await callTool("as_file_trash_restore", { trash_name: trashName, destination, overwrite: params.overwrite })) });
            }
            return json({ success: true, count: results.length, results });
        }),
    }));
    tools.push(tool({
        name: "as_file_watch",
        description: "Create, list, scan, or remove file watcher snapshots with one controller.",
        parameters: {
            action: z.enum(["create", "list", "scan", "remove"]).default("list"),
            watch_id: z.string().default(""),
            directory: z.string().default("."),
            recursive: z.boolean().default(true),
            include_hidden: z.boolean().default(false),
            refresh_snapshot: z.boolean().default(true),
            limit: z.number().int().min(1).max(100000).default(getWatcherDefaultLimit(ctl)),
        },
        implementation: safeTool("as_file_watch", async ({ action, watch_id, directory, recursive, include_hidden, refresh_snapshot, limit }) => {
            if (action === "list")
                return await callTool("as_file_watch_list", {});
            if (!String(watch_id || "").trim())
                throw new Error("watch_id is required for create, scan, and remove.");
            if (action === "create")
                return await callTool("as_file_watch_create", { watch_id, directory, recursive, include_hidden, limit });
            if (action === "scan")
                return await callTool("as_file_watch_scan", { watch_id, refresh_snapshot, limit });
            return await callTool("as_file_watch_remove", { watch_id });
        }),
    }));
    tools.push(tool({
        name: "as_file_organize",
        description: "Plan, list, preview, or apply file reorganization plans with one controller.",
        parameters: {
            action: z.enum(["plan", "list_plans", "preview", "apply"]).default("plan"),
            source_directory: z.string().default("."),
            destination_root: z.string().default("."),
            plan_name: z.string().default(""),
            plan_id: z.string().default(""),
            overwrite: z.boolean().default(false),
            limit: z.number().int().min(1).max(5000).default(500),
        },
        implementation: safeTool("as_file_organize", async ({ action, source_directory, destination_root, plan_name, plan_id, overwrite, limit }) => {
            if (action === "plan")
                return await callTool("as_file_plan_reorganization", { source_directory, destination_root, plan_name, limit });
            if (action === "list_plans")
                return await callTool("as_file_list_reorganization_plans", {});
            if (!String(plan_id || "").trim())
                throw new Error("plan_id is required for preview and apply.");
            if (action === "preview")
                return await callTool("as_file_preview_moves", { plan_id, limit });
            return await callTool("as_file_apply_reorganization", { plan_id, overwrite, limit });
        }),
    }));
    tools.push(tool({
        name: "as_file_search",
        description: "Search files and folders by metadata criteria, attributes, size/date ranges, extensions, wildcard names, regex patterns, and AND/OR grouping.",
        parameters: {
            directory: z.string().default("."),
            file_list: z.array(z.string()).default([]),
            folder_list: z.array(z.string()).default([]),
            file_pattern: z.string().default(""),
            file_pattern_flags: z.string().default(""),
            recursive: z.boolean().default(true),
            include_files: z.boolean().default(true),
            include_directories: z.boolean().default(false),
            include_hidden: z.boolean().default(false),
            extensions: z.array(z.string()).default([]),
            name_patterns: z.array(z.string()).default([]),
            regex_patterns: z.array(z.string()).default([]),
            criteria_json: z.string().default("[]"),
            join: z.enum(["and", "or"]).default("and"),
            size_min_bytes: z.number().int().min(0).optional(),
            size_max_bytes: z.number().int().min(0).optional(),
            modified_after: z.string().default(""),
            modified_before: z.string().default(""),
            created_after: z.string().default(""),
            created_before: z.string().default(""),
            attributes: z.array(z.enum(["file", "directory", "symlink", "hidden", "readable", "writable", "executable"])).default([]),
            file_limit: z.number().int().min(1).max(20000).default(5000),
            limit: z.number().int().min(1).max(20000).default(1000),
        },
        implementation: safeTool("as_file_search", async ({ directory, file_list, folder_list, file_pattern, file_pattern_flags, recursive, include_files, include_directories, include_hidden, extensions, name_patterns, regex_patterns, criteria_json, join, size_min_bytes, size_max_bytes, modified_after, modified_before, created_after, created_before, attributes, file_limit, limit }) => {
            const startDir = resolveInsideWorkspace(workspaceRoot, directory);
            const criteria = parseJsonArray(criteria_json, "criteria_json");
            const addCriterion = (criterion) => criteria.push(criterion);
            for (const extension of extensions)
                addCriterion({ extension });
            for (const pattern of name_patterns)
                addCriterion({ name_pattern: pattern });
            for (const pattern of regex_patterns)
                addCriterion({ name_regex: pattern });
            if (typeof size_min_bytes === "number" || typeof size_max_bytes === "number")
                addCriterion({ size_min: size_min_bytes, size_max: size_max_bytes });
            if (modified_after || modified_before)
                addCriterion({ modified_after, modified_before });
            if (created_after || created_before)
                addCriterion({ created_after, created_before });
            for (const attribute of attributes)
                addCriterion({ attribute });
            const wildcardToRegex = (pattern) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`, "i");
            const time = (value) => {
                const text = String(value || "").trim();
                if (!text)
                    return null;
                const date = new Date(text);
                if (Number.isNaN(date.getTime()))
                    throw new Error(`Invalid date: ${text}`);
                return date.getTime();
            };
            const hasAttribute = (entry, attribute) => {
                if (attribute === "file")
                    return entry.type === "file";
                if (attribute === "directory")
                    return entry.type === "directory";
                if (attribute === "symlink")
                    return entry.type === "symlink";
                if (attribute === "hidden")
                    return path.basename(String(entry.path)).startsWith(".");
                if (attribute === "readable")
                    return Boolean(entry.readable);
                if (attribute === "writable")
                    return Boolean(entry.writable);
                if (attribute === "executable")
                    return Boolean(entry.executable);
                return false;
            };
            const matchCriterion = (entry, criterion) => {
                const rel = String(entry.path || "");
                const base = path.basename(rel);
                const ext = path.extname(base).toLowerCase().replace(/^\./, "");
                const stat = entry.stat;
                if (criterion.type && String(entry.type) !== String(criterion.type))
                    return false;
                if (criterion.attribute && !hasAttribute(entry, String(criterion.attribute)))
                    return false;
                if (criterion.extension) {
                    const wanted = String(criterion.extension).toLowerCase().replace(/^\./, "");
                    if (ext !== wanted)
                        return false;
                }
                if (criterion.name && base !== String(criterion.name))
                    return false;
                if (criterion.name_pattern && !wildcardToRegex(String(criterion.name_pattern)).test(base))
                    return false;
                if (criterion.name_regex && !(new RegExp(String(criterion.name_regex), criterion.case_sensitive ? "" : "i")).test(base))
                    return false;
                if (criterion.path_regex && !(new RegExp(String(criterion.path_regex), criterion.case_sensitive ? "" : "i")).test(rel))
                    return false;
                const minSize = typeof criterion.size_min === "number" ? Number(criterion.size_min) : null;
                const maxSize = typeof criterion.size_max === "number" ? Number(criterion.size_max) : null;
                if (minSize !== null && Number(entry.sizeBytes || 0) < minSize)
                    return false;
                if (maxSize !== null && Number(entry.sizeBytes || 0) > maxSize)
                    return false;
                const mAfter = time(criterion.modified_after);
                const mBefore = time(criterion.modified_before);
                const cAfter = time(criterion.created_after);
                const cBefore = time(criterion.created_before);
                if (mAfter !== null && stat.mtimeMs < mAfter)
                    return false;
                if (mBefore !== null && stat.mtimeMs > mBefore)
                    return false;
                if (cAfter !== null && stat.birthtimeMs < cAfter)
                    return false;
                if (cBefore !== null && stat.birthtimeMs > cBefore)
                    return false;
                return true;
            };
            const results = [];
            const considerFullPath = async (fullPath) => {
                if (results.length >= Number(limit))
                    return;
                const stat = await fsp.lstat(fullPath);
                const type = stat.isDirectory() ? "directory" : stat.isSymbolicLink() ? "symlink" : "file";
                const shouldConsider = (type === "file" && include_files) || (type === "directory" && include_directories) || (type === "symlink" && include_files);
                const rel = path.relative(workspaceRoot, fullPath);
                let readable = false;
                let writable = false;
                let executable = false;
                try {
                    await fsp.access(fullPath, 4);
                    readable = true;
                }
                catch { }
                try {
                    await fsp.access(fullPath, 2);
                    writable = true;
                }
                catch { }
                try {
                    await fsp.access(fullPath, 1);
                    executable = true;
                }
                catch { }
                const candidate = { path: rel, type, sizeBytes: stat.size, modified: stat.mtime.toISOString(), created: stat.birthtime.toISOString(), readable, writable, executable, stat };
                const matches = criteria.length === 0
                    ? true
                    : (join === "or" ? criteria.some((criterion) => matchCriterion(candidate, criterion)) : criteria.every((criterion) => matchCriterion(candidate, criterion)));
                if (shouldConsider && matches) {
                    const { stat: _stat, ...publicEntry } = candidate;
                    results.push(publicEntry);
                }
            };
            const hasExplicitSearchSelection = (Array.isArray(file_list) && file_list.length > 0) || (Array.isArray(folder_list) && folder_list.length > 0);
            if (hasExplicitSearchSelection) {
                const selectedTargets = await resolveBatchFileTargets({
                    workspaceRoot,
                    resolvePath: resolveInsideWorkspace,
                    fileList: file_list,
                    folderList: folder_list,
                    filePattern: file_pattern,
                    filePatternFlags: file_pattern_flags,
                    folderRecursive: recursive,
                    includeHidden: include_hidden,
                    fileLimit: file_limit,
                    requireFiles: false,
                    includeDirectories: include_directories,
                });
                for (const target of selectedTargets) {
                    await considerFullPath(target.fullPath);
                }
            }
            const visit = async (currentDir) => {
                if (results.length >= Number(limit))
                    return;
                const entries = await fsp.readdir(currentDir, { withFileTypes: true });
                for (const dirent of entries) {
                    if (results.length >= Number(limit))
                        break;
                    if (!include_hidden && dirent.name.startsWith("."))
                        continue;
                    const fullPath = path.join(currentDir, dirent.name);
                    const stat = await fsp.lstat(fullPath);
                    await considerFullPath(fullPath);
                    if (recursive && stat.isDirectory())
                        await visit(fullPath);
                }
            };
            if (!hasExplicitSearchSelection)
                await visit(startDir);
            return json({ directory: path.relative(workspaceRoot, startDir) || ".", folderListCount: folder_list.length, recursive, join, criteriaCount: criteria.length, count: results.length, results });
        }),
    }));
    tools.push(tool({
        name: "as_file_compare",
        description: "Compare two file sets by configurable combinations of name, size, modified time, and content hash, returning matching groups.",
        parameters: {
            left_paths_json: z.string().default("[]"),
            right_paths_json: z.string().default("[]"),
            file_list: z.array(z.string()).default([]),
            folder_list: z.array(z.string()).default([]),
            left_file_list: z.array(z.string()).default([]),
            right_file_list: z.array(z.string()).default([]),
            left_folder_list: z.array(z.string()).default([]),
            right_folder_list: z.array(z.string()).default([]),
            file_pattern: z.string().default(""),
            file_pattern_flags: z.string().default(""),
            left_directory: z.string().default(""),
            right_directory: z.string().default(""),
            recursive: z.boolean().default(true),
            compare_by: z.array(z.enum(["name", "size", "modified", "hash"])).default(["name", "size"]),
            hash_algorithm: z.enum(["md5", "sha1", "sha256", "sha512"]).default("sha256"),
            modified_tolerance_ms: z.number().int().min(0).default(0),
            limit: z.number().int().min(1).max(20000).default(5000),
        },
        implementation: safeTool("as_file_compare", async ({ left_paths_json, right_paths_json, file_list, folder_list, left_file_list, right_file_list, left_folder_list, right_folder_list, file_pattern, file_pattern_flags, left_directory, right_directory, recursive, compare_by, hash_algorithm, modified_tolerance_ms, limit }) => {
            const crypto = await Promise.resolve().then(() => __importStar(require("crypto")));
            const gather = async (pathsJson, directory, fileList, folderList) => {
                const files = [];
                const explicitPaths = parseJsonArray(pathsJson, "paths_json").map((entry) => String(entry));
                if (explicitPaths.length > 0 || fileList.length > 0 || folderList.length > 0) {
                    files.push(...(await resolveBatchFileTargets({
                        workspaceRoot,
                        resolvePath: resolveInsideWorkspace,
                        fileList,
                        folderList,
                        legacyList: pathsJson,
                        legacyListName: "paths_json",
                        filePattern: file_pattern,
                        filePatternFlags: file_pattern_flags,
                        folderRecursive: recursive,
                        fileLimit: limit,
                        requireFiles: true,
                    })).map((target) => target.fullPath));
                }
                if (String(directory || "").trim()) {
                    const dirPath = resolveInsideWorkspace(workspaceRoot, directory);
                    if (recursive)
                        files.push(...await collectFiles(dirPath, Number(limit)));
                    else {
                        for (const entry of await fsp.readdir(dirPath, { withFileTypes: true })) {
                            if (entry.isFile())
                                files.push(path.join(dirPath, entry.name));
                        }
                    }
                }
                return [...new Set(files)].slice(0, Number(limit));
            };
            const digestCache = new Map();
            const digest = async (filePath) => {
                if (!digestCache.has(filePath)) {
                    digestCache.set(filePath, crypto.createHash(hash_algorithm).update(await fsp.readFile(filePath)).digest("hex"));
                }
                return digestCache.get(filePath);
            };
            const keyFor = async (filePath) => {
                const stat = await fsp.stat(filePath);
                const parts = [];
                if (compare_by.includes("name"))
                    parts.push(`name=${path.basename(filePath).toLowerCase()}`);
                if (compare_by.includes("size"))
                    parts.push(`size=${stat.size}`);
                if (compare_by.includes("modified")) {
                    const bucket = Number(modified_tolerance_ms) > 0 ? Math.round(stat.mtimeMs / Number(modified_tolerance_ms)) : stat.mtimeMs;
                    parts.push(`modified=${bucket}`);
                }
                if (compare_by.includes("hash"))
                    parts.push(`hash=${await digest(filePath)}`);
                return parts.join("|");
            };
            const leftFiles = await gather(left_paths_json, left_directory, [...file_list, ...left_file_list], [...folder_list, ...left_folder_list]);
            const rightFiles = await gather(right_paths_json, right_directory, right_file_list, right_folder_list);
            const leftByKey = new Map();
            for (const filePath of leftFiles) {
                const key = await keyFor(filePath);
                const entries = leftByKey.get(key) || [];
                entries.push(filePath);
                leftByKey.set(key, entries);
            }
            const matches = [];
            for (const filePath of rightFiles) {
                const key = await keyFor(filePath);
                const leftMatches = leftByKey.get(key) || [];
                if (leftMatches.length === 0)
                    continue;
                matches.push({
                    key,
                    left: leftMatches.map((entry) => path.relative(workspaceRoot, entry)),
                    right: path.relative(workspaceRoot, filePath),
                });
            }
            return json({ compareBy: compare_by, leftCount: leftFiles.length, rightCount: rightFiles.length, matchCount: matches.length, matches: matches.slice(0, Number(limit)) });
        }),
    }));
    tools.push(tool({
        name: "as_environ_controller",
        description: "List, read, set, refresh, or append PATH entries for the plugin process environment.",
        parameters: {
            action: z.enum(["list", "get", "set", "refresh", "path_append"]).default("list"),
            query: z.string().default(""),
            name: z.string().default(""),
            value: z.string().default(""),
        },
        implementation: safeTool("as_environ_controller", async ({ action, query, name, value }) => {
            if (action === "list")
                return await callTool("as_env_list", { query });
            if (action === "get")
                return await callTool("as_env_get", { name });
            if (action === "set")
                return await callTool("as_env_set", { name, value });
            if (action === "path_append") {
                const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") || (process.platform === "win32" ? "Path" : "PATH");
                process.env[pathKey] = `${process.env[pathKey] || ""}${path.delimiter}${String(value)}`;
                return json({ success: true, pathKey, appended: value, path: process.env[pathKey] });
            }
            if (process.platform === "win32")
                return await callTool("as_env_refresh", {});
            requireCommandExecution();
            const result = await sh(`${shell} -lc env`);
            if (result.error || result.exitCode !== 0)
                return buildCommandResponse(`${shell} -lc env`, result);
            const updates = {};
            for (const line of result.stdout.split(/\r?\n/)) {
                const index = line.indexOf("=");
                if (index <= 0)
                    continue;
                const key = line.slice(0, index);
                const nextValue = line.slice(index + 1);
                process.env[key] = nextValue;
                updates[key] = nextValue;
            }
            return json({ success: true, refreshedKeys: Object.keys(updates).sort() });
        }),
    }));
    tools.push(tool({
        name: "as_memory_controller",
        description: "List, upsert, delete, or clear structured memory entries.",
        parameters: {
            action: z.enum(["list", "upsert", "delete", "clear"]).default("list"),
            id: z.string().default(""),
            title: z.string().default(""),
            content: z.string().default(""),
            tags: z.array(z.string()).default([]),
            query: z.string().default(""),
            tag: z.string().default(""),
            global: z.boolean().default(false),
            limit: z.number().int().min(1).max(500).default(100),
        },
        implementation: safeTool("as_memory_controller", async ({ action, id, title, content, tags, query, tag, global, limit }) => {
            if (action === "list")
                return await callTool("as_memory_list", { query, tag, global, limit });
            if (action === "upsert")
                return await callTool("as_memory_upsert", { id, title, content, tags, global });
            if (action === "delete")
                return await callTool("as_memory_delete", { id, global });
            const listed = JSON.parse(await callTool("as_memory_list", { query, tag, global, limit: 500 }));
            const entries = Array.isArray(listed.entries) ? listed.entries : [];
            for (const entry of entries)
                await callTool("as_memory_delete", { id: entry.id, global });
            return json({ success: true, deletedCount: entries.length, scope: global ? "global" : listed.scope });
        }),
    }));
    tools.push(tool({
        name: "as_todo_controller",
        description: "List, upsert, delete, complete, reopen, or clear todo items.",
        parameters: {
            action: z.enum(["list", "upsert", "delete", "complete", "reopen", "clear"]).default("list"),
            id: z.string().default(""),
            text: z.string().default(""),
            priority: z.enum(["low", "normal", "high"]).default("normal"),
            notes: z.string().default(""),
            status: z.enum(["open", "in_progress", "done", "all"]).default("all"),
            global: z.boolean().default(false),
        },
        implementation: safeTool("as_todo_controller", async ({ action, id, text, priority, notes, status, global }) => {
            if (action === "list")
                return await callTool("as_todo_list", { status, global });
            if (action === "upsert")
                return await callTool("as_todo_upsert", { id, text, priority, notes, status: status === "all" ? "open" : status, global });
            if (action === "delete")
                return await callTool("as_todo_delete", { id, global });
            if (action === "complete" || action === "reopen") {
                const listed = JSON.parse(await callTool("as_todo_list", { status: "all", global }));
                const item = (listed.items || []).find((entry) => String(entry.id) === String(id));
                if (!item)
                    throw new Error(`Todo '${id}' was not found.`);
                return await callTool("as_todo_upsert", { id, text: item.text, priority: item.priority || "normal", notes: item.notes || "", status: action === "complete" ? "done" : "open", global });
            }
            const listed = JSON.parse(await callTool("as_todo_list", { status, global }));
            const items = Array.isArray(listed.items) ? listed.items : [];
            for (const item of items)
                await callTool("as_todo_delete", { id: item.id, global });
            return json({ success: true, deletedCount: items.length, scope: global ? "global" : listed.scope });
        }),
    }));
    tools.push(tool({
        name: "as_process_controller",
        description: "List, inspect, start, kill, kill-tree, or wait for processes with one controller.",
        parameters: {
            action: z.enum(["list", "details", "start", "kill", "kill_tree", "wait"]).default("list"),
            query: z.string().default(""),
            include_command_line: z.boolean().default(false),
            pid: z.number().int().min(0).default(0),
            force: z.boolean().default(true),
            kill_related: z.boolean().default(true),
            command_line: z.string().default(""),
            working_directory: z.string().default("."),
            timeout_ms: z.number().int().min(1000).max(3600000).default(60000),
            poll_interval_ms: z.number().int().min(100).max(10000).default(1000),
            limit: z.number().int().min(1).max(5000).default(200),
        },
        implementation: safeTool("as_process_controller", async ({ action, query, include_command_line, pid, force, kill_related, command_line, working_directory, timeout_ms, poll_interval_ms, limit }) => {
            if (action === "list")
                return await callTool("as_process_list", { query, include_command_line, limit });
            if (action === "details")
                return await callTool("as_process_details", { pid });
            if (action === "start")
                return await callTool("as_process_start", { command_line, working_directory });
            if (action === "wait")
                return await callTool("as_process_wait", { pid, timeout_ms, poll_interval_ms });
            if (action === "kill_tree") {
                if (process.platform === "win32")
                    return await callTool("as_kill_process_tree", { pid, force });
                requireCommandExecution();
                const signal = force ? "-KILL" : "-TERM";
                const command = `pkill ${signal} -P ${Number(pid)}; kill ${signal} ${Number(pid)}`;
                const result = await sh(command);
                return buildCommandResponse(command, result);
            }
            return await callTool("as_process_kill", { pid, force, kill_related });
        }),
    }));
    tools.push(tool({
        name: "as_service_controller",
        description: "List, start, stop, or restart services using Windows services, systemd, or launchctl when available.",
        parameters: {
            action: z.enum(["list", "start", "stop", "restart"]).default("list"),
            service_name: z.string().default(""),
            query: z.string().default(""),
            limit: z.number().int().min(1).max(5000).default(200),
        },
        implementation: safeTool("as_service_controller", async ({ action, service_name, query, limit }) => {
            requireCommandExecution();
            if (process.platform === "win32") {
                if (action === "list")
                    return await callTool("as_service_list", { query, limit });
                return await callTool("as_service_control", { service_name, action });
            }
            if (process.platform === "linux") {
                const systemctl = await commandExists(["systemctl"]);
                if (!systemctl)
                    return unsupported("as_service_controller", ["win32", "linux", "darwin"], "systemctl was not found.");
                if (action === "list") {
                    const command = `systemctl list-units --type=service --all --no-pager --plain | ${query ? `grep -i ${quote(String(query))} | ` : ""}head -n ${Number(limit)}`;
                    return buildCommandResponse(command, await sh(command));
                }
                const command = `systemctl ${action} ${quote(String(service_name))}`;
                return buildCommandResponse(command, await sh(command));
            }
            if (process.platform === "darwin") {
                if (action === "list") {
                    const command = `launchctl list | ${query ? `grep -i ${quote(String(query))} | ` : ""}head -n ${Number(limit)}`;
                    return buildCommandResponse(command, await sh(command));
                }
                const verb = action === "restart" ? "kickstart -k" : action;
                const command = `launchctl ${verb} ${quote(String(service_name))}`;
                return buildCommandResponse(command, await sh(command));
            }
            return unsupported("as_service_controller", ["win32", "linux", "darwin"]);
        }),
    }));
    tools.push(tool({
        name: "as_task_controller",
        description: "List, create, delete, or run scheduled OS tasks using Task Scheduler or crontab.",
        parameters: {
            action: z.enum(["list", "create", "delete", "run"]).default("list"),
            task_name: z.string().default(""),
            schedule_type: z.enum(["once", "daily", "onlogon"]).default("daily"),
            command_line: z.string().default(""),
            start_time: z.string().default("09:00"),
            start_date: z.string().default(""),
            days_interval: z.number().int().min(1).max(365).default(1),
            query: z.string().default(""),
            limit: z.number().int().min(1).max(5000).default(200),
        },
        implementation: safeTool("as_task_controller", async ({ action, task_name, schedule_type, command_line, start_time, start_date, days_interval, query, limit }) => {
            if (action === "list")
                return await callTool("as_task_schedule_list", { query, limit });
            if (action === "create")
                return await callTool("as_task_schedule_create", { task_name, schedule_type, command_line, start_time, start_date, days_interval });
            if (action === "delete")
                return await callTool("as_task_schedule_delete", { task_name });
            return await callTool("as_task_schedule_run", { task_name });
        }),
    }));
    tools.push(tool({
        name: "as_registry_controller",
        description: "List, get, set, or delete Windows registry keys and values. Non-Windows hosts return explicit unsupported JSON.",
        parameters: {
            action: z.enum(["list", "get", "set", "delete"]).default("list"),
            key_path: z.string().default(""),
            value_name: z.string().default(""),
            value: z.string().default(""),
            value_kind: z.enum(["String", "ExpandString", "DWord", "QWord", "MultiString", "Binary"]).default("String"),
            delete_mode: z.enum(["value", "key"]).default("value"),
            recursive: z.boolean().default(false),
        },
        implementation: safeTool("as_registry_controller", async ({ action, key_path, value_name, value, value_kind, delete_mode, recursive }) => {
            if (process.platform !== "win32")
                return unsupported("as_registry_controller", ["win32"], "Registry editing is only meaningful on Windows.");
            if (action === "list")
                return await callTool("as_registry_list", { key_path });
            if (action === "get")
                return await callTool("as_registry_get_value", { key_path, value_name });
            if (action === "set") {
                const normalizedValue = normalizeRegistryControllerValue(value, String(value_kind));
                return await callTool("as_registry_set_value", {
                    key_path,
                    value_name,
                    value_type: value_kind,
                    value_json: JSON.stringify(normalizedValue),
                    create_key_if_missing: true,
                });
            }
            return await callTool("as_registry_delete", { key_path, value_name, delete_mode, recursive });
        }),
    }));
    tools.push(tool({
        name: "as_clipboard_controller",
        description: "Read or write clipboard data cross-platform where pbcopy/pbpaste, wl-clipboard, xclip, xsel, or Windows clipboard APIs are available.",
        parameters: {
            action: z.enum(["read", "write"]).default("read"),
            mode: z.enum(["text", "html", "rtf", "files", "image"]).default("text"),
            text: z.string().default(""),
            file_paths_json: z.string().default("[]"),
            image_path: z.string().default(""),
            save_image_to_path: z.string().default(""),
        },
        implementation: safeTool("as_clipboard_controller", async ({ action, mode, text, file_paths_json, image_path, save_image_to_path }) => {
            requireCommandExecution();
            if (process.platform === "win32") {
                return action === "read"
                    ? await callTool("as_clipboard_read", { save_image_to_path })
                    : await callTool("as_clipboard_write", { mode, text, file_paths_json, image_path });
            }
            if (mode !== "text")
                return unsupported("as_clipboard_controller", ["win32", "linux", "darwin"], "Non-text clipboard modes need Windows clipboard APIs in this plugin.");
            if (process.platform === "darwin") {
                const command = action === "read" ? "pbpaste" : `printf %s ${quote(String(text))} | pbcopy`;
                const result = await sh(command);
                return action === "read"
                    ? json({ success: !result.error && result.exitCode === 0, text: result.stdout, stderr: result.stderr, error: result.error })
                    : buildCommandResponse(command, result);
            }
            const reader = await commandExists(["wl-paste", "xclip", "xsel"]);
            const writer = await commandExists(["wl-copy", "xclip", "xsel"]);
            if (action === "read") {
                if (!reader)
                    return unsupported("as_clipboard_controller", ["win32", "linux", "darwin"], "Install wl-clipboard, xclip, or xsel for Linux clipboard reads.");
                const command = reader === "wl-paste" ? "wl-paste" : reader === "xclip" ? "xclip -selection clipboard -o" : "xsel --clipboard --output";
                const result = await sh(command);
                return json({ success: !result.error && result.exitCode === 0, text: result.stdout, stderr: result.stderr, error: result.error });
            }
            if (!writer)
                return unsupported("as_clipboard_controller", ["win32", "linux", "darwin"], "Install wl-clipboard, xclip, or xsel for Linux clipboard writes.");
            const command = writer === "wl-copy" ? `printf %s ${quote(String(text))} | wl-copy` : writer === "xclip" ? `printf %s ${quote(String(text))} | xclip -selection clipboard` : `printf %s ${quote(String(text))} | xsel --clipboard --input`;
            return buildCommandResponse(command, await sh(command));
        }),
    }));
    tools.push(tool({
        name: "as_window_controller",
        description: "List, inspect, focus, close, minimize, maximize, resize, inspect controls inside, invoke controls inside, or send direct Win32 messages to desktop windows using native Windows APIs, AppleScript, wmctrl, xdotool, and Windows accessibility/window APIs where available. action='list' returns ProcessId for the app process and WindowId for the canonical window handle; reuse WindowId as window_id in later window or screenshot calls. action='foreground' inspects the current foreground window when no target is given, or focuses the target window when query/window_id/process_id is supplied. On Windows, action='controls' returns a hybrid control inventory: UI Automation controls plus Win32 child-window controls when present. Each control includes absolute bounds, windowRelativeBounds, centers, and Win32 message hints when applicable. control_name, automation_id, and control_type support comma-separated strings or JSON array strings so one call can fetch multiple known controls compactly. If UIA is missing but Win32 child controls exist, use action='send_message' with the returned nativeWindowHandle or filter selectors before falling back to raw mouse guesses. If controls returns nothing at all, the app may be fully custom-drawn; switch to as_vision_target for coordinate estimates instead of repeating the same query. Use action='invoke_control' only for actionable UIA controls such as buttons, tabs, toggles, or menu items. When you inspect controls first, reuse the same max_depth for invoke_control or send_message or a larger one so the intended target stays in scope. For multi-step desktop automation, call as_skill_recommend first and read the exact matching skill before acting; only skip that when no relevant skill matches or the user explicitly wants raw tool use.",
        parameters: {
            action: z.enum(["list", "foreground", "focus", "close", "minimize", "maximize", "get_bounds", "set_bounds", "controls", "invoke_control", "send_message"]).default("list"),
            query: z.string().default(""),
            process_id: z.number().int().min(0).optional(),
            window_id: z.string().default(""),
            window_title: z.string().default(""),
            control_name: z.string().default(""),
            control_window_id: z.string().default(""),
            automation_id: z.string().default(""),
            control_type: z.string().default(""),
            message: z.string().default(""),
            w_param: z.string().default("0"),
            l_param: z.string().default("0"),
            use_post_message: z.boolean().default(false),
            include_offscreen: z.boolean().default(false),
            max_depth: z.number().int().min(1).max(12).default(8),
            match_index: z.number().int().min(1).max(100).default(1),
            x: z.number().int().default(0),
            y: z.number().int().default(0),
            width: z.number().int().min(1).default(800),
            height: z.number().int().min(1).default(600),
            limit: z.number().int().min(1).max(1000).default(100),
        },
        implementation: safeTool("as_window_controller", async ({ action, query, process_id, window_id, window_title, control_name, control_window_id, automation_id, control_type, message, w_param, l_param, use_post_message, include_offscreen, max_depth, match_index, x, y, width, height, limit }) => {
            requireCommandExecution();
            if (process.platform === "win32") {
                if (action === "list")
                    return withDesktopSkillReminder(await callTool("as_window_list", { query, limit }));
                const hasTargetSelector = typeof process_id === "number" && Number.isFinite(process_id) && process_id > 0
                    || String(window_id || "").trim().length > 0
                    || String(window_title || query || "").trim().length > 0;
                if (action === "foreground" && !hasTargetSelector)
                    return withDesktopSkillReminder(await callTool("as_window_get_foreground", {}));
                const target = await resolveWindowTargetForController(process_id, window_id, query, window_title, String(action), Number(limit));
                const pid = Number(target?.pid);
                if (action === "foreground" || action === "focus") {
                    return withDesktopSkillReminder(await callTool("as_window_focus", {
                        pid: Number.isFinite(pid) && pid > 0 ? Math.trunc(pid) : 0,
                        window_id: String(target?.windowId || window_id || "").trim(),
                    }));
                }
                if (!Number.isFinite(pid) || pid <= 0) {
                    throw new Error(`Could not resolve a PID for ${String(action)}.`);
                }
                if (action === "close")
                    return withDesktopSkillReminder(await callTool("as_window_close", { pid }));
                if (action === "minimize")
                    return withDesktopSkillReminder(await callTool("as_window_minimize", { pid, action: "minimize" }));
                if (action === "maximize")
                    return withDesktopSkillReminder(await callTool("as_window_maximize", { pid }));
                if (action === "get_bounds")
                    return withDesktopSkillReminder(await callTool("as_window_get_bounds", { pid }));
                if (action === "controls")
                    return withDesktopSkillReminder(await callTool("as_window_list_controls", { pid, window_id: String(target?.windowId || window_id || "").trim(), name: control_name, automation_id, control_type, include_offscreen, max_depth, limit }));
                if (action === "invoke_control")
                    return withDesktopSkillReminder(await callTool("as_window_invoke_control", { pid, window_id: String(target?.windowId || window_id || "").trim(), name: control_name, automation_id, control_type, include_offscreen, max_depth, match_index }));
                if (action === "send_message") {
                    const rootWindowId = String(target?.windowId || window_id || "").trim();
                    let exactControlWindowId = String(control_window_id || "").trim();
                    let selectedControl = null;
                    let win32MatchCount = 0;
                    if (!exactControlWindowId) {
                        const inventoryResponse = await callTool("as_window_list_controls", {
                            pid,
                            window_id: rootWindowId,
                            name: control_name,
                            automation_id,
                            control_type,
                            include_offscreen,
                            max_depth,
                            limit: Math.max(Number(limit) || 100, Number(match_index) || 1),
                        });
                        const parsedInventory = parseJsonObjectMaybe(inventoryResponse);
                        const inventoryResult = parsedInventory?.result && typeof parsedInventory.result === "object"
                            ? parsedInventory.result
                            : parsedInventory;
                        const candidateControls = Array.isArray(inventoryResult?.controls) ? inventoryResult.controls : [];
                        const win32Controls = candidateControls.filter((entry) => String(entry?.source || "").toLowerCase() === "win32" && entry?.messageDispatchable !== false);
                        win32MatchCount = win32Controls.length;
                        if (win32Controls.length > 0) {
                            selectedControl = win32Controls[Math.max(0, (Number(match_index) || 1) - 1)] || null;
                            exactControlWindowId = String(selectedControl?.nativeWindowHandle || "").trim();
                        }
                        else if (String(control_name || automation_id || control_type).trim()) {
                            return withDesktopSkillReminder(json({
                                success: false,
                                error: "No matching Win32 child control was found for send_message.",
                                hint: "Call action='controls' first, inspect the returned nativeWindowHandle values and messageHints, then retry send_message against a Win32 child control or switch to invoke_control for UI Automation controls.",
                                inventory: inventoryResult || null,
                            }));
                        }
                    }
                    if (!exactControlWindowId) {
                        exactControlWindowId = rootWindowId;
                    }
                    const response = await callTool("as_window_send_message", {
                        window_id: exactControlWindowId,
                        message,
                        w_param,
                        l_param,
                        use_post_message,
                    });
                    const parsedResponse = parseJsonObjectMaybe(response);
                    const normalizedResult = parsedResponse?.result && typeof parsedResponse.result === "object"
                        ? parsedResponse.result
                        : parsedResponse;
                    return withDesktopSkillReminder(json({
                        ...(parsedResponse || {}),
                        result: normalizedResult
                            ? {
                                ...normalizedResult,
                                rootWindowId,
                                control: selectedControl || normalizedResult.control || undefined,
                                win32MatchCount: win32MatchCount || undefined,
                            }
                            : normalizedResult,
                    }));
                }
                return withDesktopSkillReminder(await callTool("as_window_set_bounds", { pid, x, y, width, height }));
            }
            if (process.platform === "darwin") {
                if (action === "list") {
                    const command = "osascript -e 'tell application \"System Events\" to get name of every process whose background only is false'";
                    return buildCommandResponse(command, await sh(command));
                }
                if (action === "foreground" && !String(window_title || query || "").trim()) {
                    const command = "osascript -e 'tell application \"System Events\" to get name of first application process whose frontmost is true'";
                    return buildCommandResponse(command, await sh(command));
                }
                const app = String(window_title || query).replace(/"/g, "\\\"");
                if (action === "foreground" || action === "focus") {
                    const command = `osascript -e "tell application \\"${app}\\" to activate"`;
                    return buildCommandResponse(command, await sh(command));
                }
                return unsupported("as_window_controller", ["win32", "linux", "darwin"], "This macOS window action needs additional accessibility automation and is not available through the current fallback.");
            }
            const xdotool = await commandExists(["xdotool"]);
            const wmctrl = await commandExists(["wmctrl"]);
            if (action === "list") {
                if (wmctrl) {
                    const command = `wmctrl -lx | ${query ? `grep -i ${quote(String(query))} | ` : ""}head -n ${Number(limit)}`;
                    return buildCommandResponse(command, await sh(command));
                }
                if (xdotool) {
                    const command = `xdotool search --onlyvisible --name ${quote(String(query || "."))} getwindowname %@`;
                    return buildCommandResponse(command, await sh(command));
                }
            }
            if (!xdotool)
                return unsupported("as_window_controller", ["win32", "linux", "darwin"], "Install xdotool or wmctrl for Linux window control.");
            const selector = process_id
                ? `$(xdotool search --pid ${Number(process_id)} | head -n 1)`
                : `$(xdotool search --onlyvisible --name ${quote(String(window_title || query || "."))} | head -n 1)`;
            if (action === "foreground" && !process_id && !String(window_title || query || "").trim())
                return buildCommandResponse("xdotool getactivewindow getwindowname", await sh("xdotool getactivewindow getwindowname"));
            if (action === "foreground" || action === "focus")
                return buildCommandResponse(`xdotool windowactivate ${selector}`, await sh(`xdotool windowactivate ${selector}`));
            if (action === "close")
                return buildCommandResponse(`xdotool windowclose ${selector}`, await sh(`xdotool windowclose ${selector}`));
            if (action === "minimize")
                return buildCommandResponse(`xdotool windowminimize ${selector}`, await sh(`xdotool windowminimize ${selector}`));
            if (action === "maximize")
                return buildCommandResponse(`wmctrl -ir ${selector} -b add,maximized_vert,maximized_horz`, await sh(`wmctrl -ir ${selector} -b add,maximized_vert,maximized_horz`));
            if (action === "get_bounds")
                return buildCommandResponse(`xdotool getwindowgeometry --shell ${selector}`, await sh(`xdotool getwindowgeometry --shell ${selector}`));
            const command = `xdotool windowmove ${selector} ${Number(x)} ${Number(y)} windowsize ${selector} ${Number(width)} ${Number(height)}`;
            return buildCommandResponse(command, await sh(command));
        }),
    }));
    tools.push(tool({
        name: "as_input_controller",
        description: "Send keyboard and mouse input using Windows SendKeys/User32, AppleScript/cliclick, or xdotool when available. Call action='help' for the valid action set, accepted friendly key names, richer mouse actions, lower-level key-event fallback, AutoHotkey v2 fallback, and sequence shapes before inventing key names. Use action='press' or action='hotkey' for keys like enter/delete/escape/multiply/divide/ctrl+a, action='key_event' when SendKeys is unreliable and you need explicit down/up/press semantics, action='autohotkey_script' as a Windows-only last resort for stubborn or unusually complex automation, action='type' for literal text, and action='paste_text' for exact clipboard-backed text entry. When action='paste_text', providing text replaces the clipboard first; leaving text empty pastes the current clipboard contents. On Windows, targeted input re-foregrounds the chosen window immediately before dispatch. Mouse and drag actions use absolute screen coordinates by default; set coordinate_space='window' to interpret coordinates relative to the target window instead. Mouse and drag results include requestedCoordinates, resolvedCoordinates, targetWindowBounds, and windowRelativeCursor so you can compare where the pointer actually landed before choosing the next action. `lock_user_input=true` is a last resort only: it temporarily blocks user input during the dispatch and is automatically released in a finally/unwind path. Set delay_ms to let the target app process input before the tool returns. For multi-step desktop automation, call as_skill_recommend first and read the exact matching skill before acting; only skip that when no relevant skill matches or the user explicitly wants raw tool use. A successful input dispatch does not prove the app accepted it, so verify with a fresh screenshot plus OCR or vision before claiming success.",
        parameters: {
            action: z.enum(["help", "type", "paste_text", "hotkey", "press", "key_event", "autohotkey_script", "sequence", "mouse", "scroll", "drag"]).default("type"),
            text: z.string().default(""),
            combo: z.string().default(""),
            key: z.string().default(""),
            script: z.string().default(""),
            script_args_json: z.string().default("[]"),
            script_timeout_ms: z.number().int().min(1000).max(600000).default(60000),
            key_action: z.enum(["press", "down", "up"]).default("press"),
            modifiers_json: z.string().default("[]"),
            repeat_count: z.number().int().min(1).max(100).default(1),
            process_id: z.number().int().min(0).optional(),
            window_id: z.string().default(""),
            window_title: z.string().default(""),
            query: z.string().default(""),
            lock_user_input: z.boolean().default(false),
            steps_json: z.string().default("[]"),
            mouse_action: z.enum(["move", "left_click", "right_click", "middle_click", "double_click", "triple_click", "left_down", "left_up", "right_down", "right_up", "middle_down", "middle_up"]).default("move"),
            coordinate_space: z.enum(["screen", "window"]).default("screen"),
            x: z.number().int().default(0),
            y: z.number().int().default(0),
            move_steps: z.number().int().min(1).max(500).default(12),
            move_duration_ms: z.number().int().min(0).max(60000).default(120),
            from_x: z.number().int().default(0),
            from_y: z.number().int().default(0),
            to_x: z.number().int().default(0),
            to_y: z.number().int().default(0),
            drag_button: z.enum(["left", "right", "middle"]).default("left"),
            hold_before_drag_ms: z.number().int().min(0).max(10000).default(40),
            hold_after_drag_ms: z.number().int().min(0).max(10000).default(40),
            amount: z.number().int().min(-1000).max(1000).default(0),
            scroll_axis: z.enum(["vertical", "horizontal"]).default("vertical"),
            send_enter: z.boolean().default(false),
            delay_ms: z.number().int().min(0).max(10000).default(100),
        },
        implementation: safeTool("as_input_controller", async ({ action, text, combo, key, script, script_args_json, script_timeout_ms, key_action, modifiers_json, repeat_count, process_id, window_id, window_title, query, lock_user_input, steps_json, mouse_action, coordinate_space, x, y, move_steps, move_duration_ms, from_x, from_y, to_x, to_y, drag_button, hold_before_drag_ms, hold_after_drag_ms, amount, scroll_axis, send_enter, delay_ms }) => {
            if (action === "help")
                return inputHelpPayload();
            requireCommandExecution();
            const delay = clampInputDelayMs(delay_ms);
            const requestedWindowId = String(window_id || "").trim();
            const requestedSearch = String(window_title || query || "").trim();
            const targetPid = typeof process_id === "number" && Number.isFinite(process_id)
                ? Math.trunc(process_id)
                : (requestedSearch
                    ? await resolveWindowPidForController(process_id, window_id, query, window_title, "input dispatch", 100)
                    : 0);
            const targetArgs = {
                pid: targetPid,
                window_id: requestedWindowId,
                lock_user_input,
            };
            const useWindowCoordinates = coordinate_space === "window" && (action === "mouse" || action === "drag");
            let resolvedPoint = { x: Number(x), y: Number(y) };
            let resolvedDrag = { from_x: Number(from_x), from_y: Number(from_y), to_x: Number(to_x), to_y: Number(to_y) };
            let targetWindowBounds = null;
            if (useWindowCoordinates) {
                if (process.platform !== "win32") {
                    throw new Error("coordinate_space='window' is currently supported on Windows only.");
                }
                if (!(targetPid > 0)) {
                    if (requestedWindowId) {
                        const resolvedWindowTarget = await resolveWindowTargetForController(process_id, window_id, query, window_title, "input dispatch", 100);
                        if (Number.isFinite(resolvedWindowTarget?.pid) && Number(resolvedWindowTarget.pid) > 0) {
                            targetArgs.pid = Math.trunc(Number(resolvedWindowTarget.pid));
                        }
                    }
                }
                if (!(targetArgs.pid > 0)) {
                    throw new Error("coordinate_space='window' requires a resolvable target window via process_id, window_id, query, or window_title.");
                }
                const bounds = await resolveWindowBoundsForPid(targetArgs.pid);
                targetWindowBounds = bounds;
                resolvedPoint = { x: bounds.x + Number(x), y: bounds.y + Number(y) };
                resolvedDrag = {
                    from_x: bounds.x + Number(from_x),
                    from_y: bounds.y + Number(from_y),
                    to_x: bounds.x + Number(to_x),
                    to_y: bounds.y + Number(to_y),
                };
            }
            if (process.platform === "win32") {
                if (action === "type")
                    return withInputDispatchReminder(await callTool("as_input_keyboard", { text, send_enter, delay_ms: delay, ...targetArgs }));
                if (action === "paste_text") {
                    const copied = String(text).length > 0
                        ? await callTool("as_clipboard_write", { mode: "text", text })
                        : null;
                    const pasted = await callTool("as_input_key_event", {
                        key: "v",
                        modifiers_json: JSON.stringify(["ctrl"]),
                        key_action: "press",
                        repeat_count: 1,
                        delay_ms: delay,
                        ...targetArgs,
                    });
                    const copiedPayload = parseJsonObjectMaybe(copied);
                    const pastedPayload = parseJsonObjectMaybe(pasted);
                    return withInputDispatchReminder(json({
                        success: (copiedPayload ? Boolean(copiedPayload.success) : true) && Boolean(pastedPayload?.success),
                        clipboard: copiedPayload || copied,
                        input: pastedPayload || pasted,
                        usedExistingClipboard: String(text).length === 0,
                        delayMs: delay,
                    }));
                }
                if (action === "hotkey") {
                    const hotkeyValue = String(combo || key || text || "").trim();
                    if (!hotkeyValue) {
                        throw new Error("action='hotkey' requires combo, key, or text.");
                    }
                    const parsedHotkey = tryParseFriendlyPressSpec(hotkeyValue);
                    if (parsedHotkey) {
                        return withInputDispatchReminder(await callTool("as_input_key_event", {
                            key: parsedHotkey.key,
                            modifiers_json: JSON.stringify(parsedHotkey.modifiers),
                            key_action: "press",
                            repeat_count,
                            delay_ms: delay,
                            ...targetArgs,
                        }));
                    }
                    return withInputDispatchReminder(await callTool("as_input_keyboard_combo", { combo: hotkeyValue, delay_ms: delay, ...targetArgs }));
                }
                if (action === "press") {
                    const pressValue = String(key || combo || text || "").trim();
                    if (!pressValue) {
                        throw new Error("action='press' requires key, combo, or text.");
                    }
                    const parsedPress = tryParseFriendlyPressSpec(pressValue);
                    if (parsedPress) {
                        return withInputDispatchReminder(await callTool("as_input_key_event", {
                            key: parsedPress.key,
                            modifiers_json: JSON.stringify(parsedPress.modifiers),
                            key_action: "press",
                            repeat_count,
                            delay_ms: delay,
                            ...targetArgs,
                        }));
                    }
                    return withInputDispatchReminder(await callTool("as_input_keyboard_combo", { combo: pressValue, delay_ms: delay, ...targetArgs }));
                }
                if (action === "key_event")
                    return withInputDispatchReminder(await callTool("as_input_key_event", { key: key || combo || text, key_action, modifiers_json, repeat_count, delay_ms: delay, ...targetArgs }));
                if (action === "autohotkey_script")
                    return withInputDispatchReminder(await callTool("as_input_autohotkey", { script: script || text, args_json: script_args_json, timeout_ms: script_timeout_ms, pid: targetArgs.pid, window_id: targetArgs.window_id }));
                if (action === "sequence")
                    return withInputDispatchReminder(await callTool("as_input_keyboard_sequence", { steps_json, delay_ms: delay, ...targetArgs }));
                if (action === "mouse") {
                    const response = await callTool("as_input_mouse", { action: mouse_action, x: resolvedPoint.x, y: resolvedPoint.y, move_steps, move_duration_ms, delay_ms: delay, ...targetArgs });
                    const parsed = unwrapNestedToolResult(response);
                    return withInputDispatchReminder(json({
                        ...(parseJsonObjectMaybe(response) || {}),
                        coordinateSpace: coordinate_space,
                        requestedCoordinates: { x: Number(x), y: Number(y) },
                        resolvedCoordinates: { x: resolvedPoint.x, y: resolvedPoint.y },
                        targetWindowBounds,
                        result: parsed || parseJsonObjectMaybe(response)?.result || null,
                    }));
                }
                if (action === "scroll")
                    return withInputDispatchReminder(await callTool("as_input_mouse_scroll", { amount, axis: scroll_axis, delay_ms: delay, ...targetArgs }));
                if (action === "drag") {
                    const response = await callTool("as_input_mouse_drag", { from_x: resolvedDrag.from_x, from_y: resolvedDrag.from_y, to_x: resolvedDrag.to_x, to_y: resolvedDrag.to_y, button: drag_button, move_steps, move_duration_ms, hold_before_drag_ms, hold_after_drag_ms, delay_ms: delay, ...targetArgs });
                    const parsed = unwrapNestedToolResult(response);
                    return withInputDispatchReminder(json({
                        ...(parseJsonObjectMaybe(response) || {}),
                        coordinateSpace: coordinate_space,
                        requestedCoordinates: { from_x: Number(from_x), from_y: Number(from_y), to_x: Number(to_x), to_y: Number(to_y) },
                        resolvedCoordinates: resolvedDrag,
                        targetWindowBounds,
                        result: parsed || parseJsonObjectMaybe(response)?.result || null,
                    }));
                }
                return withInputDispatchReminder(await callTool("as_input_mouse_drag", { from_x, from_y, to_x, to_y, button: drag_button, move_steps, move_duration_ms, hold_before_drag_ms, hold_after_drag_ms, delay_ms: delay, ...targetArgs }));
            }
            if (process.platform === "darwin") {
                if (action === "autohotkey_script") {
                    return unsupported("as_input_controller", ["win32"], "AutoHotkey fallback is currently available on Windows only.");
                }
                if (action === "key_event") {
                    return unsupported("as_input_controller", ["win32"], "Lower-level key_event dispatch is currently available on Windows only.");
                }
                if (action === "type" || action === "paste_text") {
                    const command = `osascript -e ${quote(`tell application "System Events" to keystroke ${JSON.stringify(String(text) + (send_enter ? "\n" : ""))}`)}`;
                    const response = buildCommandResponse(command, await sh(command));
                    await waitInputDelay(delay);
                    return response;
                }
                const cliclick = await commandExists(["cliclick"]);
                if (!cliclick)
                    return unsupported("as_input_controller", ["win32", "linux", "darwin"], "Install cliclick for macOS mouse and shortcut automation beyond text typing.");
                if (action === "mouse") {
                    if (!["move", "left_click", "right_click", "double_click"].includes(mouse_action)) {
                        return unsupported("as_input_controller", ["win32"], `mouse_action='${mouse_action}' is currently available on Windows only.`);
                    }
                    const click = mouse_action === "left_click" ? `c:${x},${y}` : mouse_action === "right_click" ? `rc:${x},${y}` : mouse_action === "double_click" ? `dc:${x},${y}` : `m:${x},${y}`;
                    const response = buildCommandResponse(`cliclick ${click}`, await sh(`cliclick ${click}`));
                    await waitInputDelay(delay);
                    return response;
                }
                if (action === "drag") {
                    if (drag_button !== "left") {
                        return unsupported("as_input_controller", ["win32"], `drag_button='${drag_button}' is currently available on Windows only.`);
                    }
                    const response = buildCommandResponse(`cliclick dd:${from_x},${from_y} du:${to_x},${to_y}`, await sh(`cliclick dd:${from_x},${from_y} du:${to_x},${to_y}`));
                    await waitInputDelay(delay);
                    return response;
                }
                if (action === "scroll") {
                    if (scroll_axis !== "vertical") {
                        return unsupported("as_input_controller", ["win32"], "Horizontal scroll is currently available on Windows only.");
                    }
                    const response = buildCommandResponse(`cliclick w:${amount}`, await sh(`cliclick w:${amount}`));
                    await waitInputDelay(delay);
                    return response;
                }
                return unsupported("as_input_controller", ["win32", "linux", "darwin"], "This macOS keyboard action is not available through the current fallback.");
            }
            const xdotool = await commandExists(["xdotool"]);
            if (!xdotool)
                return unsupported("as_input_controller", ["win32", "linux", "darwin"], "Install xdotool for Linux input automation.");
            if (action === "type" || action === "paste_text") {
                const command = `xdotool type --clearmodifiers ${quote(String(text))}${send_enter ? " key Return" : ""}`;
                const response = buildCommandResponse(command, await sh(command));
                await waitInputDelay(delay);
                return response;
            }
            if (action === "key_event") {
                return unsupported("as_input_controller", ["win32"], "Lower-level key_event dispatch is currently available on Windows only.");
            }
            if (action === "autohotkey_script") {
                return unsupported("as_input_controller", ["win32"], "AutoHotkey fallback is currently available on Windows only.");
            }
            if (action === "hotkey" || action === "press") {
                const command = `xdotool key --clearmodifiers ${quote(String(combo || text).replace(/\+/g, "+"))}`;
                const response = buildCommandResponse(command, await sh(command));
                await waitInputDelay(delay);
                return response;
            }
            if (action === "sequence") {
                const steps = parseJsonArray(steps_json, "steps_json");
                const commands = steps.map((step) => {
                    if (step.text)
                        return `xdotool type --clearmodifiers ${quote(String(step.text))}`;
                    if (step.combo)
                        return `xdotool key --clearmodifiers ${quote(String(step.combo))}`;
                    if (step.delay_ms)
                        return `sleep ${Math.max(0, Number(step.delay_ms) / 1000)}`;
                    if (delay > 0)
                        return `sleep ${delay / 1000}`;
                    throw new Error("Each Linux input step needs text, combo, or delay_ms.");
                }).join(" && ");
                const response = buildCommandResponse(commands, await sh(commands));
                await waitInputDelay(delay);
                return response;
            }
            if (action === "mouse") {
                if (!["move", "left_click", "right_click", "double_click"].includes(mouse_action)) {
                    return unsupported("as_input_controller", ["win32"], `mouse_action='${mouse_action}' is currently available on Windows only.`);
                }
                const click = mouse_action === "left_click" ? "click 1" : mouse_action === "right_click" ? "click 3" : mouse_action === "double_click" ? "click --repeat 2 1" : "";
                const command = `xdotool mousemove ${Number(x)} ${Number(y)} ${click}`;
                const response = buildCommandResponse(command, await sh(command));
                await waitInputDelay(delay);
                return response;
            }
            if (action === "scroll") {
                if (scroll_axis !== "vertical") {
                    return unsupported("as_input_controller", ["win32"], "Horizontal scroll is currently available on Windows only.");
                }
                const button = Number(amount) >= 0 ? 4 : 5;
                const count = Math.min(100, Math.abs(Number(amount)));
                const command = `xdotool click --repeat ${count} ${button}`;
                const response = buildCommandResponse(command, await sh(command));
                await waitInputDelay(delay);
                return response;
            }
            if (drag_button !== "left") {
                return unsupported("as_input_controller", ["win32"], `drag_button='${drag_button}' is currently available on Windows only.`);
            }
            const command = `xdotool mousemove ${Number(from_x)} ${Number(from_y)} mousedown 1 mousemove ${Number(to_x)} ${Number(to_y)} mouseup 1`;
            const response = buildCommandResponse(command, await sh(command));
            await waitInputDelay(delay);
            return response;
        }),
    }));
    for (const definition of exports.TOOL_ALIAS_DEFINITIONS) {
        tools.push(tool({
            name: definition.name,
            description: `${definition.description} This ax_* alias maps to ${definition.controller}${definition.action ? `(action="${definition.action}")` : ""}.`,
            parameters: {
                source: z.string().default(""),
                destination: z.string().default(""),
                path: z.string().default(""),
                trash_name: z.string().default(""),
                overwrite: z.boolean().default(false),
                query: z.string().default(""),
                name: z.string().default(""),
                value: z.string().default(""),
                title: z.string().default(""),
                content: z.string().default(""),
                tags: z.array(z.string()).default([]),
                text: z.string().default(""),
                priority: z.enum(["low", "normal", "high"]).default("normal"),
                id: z.string().default(""),
                pid: z.number().int().min(0).default(0),
                force: z.boolean().default(true),
                mode: z.enum(["text", "html", "rtf", "files", "image"]).default("text"),
                combo: z.string().default(""),
                key_path: z.string().default(""),
                value_name: z.string().default(""),
                limit: z.number().int().min(1).max(5000).default(200),
            },
            implementation: safeTool(definition.name, async (params) => {
                if (!aliasesEnabled(ctl))
                    return aliasDisabled(definition);
                switch (definition.name) {
                    case "ax_file_copy":
                        return await callTool("as_file_copy_move", { action: "copy", source: params.source, destination: params.destination, overwrite: params.overwrite });
                    case "ax_file_move":
                        return await callTool("as_file_copy_move", { action: "move", source: params.source, destination: params.destination, overwrite: params.overwrite });
                    case "ax_file_mkdir":
                        return await callTool("as_file_create", { action: "directory", path: params.path });
                    case "ax_file_search":
                        return await callTool("as_file_search", {
                            directory: params.path || ".",
                            criteria_json: params.query ? JSON.stringify([{ name_pattern: `*${params.query}*` }, { path_regex: String(params.query) }]) : "[]",
                            join: params.query ? "or" : "and",
                            limit: params.limit,
                        });
                    case "ax_file_restore":
                        return await callTool("as_file_restore", { trash_name: params.trash_name || params.name, destination: params.destination || params.path, overwrite: params.overwrite });
                    case "ax_memory_list":
                        return await callTool("as_memory_controller", { action: "list", query: params.query, limit: params.limit });
                    case "ax_memory_save":
                        return await callTool("as_memory_controller", { action: "upsert", id: params.id, title: params.title, content: params.content, tags: params.tags });
                    case "ax_todo_list":
                        return await callTool("as_todo_controller", { action: "list", status: "all" });
                    case "ax_todo_add":
                        return await callTool("as_todo_controller", { action: "upsert", text: params.text, priority: params.priority });
                    case "ax_env_get":
                        return await callTool("as_environ_controller", { action: "get", name: params.name });
                    case "ax_env_set":
                        return await callTool("as_environ_controller", { action: "set", name: params.name, value: params.value });
                    case "ax_process_list":
                        return await callTool("as_process_controller", { action: "list", query: params.query, limit: params.limit });
                    case "ax_process_kill":
                        return await callTool("as_process_controller", { action: "kill", pid: params.pid, force: params.force });
                    case "ax_clipboard_read":
                        return await callTool("as_clipboard_controller", { action: "read" });
                    case "ax_clipboard_write":
                        return await callTool("as_clipboard_controller", { action: "write", mode: params.mode, text: params.text });
                    case "ax_window_list":
                        return await callTool("as_window_controller", { action: "list", query: params.query, limit: params.limit });
                    case "ax_window_focus":
                        return await callTool("as_window_controller", { action: "focus", query: params.query || params.name });
                    case "ax_input_type":
                        return await callTool("as_input_controller", { action: "type", text: params.text });
                    case "ax_input_hotkey":
                        return await callTool("as_input_controller", { action: "hotkey", combo: params.combo || params.text });
                    case "ax_task_list":
                        return await callTool("as_task_controller", { action: "list", query: params.query, limit: params.limit });
                    case "ax_service_list":
                        return await callTool("as_service_controller", { action: "list", query: params.query, limit: params.limit });
                    case "ax_registry_get":
                        return await callTool("as_registry_controller", { action: "get", key_path: params.key_path, value_name: params.value_name });
                    default:
                        throw new Error(`Unhandled alias '${definition.name}'.`);
                }
            }),
        }));
    }
}
//# sourceMappingURL=consolidated.js.map