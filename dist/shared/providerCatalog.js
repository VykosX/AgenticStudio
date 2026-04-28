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
exports.detectEnabledPluginsFromLmStudioState = exports.TOOL_PROFILE_ORDER = exports.writeToFileParameter = void 0;
exports.summarizeByPlugin = summarizeByPlugin;
exports.summarizeToolNamesByPlugin = summarizeToolNamesByPlugin;
exports.compactToolRecord = compactToolRecord;
exports.standardToolRecord = standardToolRecord;
exports.basicToolRecord = basicToolRecord;
exports.zodSchemaToJson = zodSchemaToJson;
exports.runtimeToolSchema = runtimeToolSchema;
exports.findMatchingTool = findMatchingTool;
exports.normalizeQueryToolList = normalizeQueryToolList;
exports.findSimilarTools = findSimilarTools;
exports.inferToolCategory = inferToolCategory;
exports.getAllowedToolNamesForProfile = getAllowedToolNamesForProfile;
exports.listAgenticStudioToolMinimumProfiles = listAgenticStudioToolMinimumProfiles;
exports.filterToolsByProfile = filterToolsByProfile;
exports.buildToolDocumentation = buildToolDocumentation;
exports.discoverToolDocumentation = discoverToolDocumentation;
exports.discoverPluginInventory = discoverPluginInventory;
exports.filterDisabledOnly = filterDisabledOnly;
exports.recommendToolsForGoal = recommendToolsForGoal;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const zod_1 = require("zod");
const consolidated_1 = require("../tools/consolidated");
const providerFilesystem_1 = require("./providerFilesystem");
const providerState_1 = require("./providerState");
Object.defineProperty(exports, "detectEnabledPluginsFromLmStudioState", { enumerable: true, get: function () { return providerState_1.detectEnabledPluginsFromLmStudioState; } });
const providerUtils_1 = require("./providerUtils");
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
function summarizeToolNamesByPlugin(docs) {
    const grouped = new Map();
    for (const doc of docs) {
        const existing = grouped.get(doc.plugin) || [];
        existing.push(doc.name);
        grouped.set(doc.plugin, existing);
    }
    return [...grouped.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([plugin, tools]) => ({ plugin, tools }));
}
function compactToolRecord(doc) {
    return {
        name: doc.name,
        plugin: doc.plugin,
        pluginLabel: doc.pluginLabel || doc.plugin,
        category: doc.category,
        availability: doc.availability || "live",
        sourceKind: doc.sourceKind || "plugin_tool",
    };
}
exports.writeToFileParameter = zod_1.z.union([zod_1.z.string(), zod_1.z.boolean()]).default("");
function standardToolRecord(doc, includeExamples) {
    return {
        name: doc.name,
        plugin: doc.plugin,
        pluginLabel: doc.pluginLabel || doc.plugin,
        category: doc.category,
        description: doc.description,
        whenToUse: doc.whenToUse || null,
        example: includeExamples ? (doc.example || null) : null,
        alternatives: doc.alternatives || [],
        availability: doc.availability || "live",
        sourceKind: doc.sourceKind || "plugin_tool",
        availabilityReason: doc.availabilityReason || null,
    };
}
function basicToolRecord(doc) {
    return {
        name: doc.name,
        plugin: doc.plugin,
        pluginLabel: doc.pluginLabel || doc.plugin,
        category: doc.category,
        availability: doc.availability || "live",
    };
}
function zodSchemaToJson(value) {
    if (!value || typeof value !== "object" || !value._def)
        return null;
    const def = value._def;
    switch (def.typeName) {
        case "ZodString":
            return { type: "string" };
        case "ZodNumber":
            return { type: "number" };
        case "ZodBoolean":
            return { type: "boolean" };
        case "ZodArray":
            return { type: "array", items: zodSchemaToJson(def.type) };
        case "ZodEnum":
            return { type: "string", enum: def.values };
        case "ZodLiteral":
            return { const: def.value };
        case "ZodOptional":
        case "ZodNullable":
        case "ZodDefault":
            return zodSchemaToJson(def.innerType);
        case "ZodUnion":
            return { anyOf: (def.options || []).map((option) => zodSchemaToJson(option)) };
        case "ZodObject": {
            const shape = typeof def.shape === "function" ? def.shape() : def.shape;
            const properties = {};
            const required = [];
            for (const [key, schema] of Object.entries(shape || {})) {
                properties[key] = zodSchemaToJson(schema);
                const schemaDef = schema?._def?.typeName;
                if (schemaDef !== "ZodOptional" && schemaDef !== "ZodDefault") {
                    required.push(key);
                }
            }
            return { type: "object", properties, required };
        }
        default:
            return { type: "unknown", zodType: def.typeName };
    }
}
function runtimeToolSchema(registeredTools, toolName) {
    const found = registeredTools.find((registeredTool) => registeredTool?.name === toolName);
    return found?.parametersSchema ? zodSchemaToJson(found.parametersSchema) : null;
}
function scoreToolMatch(toolName, queryTool) {
    const query = (0, providerUtils_1.normalize)(queryTool);
    const name = (0, providerUtils_1.normalize)(toolName);
    if (!query)
        return 0;
    if (name === query)
        return 1;
    if (name.includes(query) || query.includes(name))
        return 0.92;
    return (0, providerUtils_1.computeFuzzyScore)(query, name);
}
function findMatchingTool(docs, queryTool) {
    let best = null;
    let bestScore = 0;
    for (const doc of docs) {
        const score = scoreToolMatch(doc.name, queryTool);
        if (score > bestScore) {
            best = doc;
            bestScore = score;
        }
    }
    return bestScore >= 0.55 ? best : null;
}
function normalizeQueryToolList(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => String(entry || "").trim()).filter(Boolean);
    }
    const text = String(value || "").trim();
    if (!text)
        return [];
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            return parsed.map((entry) => String(entry || "").trim()).filter(Boolean);
        }
    }
    catch {
        // ignore and treat as plain string
    }
    return [text];
}
function findSimilarTools(docs, target, maxItems = 8) {
    return docs
        .filter((doc) => doc.name !== target.name && (doc.category === target.category || doc.plugin === target.plugin))
        .sort((a, b) => {
        const sameCategoryA = a.category === target.category ? 1 : 0;
        const sameCategoryB = b.category === target.category ? 1 : 0;
        return sameCategoryB - sameCategoryA || a.name.localeCompare(b.name);
    })
        .slice(0, maxItems);
}
function inferToolCategory(name, description) {
    const normalizedName = name.toLowerCase();
    const haystack = `${name} ${description}`.toLowerCase();
    if (normalizedName === "consult_secondary_agent" || normalizedName.includes("secondary_agent"))
        return "delegation";
    if ((0, consolidated_1.isToolAliasName)(normalizedName))
        return "alias";
    if (normalizedName.startsWith("as_tool_") || normalizedName === "as_skill_recommend")
        return "help";
    if (normalizedName === "as_skill")
        return "help";
    if (normalizedName === "as_dynamic_tool")
        return "developer";
    if (normalizedName === "as_memory_controller" || normalizedName === "as_todo_controller")
        return "memory";
    if (["as_process_controller", "as_service_controller", "as_registry_controller", "as_environ_controller", "as_task_controller"].includes(normalizedName))
        return "system";
    if (["as_window_controller", "as_clipboard_controller", "as_input_controller"].includes(normalizedName))
        return "desktop";
    if (normalizedName === "as_file_metadata")
        return "metadata";
    if (["as_file_copy_move", "as_file_create", "as_file_restore", "as_file_watch", "as_file_search", "as_file_compare"].includes(normalizedName))
        return "file-management";
    if (normalizedName === "as_file_organize")
        return "organization";
    if (normalizedName.startsWith("as_clipboard_") || normalizedName.startsWith("as_window_") || normalizedName.startsWith("as_input_") || normalizedName.startsWith("as_screenshot_"))
        return "desktop";
    if (normalizedName.startsWith("as_port_"))
        return "system";
    if (normalizedName.startsWith("as_process_") || normalizedName.startsWith("as_service_") || normalizedName.startsWith("as_registry_") || normalizedName.startsWith("as_env_"))
        return "system";
    if (normalizedName === "as_agent_task" || normalizedName === "as_sleep" || normalizedName === "as_http_wait" || normalizedName.startsWith("as_task_schedule_") || normalizedName.startsWith("as_file_watch_"))
        return "automation";
    if (normalizedName === "as_date_math")
        return "date-time";
    if (normalizedName.startsWith("as_metadata_"))
        return "metadata";
    if (normalizedName.startsWith("as_media_") || normalizedName.startsWith("as_image_") || normalizedName.startsWith("as_mkv_") || normalizedName.startsWith("as_vision_"))
        return "media";
    if (["as_database_query", "as_tabular_data", "as_structured_data"].includes(normalizedName) || normalizedName.startsWith("as_data_") || normalizedName.endsWith("_query"))
        return "structured-data";
    if (normalizedName === "as_archive")
        return "media";
    if (normalizedName === "as_torrent_controller")
        return "downloads";
    if (normalizedName === "as_multi_website_search" || normalizedName.startsWith("as_web_") || normalizedName.startsWith("as_download_") || normalizedName === "as_http_request")
        return normalizedName === "as_download_video" ? "downloads" : "web-scraping";
    if (normalizedName === "as_file_rename" || normalizedName.startsWith("as_file_plan_") || normalizedName.startsWith("as_file_preview_") || normalizedName.startsWith("as_file_batch_") || normalizedName.includes("duplicate") || normalizedName.includes("reorganization"))
        return "organization";
    if (normalizedName.startsWith("as_file_"))
        return "file-management";
    if (normalizedName === "as_git_controller" || normalizedName.startsWith("as_code_") || normalizedName.startsWith("as_python_") || normalizedName.startsWith("as_cpp_") || normalizedName === "as_project_analyze" || normalizedName === "as_project_verify" || normalizedName === "as_project_bug_scan" || normalizedName === "as_deno_run_script")
        return "developer";
    if (/\b(help|catalog)\b/.test(haystack))
        return "help";
    if (/\b(secondar|subagent|delegat)\b/.test(haystack))
        return "delegation";
    if (/\b(math|calculate|arithmetic|trigon|logarithm|factorial|statistic|combinatoric)\b/.test(haystack))
        return "math";
    if (/\b(date|time|timezone|weekday|calendar|duration|leap year)\b/.test(haystack))
        return "date-time";
    if (/\b(unit|convert|currency|temperature|pressure|torque|storage)\b/.test(haystack))
        return "unit-conversion";
    if (/\b(youtube|playlist|yt-dlp|subtitle|thumbnail|video)\b/.test(haystack))
        return "downloads";
    if (/\b(firecrawl|scrap|crawl|mhtml|archive page|website|web|url|download)\b/.test(haystack))
        return "web-scraping";
    if (/\b(csv|json|yaml|sqlite|postgres|mysql|sql|data)\b/.test(haystack))
        return "structured-data";
    if (/\b(metadata|exif)\b/.test(haystack))
        return "metadata";
    if (/\b(media|ffmpeg|ffprobe|image|mkv|audio)\b/.test(haystack))
        return "media";
    if (/\b(process|service|registry|env|system|port)\b/.test(haystack))
        return "system";
    if (/\b(window|clipboard|keyboard|mouse|screenshot|desktop)\b/.test(haystack))
        return "desktop";
    if (/\b(schedule|watch|automation|task|workflow|wait|orchestrat|sleep)\b/.test(haystack))
        return "automation";
    if (/\b(reorgan|duplicate|rename|organize|cleanup)\b/.test(haystack))
        return "organization";
    if (/\b(file|directory|path|trash|undo|diff|patch)\b/.test(haystack))
        return "file-management";
    if (/\b(python|cpp|compile|lint|typecheck|project|test|git|branch|commit|clone|verify|bug scan|skill|tool scaffold|tool validate)\b/.test(haystack))
        return "developer";
    return "discovered";
}
const aliasToolNames = consolidated_1.TOOL_ALIAS_DEFINITIONS.map((entry) => entry.name);
exports.TOOL_PROFILE_ORDER = [
    "minimal",
    "file_management",
    "multimedia",
    "web",
    "research",
    "data",
    "desktop",
    "system_admin",
    "automation",
    "development",
    "balanced",
    "full",
];
const minimalProfileToolNames = new Set([
    "as_caveman_status",
    "as_set_tool_profile",
    "as_request_tool",
    "as_tool_catalog",
    "as_tool_help",
    "as_skill",
    "as_skill_recommend",
    "as_file_embed",
    ...aliasToolNames,
]);
const fileManagementProfileToolNames = new Set([
    ...minimalProfileToolNames,
    "as_file_tree",
    "as_memory_controller",
    "as_todo_controller",
    "as_file_list",
    "as_file_metadata",
    "as_file_create",
    "as_file_copy_move",
    "as_file_delete",
    "as_file_set_times",
    "as_file_link",
    "as_file_exists",
    "as_file_read",
    "as_file_write",
    "as_file_hash",
    "as_file_fuzzy_find",
    "as_file_search",
    "as_file_compare",
    "as_file_find_duplicates",
    "as_file_restore",
    "as_file_rename",
    "as_file_patch",
    "as_file_watch",
    "as_file_organize",
    "as_file_resolve_duplicates",
    "as_file_operations_log",
    "as_file_undo",
    "as_file_search_text",
    "as_structured_data",
    "as_tabular_data",
    "as_http_request",
    "as_web_download",
    "as_date_math",
]);
const multimediaProfileToolNames = new Set([
    ...minimalProfileToolNames,
    "as_file_tree",
    "as_file_list",
    "as_file_metadata",
    "as_file_create",
    "as_file_copy_move",
    "as_file_delete",
    "as_file_hash",
    "as_file_compare",
    "as_file_find_duplicates",
    "as_file_rename",
    "as_file_organize",
    "as_download_video",
    "as_web_download",
    "as_torrent_controller",
    "as_web_extract",
    "as_archive",
    "as_pdf_extract_text",
    "as_file_metadata",
    "as_metadata_write",
    "as_media_probe",
    "as_media_transform",
    "as_image_identify",
    "as_image_convert",
    "as_mkv_info",
    "as_mkv_extract",
    "as_mkv_edit",
    "as_vision_ocr",
    "as_vision_target",
    "as_vision_focus",
    "as_vision_recognize",
    "as_date_math",
]);
const webProfileToolNames = new Set([
    ...minimalProfileToolNames,
    "as_http_request",
    "as_web_search",
    "as_web_image_search",
    "as_web_extract",
    "as_multi_website_search",
    "as_web_download",
    "as_download_video",
    "as_torrent_controller",
    "as_deno_run_script",
    "as_http_wait",
]);
const researchProfileToolNames = new Set([
    ...webProfileToolNames,
    "as_memory_controller",
    "as_todo_controller",
    "as_agent_task",
    "as_structured_data",
    "as_tabular_data",
    "as_file_read",
    "as_file_write",
    "as_file_patch",
    "as_pdf_extract_text",
    "as_date_math",
]);
const dataProfileToolNames = new Set([
    ...minimalProfileToolNames,
    "as_file_tree",
    "as_file_list",
    "as_file_read",
    "as_file_write",
    "as_file_patch",
    "as_file_search",
    "as_database_query",
    "as_tabular_data",
    "as_structured_data",
    "as_archive",
    "as_pdf_extract_text",
    "as_date_math",
]);
const desktopProfileToolNames = new Set([
    ...minimalProfileToolNames,
    "as_system_info",
    "as_process_controller",
    "as_port_list",
    "as_port_wait",
    "as_clipboard_controller",
    "as_screenshot_capture",
    "as_window_controller",
    "as_input_controller",
    "as_vision_ocr",
    "as_vision_target",
    "as_vision_focus",
    "as_vision_recognize",
    "as_environ_controller",
    "as_sleep",
]);
const systemAdminProfileToolNames = new Set([
    ...minimalProfileToolNames,
    "as_system_info",
    "as_process_controller",
    "as_port_list",
    "as_port_wait",
    "as_service_controller",
    "as_environ_controller",
    "as_registry_controller",
    "as_task_controller",
    "as_screenshot_capture",
    "as_sleep",
    "as_date_math",
]);
const automationProfileToolNames = new Set([
    ...minimalProfileToolNames,
    "as_system_info",
    "as_file_watch",
    "as_process_controller",
    "as_port_list",
    "as_port_wait",
    "as_service_controller",
    "as_environ_controller",
    "as_registry_controller",
    "as_task_controller",
    "as_http_wait",
    "as_sleep",
    "as_date_math",
    "as_agent_task",
    "consult_secondary_agent",
]);
const developmentProfileToolNames = new Set([
    ...minimalProfileToolNames,
    "as_run_shell_command",
    "as_file_tree",
    "as_file_list",
    "as_file_metadata",
    "as_file_create",
    "as_file_copy_move",
    "as_file_delete",
    "as_file_exists",
    "as_file_search",
    "as_file_compare",
    "as_file_search_text",
    "as_file_patch",
    "as_project_analyze",
    "as_project_verify",
    "as_project_bug_scan",
    "as_git_controller",
    "as_code_outline",
    "as_python_format",
    "as_python_lint",
    "as_python_typecheck",
    "as_python_run_tests",
    "as_python_pip_list",
    "as_cpp_get_info",
    "as_cpp_compile_and_run",
    "as_dynamic_tool",
    "as_agent_task",
    "as_process_controller",
    "as_port_list",
    "as_http_wait",
    "as_port_wait",
    "as_sleep",
    "consult_secondary_agent",
    "as_http_request",
    "as_structured_data",
]);
const balancedProfileToolNames = new Set([
    ...fileManagementProfileToolNames,
    ...webProfileToolNames,
    ...developmentProfileToolNames,
    ...dataProfileToolNames,
    "as_math",
    "as_unit_conversion",
    "as_date_math",
    "as_vision_ocr",
    "as_vision_target",
    "as_vision_focus",
    "as_vision_recognize",
]);
function getAllowedToolNamesForProfile(profile, requestedToolNames = []) {
    let allowed;
    if (profile === "full") {
        allowed = null;
    }
    else if (profile === "minimal") {
        allowed = new Set(minimalProfileToolNames);
    }
    else if (profile === "file_management") {
        allowed = new Set(fileManagementProfileToolNames);
    }
    else if (profile === "multimedia") {
        allowed = new Set(multimediaProfileToolNames);
    }
    else if (profile === "web") {
        allowed = new Set(webProfileToolNames);
    }
    else if (profile === "research") {
        allowed = new Set(researchProfileToolNames);
    }
    else if (profile === "data") {
        allowed = new Set(dataProfileToolNames);
    }
    else if (profile === "desktop") {
        allowed = new Set(desktopProfileToolNames);
    }
    else if (profile === "system_admin") {
        allowed = new Set(systemAdminProfileToolNames);
    }
    else if (profile === "automation") {
        allowed = new Set(automationProfileToolNames);
    }
    else if (profile === "development") {
        allowed = new Set(developmentProfileToolNames);
    }
    else if (profile === "balanced") {
        allowed = new Set(balancedProfileToolNames);
    }
    else {
        allowed = new Set(minimalProfileToolNames);
    }
    if (!allowed)
        return null;
    for (const toolName of requestedToolNames) {
        const normalized = String(toolName || "").trim();
        if (normalized)
            allowed.add(normalized);
    }
    return allowed;
}
function listAgenticStudioToolMinimumProfiles(allowIndividualToolRequests = true, aliasesEnabled = true) {
    const profilesToScan = exports.TOOL_PROFILE_ORDER.filter((profile) => profile !== "full");
    const minimumByTool = new Map();
    for (const profile of profilesToScan) {
        const allowed = getAllowedToolNamesForProfile(profile) || new Set();
        for (const toolName of allowed) {
            if (toolName === "as_request_tool" && !allowIndividualToolRequests)
                continue;
            if ((0, consolidated_1.isToolAliasName)(toolName) && !aliasesEnabled)
                continue;
            if (!minimumByTool.has(toolName)) {
                minimumByTool.set(toolName, {
                    name: toolName,
                    minimumProfile: profile,
                    ...(toolName === "as_request_tool" ? { configNote: "requires Allow individual tool requests" } : {}),
                });
            }
        }
    }
    return [...minimumByTool.values()].sort((a, b) => a.name.localeCompare(b.name));
}
function filterToolsByProfile(tools, profile, requestedToolNames = []) {
    const allowed = getAllowedToolNamesForProfile(profile, requestedToolNames);
    if (!allowed)
        return tools;
    return tools.filter((registeredTool) => allowed.has(registeredTool?.name));
}
function buildToolDocumentation(name, description, pluginId, availability, availabilityReason, allowIndividualToolRequests = true) {
    return {
        name,
        plugin: pluginId,
        pluginLabel: pluginId === "vykosx/agentic-studio" ? "vykosx/agentic-studio" : pluginId,
        category: inferToolCategory(name, description),
        description,
        availability,
        sourceKind: "plugin_tool",
        availabilityReason: availabilityReason || (availability === "live"
            ? (pluginId === "vykosx/agentic-studio"
                ? "This tool is provided by the current custom agentic-studio plugin and is callable now. LM Studio itself does not include native tools by default."
                : "This tool is provided by an installed plugin that appears enabled for the current LM Studio conversation. LM Studio itself does not include native tools by default.")
            : availability === "profile_switch_required"
                ? (allowIndividualToolRequests
                    ? "This tool belongs to agentic-studio but is hidden by the current tool profile. Request it individually with as_request_tool for one-off use, or switch profiles if you expect to keep using tools from that category. Either way, wait until the next turn before calling it."
                    : "This tool belongs to agentic-studio but is hidden by the current tool profile. Switch profiles to make it callable on a subsequent turn.")
                : "This tool is provided by an installed plugin on disk, but that plugin does not appear enabled for the current conversation."),
    };
}
function normalizeExtractedDescription(value) {
    return value.replace(/\s+/g, " ").trim();
}
function extractTemplateLiteral(lines, startLine, startColumn) {
    let collected = lines[startLine].slice(startColumn);
    for (let k = startLine + 1; k < lines.length; k++) {
        collected += `\n${lines[k]}`;
        if (lines[k].includes("`"))
            break;
    }
    const firstTick = collected.indexOf("`");
    const lastTick = collected.lastIndexOf("`");
    if (firstTick !== -1 && lastTick > firstTick) {
        return normalizeExtractedDescription(collected.slice(firstTick + 1, lastTick));
    }
    return "";
}
function extractDescriptionFromIdentifier(lines, identifier, fromIndex) {
    const pattern = new RegExp(`\\b(?:const|let|var)\\s+${identifier}\\s*=`);
    for (let i = fromIndex; i >= Math.max(0, fromIndex - 160); i--) {
        const line = lines[i];
        if (!pattern.test(line))
            continue;
        const eqIndex = line.indexOf("=");
        if (eqIndex === -1)
            continue;
        const afterEquals = line.slice(eqIndex + 1);
        const tickIndex = afterEquals.indexOf("`");
        if (tickIndex !== -1) {
            return extractTemplateLiteral(lines, i, eqIndex + 1 + tickIndex);
        }
        const quoted = afterEquals.match(/"([^"]+)"|'([^']+)'/);
        if (quoted) {
            return normalizeExtractedDescription(quoted[1] || quoted[2] || "");
        }
    }
    return "";
}
function extractDescriptionFromLines(lines, fromIndex) {
    for (let j = fromIndex; j < Math.min(lines.length, fromIndex + 260); j++) {
        const line = lines[j];
        if (!line.includes("description:"))
            continue;
        const inline = line.match(/description:\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/);
        if (inline) {
            return normalizeExtractedDescription(inline[1] || inline[2] || inline[3] || "");
        }
        const textTemplate = line.match(/description:\s*text`/);
        if (textTemplate) {
            return extractTemplateLiteral(lines, j, line.indexOf("text`") + 4);
        }
        const plainTemplateIndex = line.indexOf("`");
        if (plainTemplateIndex !== -1) {
            return extractTemplateLiteral(lines, j, plainTemplateIndex);
        }
        const identifier = line.match(/description:\s*([A-Za-z_][A-Za-z0-9_]*)/);
        if (identifier) {
            const resolved = extractDescriptionFromIdentifier(lines, identifier[1], j);
            if (resolved)
                return resolved;
        }
    }
    return "";
}
function extractRegisteredToolsFromSource(text, pluginId, isLive) {
    const docs = [];
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        if (!/tool\)\s*\(\{|tool\s*\(\{/i.test(lines[i]))
            continue;
        let name = "";
        let description = extractDescriptionFromLines(lines, i + 1);
        for (let j = i + 1; j < Math.min(lines.length, i + 260); j++) {
            if (!name) {
                const nameMatch = lines[j].match(/name:\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/);
                if (nameMatch) {
                    name = nameMatch[1] || nameMatch[2] || nameMatch[3] || "";
                }
            }
            if (name && description)
                break;
        }
        if (!name || !description)
            continue;
        docs.push(buildToolDocumentation(name, description, pluginId, isLive ? "live" : "installed_only"));
    }
    return docs;
}
function extractDocumentationFromRuntimeTools(registeredTools, pluginId, currentProfile, requestedProfile, currentRequestedToolNames = [], allowIndividualToolRequests = true) {
    const docs = [];
    const requestedAllowed = getAllowedToolNamesForProfile(requestedProfile);
    const currentAllowed = getAllowedToolNamesForProfile(currentProfile, currentRequestedToolNames);
    for (const registeredTool of registeredTools) {
        const value = registeredTool;
        const name = typeof value?.name === "string" ? value.name.trim() : "";
        const description = typeof value?.description === "string" ? value.description.replace(/\s+/g, " ").trim() : "";
        if (!name || !description)
            continue;
        if (requestedAllowed && !requestedAllowed.has(name))
            continue;
        const isLive = !currentAllowed || currentAllowed.has(name);
        docs.push(buildToolDocumentation(name, description, pluginId, isLive ? "live" : "profile_switch_required", undefined, allowIndividualToolRequests));
    }
    return docs;
}
async function discoverToolDocumentation(scope, enabledPluginIds, mode = "live_only", registeredOwnTools = [], currentProfile = "minimal", requestedProfile = currentProfile, currentRequestedToolNames = [], allowIndividualToolRequests = true) {
    const docs = new Map();
    if (scope !== "disabled") {
        for (const doc of extractDocumentationFromRuntimeTools(registeredOwnTools, "vykosx/agentic-studio", currentProfile, requestedProfile, currentRequestedToolNames, allowIndividualToolRequests)) {
            if (!consolidated_1.SUPERSEDED_TOOL_NAMES.has(doc.name))
                docs.set(`${doc.plugin}:${doc.name}`, doc);
        }
    }
    if (scope === "own") {
        return [...docs.values()]
            .filter((doc) => doc.plugin === "vykosx/agentic-studio")
            .sort((a, b) => a.name.localeCompare(b.name));
    }
    const pluginsRoot = (0, providerState_1.getPluginsRootDirectory)();
    const enabledSet = new Set(enabledPluginIds.map((value) => (0, providerUtils_1.normalize)(value)));
    const owners = await fs_1.promises.readdir(pluginsRoot, { withFileTypes: true }).catch(() => []);
    for (const ownerEntry of owners) {
        if (!ownerEntry.isDirectory())
            continue;
        const ownerPath = path.join(pluginsRoot, ownerEntry.name);
        const plugins = await fs_1.promises.readdir(ownerPath, { withFileTypes: true }).catch(() => []);
        for (const pluginEntry of plugins) {
            if (!pluginEntry.isDirectory())
                continue;
            const pluginPath = path.join(ownerPath, pluginEntry.name);
            const pluginId = `${ownerEntry.name}/${pluginEntry.name}`;
            const isLive = enabledSet.has((0, providerUtils_1.normalize)(pluginId)) || (0, providerUtils_1.normalize)(pluginId) === "vykosx/agentic-studio";
            if ((0, providerUtils_1.normalize)(pluginId) === "vykosx/agentic-studio")
                continue;
            if (scope === "enabled" && !isLive)
                continue;
            if (scope === "disabled" && isLive)
                continue;
            if (mode === "live_only" && !isLive)
                continue;
            const candidateFiles = [];
            for (const relativeFile of [
                path.join("src", "toolsProvider.ts"),
                path.join("SRC", "toolsProvider.ts"),
                path.join("src", "tools-provider.ts"),
                path.join("SRC", "tools-provider.ts"),
                path.join("src", "index.ts"),
                path.join("SRC", "index.ts"),
                path.join("dist", "toolsProvider.js"),
                path.join("dist", "index.js"),
                path.join(".lmstudio", "production.js"),
                path.join(".lmstudio", "entry.ts"),
            ]) {
                const fullPath = path.join(pluginPath, relativeFile);
                if (await (0, providerFilesystem_1.fileExists)(fullPath))
                    candidateFiles.push(fullPath);
            }
            await (0, providerFilesystem_1.collectToolSourceFiles)(pluginPath, "src/tools", candidateFiles, 120);
            await (0, providerFilesystem_1.collectToolSourceFiles)(pluginPath, "SRC/tools", candidateFiles, 120);
            await (0, providerFilesystem_1.collectToolSourceFiles)(pluginPath, "dist/tools", candidateFiles, 120);
            const uniqueCandidates = [...new Set(candidateFiles)];
            for (const fullPath of uniqueCandidates) {
                try {
                    const text = await fs_1.promises.readFile(fullPath, "utf8");
                    for (const extracted of extractRegisteredToolsFromSource(text, pluginId, isLive)) {
                        const key = `${pluginId}:${extracted.name}`;
                        if (!docs.has(key)) {
                            docs.set(key, extracted);
                        }
                    }
                }
                catch {
                    continue;
                }
            }
        }
    }
    return [...docs.values()].sort((a, b) => a.plugin.localeCompare(b.plugin) || a.name.localeCompare(b.name));
}
async function discoverPluginInventory(docs, enabledPluginIds) {
    const enabledSet = new Set(enabledPluginIds.map((value) => (0, providerUtils_1.normalize)(value)));
    const toolCountByPlugin = new Map();
    for (const doc of docs) {
        toolCountByPlugin.set(doc.plugin, (toolCountByPlugin.get(doc.plugin) || 0) + 1);
    }
    const pluginsRoot = (0, providerState_1.getPluginsRootDirectory)();
    const entries = [];
    const owners = await fs_1.promises.readdir(pluginsRoot, { withFileTypes: true }).catch(() => []);
    for (const ownerEntry of owners) {
        if (!ownerEntry.isDirectory() || ownerEntry.name.startsWith("."))
            continue;
        const ownerPath = path.join(pluginsRoot, ownerEntry.name);
        const plugins = await fs_1.promises.readdir(ownerPath, { withFileTypes: true }).catch(() => []);
        for (const pluginEntry of plugins) {
            if (!pluginEntry.isDirectory() || pluginEntry.name.startsWith("."))
                continue;
            const pluginId = `${ownerEntry.name}/${pluginEntry.name}`;
            const pluginPath = path.join(ownerPath, pluginEntry.name);
            const enabled = enabledSet.has((0, providerUtils_1.normalize)(pluginId));
            let capabilityKind = "unknown";
            let note = "Installed plugin.";
            const candidateFiles = [
                path.join(pluginPath, "src", "index.ts"),
                path.join(pluginPath, "dist", "index.js"),
                path.join(pluginPath, ".lmstudio", "entry.ts"),
                path.join(pluginPath, ".lmstudio", "production.js"),
            ];
            for (const candidate of candidateFiles) {
                try {
                    if (!(await (0, providerFilesystem_1.fileExists)(candidate)))
                        continue;
                    const text = await fs_1.promises.readFile(candidate, "utf8");
                    if (text.includes("withToolsProvider")) {
                        capabilityKind = "tools";
                        note = "Plugin exposes tools through a tools provider.";
                        break;
                    }
                    if (text.includes("withChatMessagePreprocessor") || text.includes("withGenerationConfigProvider") || text.includes("withConfigSchematics")) {
                        capabilityKind = "non_tool_plugin";
                        note = "Plugin appears installed but no tool provider was detected from the scanned entry files.";
                    }
                }
                catch {
                    continue;
                }
            }
            entries.push({
                plugin: pluginId,
                pluginLabel: pluginId === "vykosx/agentic-studio" ? "vykosx/agentic-studio" : pluginId,
                enabled,
                parsedToolCount: toolCountByPlugin.get(pluginId) || 0,
                capabilityKind,
                note,
            });
        }
    }
    return entries.sort((a, b) => a.plugin.localeCompare(b.plugin));
}
function filterDisabledOnly(docs, enabledPluginIds) {
    const enabledSet = new Set(enabledPluginIds.map((value) => (0, providerUtils_1.normalize)(value)));
    return docs.filter((doc) => doc.plugin !== "vykosx/agentic-studio" && !enabledSet.has((0, providerUtils_1.normalize)(doc.plugin)));
}
function recommendToolsForGoal(goal, docs) {
    const query = goal.toLowerCase();
    const normalizedGoal = (0, providerUtils_1.normalize)(goal);
    const preferredDocs = docs.filter((doc) => doc.category !== "discovered");
    const docsSource = preferredDocs.length > 0 ? preferredDocs : docs;
    const docsByName = new Map(docsSource.map((doc) => [doc.name, doc]));
    const picks = new Map();
    let pickOrder = 0;
    const addPick = (doc, increment) => {
        const current = picks.get(doc.name);
        picks.set(doc.name, {
            doc,
            score: (current?.score || 0) + increment,
            order: current?.order ?? pickOrder++,
        });
    };
    const addByName = (...names) => {
        const baseScore = Math.max(2, names.length + 1);
        for (const [index, name] of names.entries()) {
            const doc = docsByName.get(name);
            if (!doc)
                continue;
            addPick(doc, Math.max(1, baseScore - index));
        }
    };
    const addIf = (pattern, ...names) => {
        if (pattern.test(query))
            addByName(...names);
    };
    addIf(/\b(read file|open file|show file|view file|inspect file contents|cat file|display file|load file)\b/, "as_file_read", "as_file_open", "as_file_list", "as_file_tree");
    addIf(/\b(write file|save file|create file|new file|overwrite file|rewrite file)\b/, "as_file_write", "as_file_create", "as_file_read");
    addIf(/\b(folder|directory|directories|tree|list files|browse files|explore files|file listing)\b/, "as_file_list", "as_file_tree", "as_file_exists", "as_file_fuzzy_find");
    addIf(/\b(search file|find file|fuzzy find|locate file|which file|where is file)\b/, "as_file_search", "as_file_fuzzy_find", "as_file_list");
    addIf(/\b(search text|grep|find in files|text search|match text|regex search|find string|symbol search)\b/, "as_file_search_text", "as_file_read", "as_code_outline");
    addIf(/\b(compare files|diff files|compare text|show diff|unified diff)\b/, "as_file_compare", "as_file_patch", "as_file_read");
    addIf(/\b(copy file|duplicate file|move file|rename path|link file|shortcut|symlink|hardlink)\b/, "as_file_copy_move", "as_file_rename", "as_file_link");
    addIf(/\b(delete file|trash file|remove file|restore file|undo file change|rollback file)\b/, "as_file_delete", "as_file_restore", "as_file_trash_list", "as_file_undo", "as_file_operations_log");
    addIf(/\b(hash file|checksum|sha256|md5|digest)\b/, "as_file_hash", "as_file_read");
    addIf(/\b(downloads|organize|reorganize|cleanup|categorize|sort files|rename files|batch rename|bulk rename|dedupe|deduplicate|duplicate files)\b/, "as_file_organize", "as_file_find_duplicates", "as_file_resolve_duplicates", "as_file_rename", "as_file_watch", "as_file_metadata");
    addIf(/\b(file metadata|metadata for|file info|file information|file properties|properties for|inspect file|exif|mime type|encoding|stat file|executable metadata|exe metadata|binary metadata)\b/, "as_file_metadata", "as_media_probe", "as_image_identify");
    addIf(/\b(embed file|embed image|render image|inline image|show screenshot in chat)\b/, "as_file_embed", "as_vision_ocr");
    addIf(/\b(patch|edit file|edit files|modify code|append|prepend|replace text|regex replace|multi replace|apply diff|code edit)\b/, "as_file_patch", "as_file_read", "as_file_search_text");
    addIf(/\b(math|calculate|calculation|arithmetic|precise|equation|formula|trig|trigon|logarithm|factorial|statistics?|probability|combinatoric|average|median|variance|standard deviation)\b/, "as_math");
    addIf(/\b(convert|conversion|unit|units|currency|exchange rate|temperature|pressure|torque|speed|distance|length|mass|weight|area|volume|storage|bytes|bits|fuel economy|cooking)\b/, "as_unit_conversion");
    addIf(/\b(date|dates|time|timezone|time zone|weekday|calendar|duration|elapsed|deadline|schedule|leap year|unix time|excel serial|julian day)\b/, "as_date_math");
    addIf(/\b(yaml|json|config|structured data|merge patch|json patch)\b/, "as_structured_data", "as_file_read", "as_file_write", "as_file_patch");
    addIf(/\b(csv|spreadsheet|table|tabular|rows|columns|delimited)\b/, "as_tabular_data", "as_structured_data");
    addIf(/\b(pdf|document extraction|extract pdf|read pdf|document text)\b/, "as_pdf_extract_text", "as_archive", "as_file_embed");
    addIf(/\b(archive|compress|uncompress|extract archive|zip|tar|zstd|tgz|backup archive)\b/, "as_archive", "as_file_hash", "as_file_tree", "as_file_write");
    addIf(/\b(git|diff|commit|status|log|revision|branch|checkout|clone|fetch|pull|push|stash|restore|stage|unstage)\b/, "as_git_controller");
    addIf(/\b(symbol|outline|function|class|code map|code navigation|navigate code)\b/, "as_code_outline", "as_file_search_text", "as_file_read");
    addIf(/\b(shell|terminal|command line|powershell|bash|run command|cli)\b/, "as_run_shell_command", "as_process_controller", "as_project_verify");
    addIf(/\b(python|pip|pytest|ruff|mypy|format python|lint python|typecheck python)\b/, "as_python_run_tests", "as_python_lint", "as_python_typecheck", "as_python_format", "as_python_pip_list", "as_run_shell_command");
    addIf(/\b(c\+\+|cpp|compile c\+\+|run c\+\+|build c\+\+)\b/, "as_cpp_compile_and_run", "as_cpp_get_info");
    addIf(/\b(verify|verification|validate|validation|lint|typecheck|test|tests|build|ci|check project|bug scan|audit code)\b/, "as_project_verify", "as_project_bug_scan", "as_project_analyze", "as_code_outline", "as_file_search_text");
    addIf(/\b(task|plan|orchestrat|workflow state|next task|multi-step|queue|backlog|checkpoint|resume later)\b/, "as_agent_task", "as_sleep", "as_todo_controller", "as_memory_controller");
    addIf(/\b(todo|todos|checklist|track work|task list)\b/, "as_todo_controller", "as_agent_task");
    addIf(/\b(memory|remember|notes|save note|persistent note|fact store)\b/, "as_memory_controller", "as_todo_controller");
    addIf(/\b(skill|command template|tool template|tool scaffold|generate tool|create tool|create skill|workflow recipe)\b/, "as_skill_recommend", "as_skill", "as_dynamic_tool");
    addIf(/\b(dynamic tool|new tool|tool generator|python tool)\b/, "as_dynamic_tool", "as_skill");
    addIf(/\b(tool help|which tool|what tool|find tool|tool discovery|tool list|tool catalog|profile tools)\b/, "as_tool_help", "as_tool_catalog", "as_set_tool_profile", "as_request_tool");
    addIf(/\b(profile|switch profile|tool profile|minimal profile|balanced profile|enable tool)\b/, "as_set_tool_profile", "as_request_tool", "as_tool_catalog");
    addIf(/\b(port|localhost|server ready|wait for server|health check|http wait|poll endpoint|open port|list ports)\b/, "as_port_list", "as_port_wait", "as_http_wait", "as_process_controller", "as_http_request");
    addIf(/\b(http|api|rest|endpoint|fetch url|post request|get request|webhook)\b/, "as_http_request", "as_http_wait", "as_web_extract");
    addIf(/\b(search web|internet search|google|search online|look up online|find sources)\b/, "as_web_search", "as_multi_website_search", "as_web_extract");
    addIf(/\b(image search|find images online|reference images)\b/, "as_web_image_search", "as_web_search", "as_multi_website_search");
    addIf(/\b(autonomous browser|browser automation|browser agent|headless browser|navigate webpage|navigate website|browse webpage|browse website|follow links|site-native search|browser script)\b/, "as_skill_recommend", "as_web_extract", "as_multi_website_search", "as_web_search");
    addIf(/\b(media|video|audio|ffmpeg|mkv|metadata|exif|scene|photo analysis|video frame|video frames|multimedia)\b/, "as_media_probe", "as_media_transform", "as_file_metadata", "as_metadata_write", "as_image_identify", "as_image_convert", "as_mkv_info", "as_mkv_extract", "as_mkv_edit", "as_vision_recognize", "as_file_rename", "as_file_organize", "as_file_find_duplicates", "as_skill_recommend");
    addIf(/\b(scrape|crawl|extract|archive page|mhtml|download images|firecrawl|map website|site map|extract webpage|crawl site)\b/, "as_web_extract", "as_web_download", "as_multi_website_search", "as_http_request");
    addIf(/\b(download|fetch file|save url|download page|download asset)\b/, "as_web_download", "as_http_request", "as_web_extract");
    addIf(/\b(youtube|yt-dlp|playlist|video download|download video|download playlist|subtitles|thumbnail)\b/, "as_download_video", "as_web_download", "as_torrent_controller");
    addIf(/\b(torrent|magnet|seed|peer|torrent download)\b/, "as_torrent_controller", "as_web_download");
    addIf(/\b(postgres|postgresql|mysql|mariadb|database|sql|sqlite)\b/, "as_database_query", "as_structured_data");
    addIf(/\b(process|pid|running program|running app|kill process|start process|wait for process)\b/, "as_process_controller", "as_port_list", "as_system_info");
    addIf(/\b(service|daemon|windows service)\b/, "as_service_controller", "as_process_controller");
    addIf(/\b(task scheduler|scheduled task|cron-like|schedule command)\b/, "as_task_controller", "as_sleep", "as_process_controller");
    addIf(/\b(registry|regedit|registry key|registry value)\b/, "as_registry_controller", "as_environ_controller");
    addIf(/\b(environment variable|env var|path variable|refresh env)\b/, "as_environ_controller", "as_process_controller");
    addIf(/\b(window|clipboard|keyboard|mouse|desktop|gui|user interface|ui)\b/, "as_skill_recommend", "as_window_controller", "as_clipboard_controller", "as_input_controller", "as_screenshot_capture", "as_vision_ocr", "as_vision_target", "as_vision_focus");
    addIf(/\b(screenshot|screen capture|capture screen|window screenshot|read screenshot|ui text|read ui|read interface|calculator display)\b/, "as_skill_recommend", "as_screenshot_capture", "as_window_controller", "as_file_embed", "as_vision_ocr", "as_vision_target", "as_vision_focus");
    addIf(/\b(photo|photos|pictures|image library|camera import|scene recognition|object recognition|video frame|extract frames)\b/, "as_file_metadata", "as_image_identify", "as_vision_recognize", "as_file_rename", "as_file_organize", "as_file_find_duplicates", "as_image_convert", "as_media_probe", "as_media_transform", "as_skill_recommend");
    addIf(/\b(ocr|read text from image|transcribe image text|text from screenshot|text from ui|read screenshot text)\b/, "as_vision_ocr", "as_screenshot_capture", "as_file_embed", "as_skill_recommend");
    addIf(/\b(coordinate|coordinates|pixel|pixels|bounding box|bbox|locate button|locate slider|target position|click target|drag target|slider handle|button position|control position|find apply button)\b/, "as_vision_target", "as_screenshot_capture", "as_vision_focus", "as_skill_recommend");
    addIf(/\b(display area|button state|widget state|inspect region|inspect screenshot|inspect image|detailed ui|ui state|local detail|inner elements|read exact value|read exact text)\b/, "as_vision_focus", "as_vision_target", "as_vision_ocr", "as_screenshot_capture", "as_skill_recommend");
    addIf(/\b(visual question|vision|multimodal|recognize image|describe photo|analyze photo|analyze scene|video frame analysis)\b/, "as_vision_focus", "as_vision_recognize", "as_media_probe", "as_media_transform", "as_image_identify", "as_skill_recommend");
    addIf(/\b(system info|machine info|os version|cpu|memory info|hardware info|runtime info)\b/, "as_system_info", "as_process_controller", "as_port_list");
    addIf(/\b(trade|trading|stock|stocks|commodity|commodities|crypto|broker|portfolio|market)\b/, "as_web_search", "as_multi_website_search", "as_http_request", "as_web_extract", "as_screenshot_capture", "as_agent_task");
    addIf(/\b(publish|posting|post online|cms|social media|upload content|manage online content)\b/, "as_web_extract", "as_clipboard_controller", "as_input_controller", "as_screenshot_capture", "as_file_write");
    addIf(/\b(form|forms|fill form|data entry|spreadsheet entry)\b/, "as_tabular_data", "as_structured_data", "as_clipboard_controller", "as_input_controller", "as_screenshot_capture", "as_agent_task");
    addIf(/\b(github project|pull request|pr|repository maintenance|autofix|scan codebase|push fixes)\b/, "as_git_controller", "as_project_analyze", "as_project_bug_scan", "as_agent_task", "as_project_verify");
    addIf(/\b(agentic|workflow|local machine|machine control|desktop automation|full stack of tools|computer use|operate app|control app|use calculator|click buttons|type into app)\b/, "as_skill_recommend", "as_skill", "as_window_controller", "as_screenshot_capture", "as_vision_ocr", "as_vision_target", "as_vision_focus", "as_input_controller", "as_clipboard_controller", "as_sleep", "as_tool_catalog");
    const stopwords = new Set(["the", "and", "for", "with", "from", "that", "this", "into", "your", "about", "need", "want", "help", "tool", "tools", "using", "use", "make", "show", "find", "get"]);
    if (picks.size < 6) {
        const ranked = docsSource
            .map((doc) => {
            const haystack = (0, providerUtils_1.normalize)([
                doc.name,
                doc.category,
                doc.description || "",
                doc.whenToUse || "",
                ...(doc.alternatives || []),
            ].join(" "));
            let score = 0;
            score += (0, providerUtils_1.computeFuzzyScore)(normalizedGoal, `${(0, providerUtils_1.normalize)(doc.name)} ${(0, providerUtils_1.normalize)(doc.category)}`) * 5;
            for (const word of normalizedGoal.split(/\s+/).filter((entry) => entry.length >= 3 && !stopwords.has(entry))) {
                if ((0, providerUtils_1.normalize)(doc.name).includes(word))
                    score += 3;
                else if (haystack.includes(word))
                    score += 1.2;
            }
            if (query.includes(doc.category))
                score += 1;
            return { doc, score };
        })
            .filter((entry) => entry.score > 1.25)
            .sort((left, right) => right.score - left.score || left.doc.name.localeCompare(right.doc.name))
            .slice(0, 8);
        for (const entry of ranked)
            addPick(entry.doc, entry.score);
    }
    if (picks.size === 0) {
        addByName("as_tool_help", "as_tool_catalog", "as_project_verify", "as_agent_task");
    }
    if (picks.size === 0) {
        for (const doc of docsSource.slice(0, 8))
            addPick(doc, 1);
    }
    return [...picks.values()]
        .sort((left, right) => right.score - left.score || left.order - right.order || left.doc.name.localeCompare(right.doc.name))
        .map((entry) => entry.doc);
}
//# sourceMappingURL=providerCatalog.js.map