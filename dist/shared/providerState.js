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
exports.getWorkspaceRoot = getWorkspaceRoot;
exports.normalizeToolProfile = normalizeToolProfile;
exports.getDefaultToolProfile = getDefaultToolProfile;
exports.getPluginsRootDirectory = getPluginsRootDirectory;
exports.lmStudioRootDirectory = lmStudioRootDirectory;
exports.pluginDataDirectory = pluginDataDirectory;
exports.misplacedPluginDataDirectory = misplacedPluginDataDirectory;
exports.legacyPluginStateDirectory = legacyPluginStateDirectory;
exports.toolProfileStatePath = toolProfileStatePath;
exports.requestedToolsStatePath = requestedToolsStatePath;
exports.promptInventoryStatePath = promptInventoryStatePath;
exports.cavemanStatePath = cavemanStatePath;
exports.lmStudioInternalDirectory = lmStudioInternalDirectory;
exports.migrateMisplacedPluginDataDirectory = migrateMisplacedPluginDataDirectory;
exports.getCurrentConversationIdFromLmStudioState = getCurrentConversationIdFromLmStudioState;
exports.buildToolProfileScopeKey = buildToolProfileScopeKey;
exports.writeStoredToolProfile = writeStoredToolProfile;
exports.getCurrentToolProfile = getCurrentToolProfile;
exports.writeStoredRequestedTools = writeStoredRequestedTools;
exports.getCurrentRequestedTools = getCurrentRequestedTools;
exports.hasSeenPromptInventory = hasSeenPromptInventory;
exports.markPromptInventorySeen = markPromptInventorySeen;
exports.getLastPromptCavemanProfile = getLastPromptCavemanProfile;
exports.writeLastPromptCavemanProfile = writeLastPromptCavemanProfile;
exports.getCurrentCavemanState = getCurrentCavemanState;
exports.writeCurrentCavemanState = writeCurrentCavemanState;
exports.memoryFilePathFromDirectory = memoryFilePathFromDirectory;
exports.todoFilePathFromDirectory = todoFilePathFromDirectory;
exports.buildConversationStorageContextFromId = buildConversationStorageContextFromId;
exports.getConversationStorageContext = getConversationStorageContext;
exports.resolveMemoryPaths = resolveMemoryPaths;
exports.resolveTodoPaths = resolveTodoPaths;
exports.detectEnabledPluginsFromLmStudioState = detectEnabledPluginsFromLmStudioState;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const config_1 = require("../config");
async function pathExists(targetPath) {
    try {
        await fs_1.promises.stat(targetPath);
        return true;
    }
    catch {
        return false;
    }
}
function getWorkspaceRoot(ctl) {
    const config = ctl.getPluginConfig(config_1.configSchematics);
    const configured = config.get("workspacePath")?.trim();
    if (configured)
        return path.resolve(configured);
    try {
        const workingDir = ctl.getWorkingDirectory?.();
        if (typeof workingDir === "string" && workingDir.length > 0)
            return path.resolve(workingDir);
    }
    catch {
        // Prediction processes may not have an attached working directory.
    }
    return process.cwd();
}
function parseToolProfile(value) {
    switch (value) {
        case "minimal":
        case "file_management":
        case "multimedia":
        case "web":
        case "research":
        case "data":
        case "desktop":
        case "system_admin":
        case "automation":
        case "development":
        case "balanced":
        case "full":
            return value;
        default:
            return null;
    }
}
function normalizeToolProfile(value) {
    return parseToolProfile(value) || "minimal";
}
function getDefaultToolProfile(ctl) {
    return normalizeToolProfile(ctl.getPluginConfig(config_1.configSchematics).get("defaultToolProfile"));
}
function getPluginsRootDirectory() {
    let current = path.resolve(__dirname);
    while (true) {
        if (path.basename(current).toLowerCase() === "plugins"
            && path.basename(path.dirname(current)).toLowerCase() === "extensions") {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current)
            break;
        current = parent;
    }
    return path.resolve(__dirname, "../../../../");
}
function lmStudioRootDirectory() {
    return path.resolve(getPluginsRootDirectory(), "..", "..");
}
function pluginDataDirectory() {
    return path.join(lmStudioRootDirectory(), "plugin-data", "vykosx", "agentic-studio");
}
function misplacedPluginDataDirectory() {
    return path.join(lmStudioRootDirectory(), "extensions", "plugin-data", "vykosx", "agentic-studio");
}
function legacyPluginStateDirectory() {
    return path.resolve(__dirname, "..", ".agentic-studio-state");
}
function toolProfileStatePath() {
    return path.join(pluginDataDirectory(), "state", "tool-profile.json");
}
function requestedToolsStatePath() {
    return path.join(pluginDataDirectory(), "state", "requested-tools.json");
}
function promptInventoryStatePath() {
    return path.join(pluginDataDirectory(), "state", "prompt-inventory.json");
}
function cavemanStatePath() {
    return path.join(pluginDataDirectory(), "state", "caveman-status.json");
}
function lmStudioInternalDirectory() {
    return path.join(lmStudioRootDirectory(), ".internal");
}
const TOOL_PROFILE_STATE_VERSION = 2;
const REQUESTED_TOOLS_STATE_VERSION = 1;
const PROMPT_INVENTORY_STATE_VERSION = 1;
const CAVEMAN_STATE_VERSION = 1;
async function mergeDirectoryContents(sourceDir, targetDir) {
    await fs_1.promises.mkdir(targetDir, { recursive: true });
    const entries = await fs_1.promises.readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);
        if (entry.isDirectory()) {
            await mergeDirectoryContents(sourcePath, targetPath);
            await fs_1.promises.rm(sourcePath, { recursive: true, force: true });
            continue;
        }
        if (entry.isFile()) {
            if (await pathExists(targetPath)) {
                const sourceStat = await fs_1.promises.stat(sourcePath);
                const targetStat = await fs_1.promises.stat(targetPath);
                if (sourceStat.mtimeMs > targetStat.mtimeMs) {
                    await fs_1.promises.copyFile(sourcePath, targetPath);
                }
                await fs_1.promises.rm(sourcePath, { force: true });
                continue;
            }
            await fs_1.promises.mkdir(path.dirname(targetPath), { recursive: true });
            await fs_1.promises.rename(sourcePath, targetPath);
            continue;
        }
        await fs_1.promises.rm(sourcePath, { recursive: true, force: true });
    }
}
async function migrateMisplacedPluginDataDirectory() {
    const sourceDir = misplacedPluginDataDirectory();
    const targetDir = pluginDataDirectory();
    if (!(await pathExists(sourceDir)))
        return;
    await mergeDirectoryContents(sourceDir, targetDir);
    await fs_1.promises.rm(sourceDir, { recursive: true, force: true });
}
async function migrateLegacyToolProfileState() {
    const legacyPath = path.join(legacyPluginStateDirectory(), "tool-profile.json");
    const targetPath = toolProfileStatePath();
    if (await pathExists(targetPath) || !(await pathExists(legacyPath))) {
        return;
    }
    await fs_1.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs_1.promises.copyFile(legacyPath, targetPath);
}
async function getCurrentConversationIdFromLmStudioState() {
    try {
        const conversationConfigPath = path.join(lmStudioInternalDirectory(), "conversation-config.json");
        const conversationConfig = JSON.parse(await fs_1.promises.readFile(conversationConfigPath, "utf8"));
        const selectedConversation = String(conversationConfig.selectedConversation || "").trim();
        return selectedConversation || null;
    }
    catch {
        return null;
    }
}
function buildToolProfileScopeKey(conversationId) {
    if (!conversationId)
        return null;
    const normalizedId = conversationId.replace(/\\/g, "/").trim();
    if (!normalizedId)
        return null;
    const segments = normalizedId.split("/").filter(Boolean).map(sanitizePathSegment);
    if (segments.length === 0)
        return null;
    if (segments.length === 1)
        return segments[0];
    return segments.slice(0, -1).join("/");
}
function buildRequestedToolsScopeKey(conversationId) {
    return buildToolProfileScopeKey(conversationId) || "__global__";
}
function buildConversationPromptScopeKey(conversationId) {
    const normalizedId = String(conversationId || "").replace(/\\/g, "/").trim();
    return normalizedId || "__global__";
}
function normalizeCavemanMode(value) {
    return value === "caveman" || value === "caveman_compress" ? value : "normal";
}
async function readStoredToolProfile(conversationId) {
    try {
        await migrateMisplacedPluginDataDirectory();
        await migrateLegacyToolProfileState();
        const raw = JSON.parse(await fs_1.promises.readFile(toolProfileStatePath(), "utf8"));
        if (raw.profile && !raw.byConversation) {
            await fs_1.promises.mkdir(path.dirname(toolProfileStatePath()), { recursive: true });
            await fs_1.promises.writeFile(toolProfileStatePath(), JSON.stringify({
                stateVersion: TOOL_PROFILE_STATE_VERSION,
                lastProfile: normalizeToolProfile(raw.profile),
                lastUpdatedAt: new Date().toISOString(),
                byConversation: {},
            }, null, 2), "utf8");
        }
        const byConversation = raw.byConversation;
        if (!byConversation || typeof byConversation !== "object" || Array.isArray(byConversation)) {
            return null;
        }
        const scopeKey = buildToolProfileScopeKey(conversationId);
        const keysToTry = (scopeKey && scopeKey !== conversationId
            ? [scopeKey, conversationId]
            : conversationId
                ? [conversationId]
                : []).filter((value) => typeof value === "string" && value.length > 0);
        for (const key of keysToTry) {
            const entry = byConversation[key];
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
                continue;
            }
            const parsed = parseToolProfile(entry.profile);
            if (parsed)
                return parsed;
        }
        return null;
    }
    catch {
        return null;
    }
}
async function writeStoredToolProfile(profile, conversationId) {
    await migrateMisplacedPluginDataDirectory();
    await migrateLegacyToolProfileState();
    const filePath = toolProfileStatePath();
    let raw = {};
    try {
        raw = JSON.parse(await fs_1.promises.readFile(filePath, "utf8"));
    }
    catch {
        raw = {};
    }
    const byConversation = raw.byConversation && typeof raw.byConversation === "object" && !Array.isArray(raw.byConversation)
        ? raw.byConversation
        : {};
    const updatedAt = new Date().toISOString();
    const scopeKey = buildToolProfileScopeKey(conversationId);
    if (scopeKey) {
        byConversation[scopeKey] = { profile, updatedAt };
    }
    await fs_1.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs_1.promises.writeFile(filePath, JSON.stringify({
        stateVersion: TOOL_PROFILE_STATE_VERSION,
        lastProfile: profile,
        lastUpdatedAt: updatedAt,
        byConversation,
    }, null, 2), "utf8");
}
async function getCurrentToolProfile(ctl) {
    const conversationId = await getCurrentConversationIdFromLmStudioState();
    return (await readStoredToolProfile(conversationId)) || getDefaultToolProfile(ctl);
}
function normalizeRequestedToolNames(value) {
    if (!Array.isArray(value))
        return [];
    const seen = new Set();
    const output = [];
    for (const entry of value) {
        const normalized = String(entry || "").trim();
        if (!normalized || seen.has(normalized))
            continue;
        seen.add(normalized);
        output.push(normalized);
    }
    return output;
}
async function readStoredRequestedTools(conversationId) {
    try {
        await migrateMisplacedPluginDataDirectory();
        const raw = JSON.parse(await fs_1.promises.readFile(requestedToolsStatePath(), "utf8"));
        const byConversation = raw.byConversation;
        if (!byConversation || typeof byConversation !== "object" || Array.isArray(byConversation)) {
            return [];
        }
        const entry = byConversation[buildRequestedToolsScopeKey(conversationId)];
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            return [];
        }
        return normalizeRequestedToolNames(entry.tools);
    }
    catch {
        return [];
    }
}
async function writeStoredRequestedTools(toolNames, conversationId) {
    await migrateMisplacedPluginDataDirectory();
    const filePath = requestedToolsStatePath();
    let raw = {};
    try {
        raw = JSON.parse(await fs_1.promises.readFile(filePath, "utf8"));
    }
    catch {
        raw = {};
    }
    const byConversation = raw.byConversation && typeof raw.byConversation === "object" && !Array.isArray(raw.byConversation)
        ? raw.byConversation
        : {};
    const updatedAt = new Date().toISOString();
    byConversation[buildRequestedToolsScopeKey(conversationId)] = {
        tools: normalizeRequestedToolNames(toolNames),
        updatedAt,
    };
    await fs_1.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs_1.promises.writeFile(filePath, JSON.stringify({
        stateVersion: REQUESTED_TOOLS_STATE_VERSION,
        lastUpdatedAt: updatedAt,
        byConversation,
    }, null, 2), "utf8");
}
async function getCurrentRequestedTools() {
    const conversationId = await getCurrentConversationIdFromLmStudioState();
    return await readStoredRequestedTools(conversationId);
}
async function readPromptInventoryState() {
    try {
        await migrateMisplacedPluginDataDirectory();
        return JSON.parse(await fs_1.promises.readFile(promptInventoryStatePath(), "utf8"));
    }
    catch {
        return {};
    }
}
async function hasSeenPromptInventory(conversationId) {
    const raw = await readPromptInventoryState();
    const seenByConversation = raw.seenByConversation;
    if (!seenByConversation || typeof seenByConversation !== "object" || Array.isArray(seenByConversation)) {
        return false;
    }
    return Boolean(seenByConversation[buildConversationPromptScopeKey(conversationId)]);
}
async function markPromptInventorySeen(conversationId) {
    const filePath = promptInventoryStatePath();
    const raw = await readPromptInventoryState();
    const seenByConversation = raw.seenByConversation && typeof raw.seenByConversation === "object" && !Array.isArray(raw.seenByConversation)
        ? raw.seenByConversation
        : {};
    seenByConversation[buildConversationPromptScopeKey(conversationId)] = {
        seenAt: new Date().toISOString(),
    };
    await fs_1.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs_1.promises.writeFile(filePath, JSON.stringify({
        stateVersion: PROMPT_INVENTORY_STATE_VERSION,
        seenByConversation,
    }, null, 2), "utf8");
}
async function getLastPromptCavemanProfile(conversationId) {
    const raw = await readPromptInventoryState();
    const modeByConversation = raw.cavemanModeByConversation;
    if (!modeByConversation || typeof modeByConversation !== "object" || Array.isArray(modeByConversation)) {
        return null;
    }
    const value = modeByConversation[buildConversationPromptScopeKey(conversationId)];
    return value === "normal" || value === "caveman" || value === "caveman_compress" ? value : null;
}
async function writeLastPromptCavemanProfile(conversationId, mode) {
    const filePath = promptInventoryStatePath();
    const raw = await readPromptInventoryState();
    const seenByConversation = raw.seenByConversation && typeof raw.seenByConversation === "object" && !Array.isArray(raw.seenByConversation)
        ? raw.seenByConversation
        : {};
    const modeByConversation = raw.cavemanModeByConversation && typeof raw.cavemanModeByConversation === "object" && !Array.isArray(raw.cavemanModeByConversation)
        ? raw.cavemanModeByConversation
        : {};
    modeByConversation[buildConversationPromptScopeKey(conversationId)] = mode;
    await fs_1.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs_1.promises.writeFile(filePath, JSON.stringify({
        stateVersion: PROMPT_INVENTORY_STATE_VERSION,
        seenByConversation,
        cavemanModeByConversation: modeByConversation,
    }, null, 2), "utf8");
}
async function readStoredCavemanState(conversationId) {
    try {
        await migrateMisplacedPluginDataDirectory();
        const raw = JSON.parse(await fs_1.promises.readFile(cavemanStatePath(), "utf8"));
        const byConversation = raw.byConversation;
        if (!byConversation || typeof byConversation !== "object" || Array.isArray(byConversation)) {
            throw new Error("missing state");
        }
        const entry = byConversation[buildConversationPromptScopeKey(conversationId)];
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            throw new Error("missing conversation state");
        }
        const record = entry;
        return {
            modeOverride: record.mode === null || record.mode === undefined ? null : normalizeCavemanMode(record.mode),
            skipNextTool: record.skipNextTool === true,
            skipTurnStage: record.skipTurnStage === "pending" || record.skipTurnStage === "active" ? record.skipTurnStage : "idle",
            updatedAt: String(record.updatedAt || ""),
        };
    }
    catch {
        return {
            modeOverride: null,
            skipNextTool: false,
            skipTurnStage: "idle",
            updatedAt: "",
        };
    }
}
async function getCurrentCavemanState() {
    return await readStoredCavemanState(await getCurrentConversationIdFromLmStudioState());
}
async function writeCurrentCavemanState(patch) {
    const conversationId = await getCurrentConversationIdFromLmStudioState();
    const current = await readStoredCavemanState(conversationId);
    const next = {
        modeOverride: patch.modeOverride !== undefined
            ? (patch.modeOverride === null ? null : normalizeCavemanMode(patch.modeOverride))
            : current.modeOverride,
        skipNextTool: patch.skipNextTool !== undefined ? patch.skipNextTool : current.skipNextTool,
        skipTurnStage: patch.skipTurnStage === "pending" || patch.skipTurnStage === "active" || patch.skipTurnStage === "idle"
            ? patch.skipTurnStage
            : current.skipTurnStage,
        updatedAt: new Date().toISOString(),
    };
    const filePath = cavemanStatePath();
    let raw = {};
    try {
        raw = JSON.parse(await fs_1.promises.readFile(filePath, "utf8"));
    }
    catch {
        raw = {};
    }
    const byConversation = raw.byConversation && typeof raw.byConversation === "object" && !Array.isArray(raw.byConversation)
        ? raw.byConversation
        : {};
    byConversation[buildConversationPromptScopeKey(conversationId)] = next;
    await fs_1.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs_1.promises.writeFile(filePath, JSON.stringify({
        stateVersion: CAVEMAN_STATE_VERSION,
        byConversation,
    }, null, 2), "utf8");
    return next;
}
function sanitizePathSegment(value) {
    return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, " ").trim() || "_";
}
function memoryFilePathFromDirectory(baseDirectory) {
    return path.join(baseDirectory, "memory.json");
}
function todoFilePathFromDirectory(baseDirectory) {
    return path.join(baseDirectory, "todos.json");
}
// Storage stays global unless the active chat lives under a parent folder, in
// which case the conversation file and the parent "_shared" file participate.
function buildConversationStorageContextFromId(conversationId) {
    const storageRoot = pluginDataDirectory();
    const defaultDirectory = path.join(storageRoot, "default");
    if (!conversationId) {
        return {
            conversationId: null,
            conversationFolderPath: null,
            conversationDirectory: path.join(storageRoot, "conversations", "_no_conversation"),
            parentFolderName: null,
            parentSharedDirectory: null,
            defaultDirectory,
            mode: "global",
        };
    }
    const normalizedId = conversationId.replace(/\\/g, "/");
    const segments = normalizedId.split("/").filter(Boolean).map(sanitizePathSegment);
    const conversationDirectory = path.join(storageRoot, "conversations", ...segments);
    const parentSegments = segments.slice(0, -1);
    const parentFolderName = parentSegments.length > 0 ? parentSegments[parentSegments.length - 1] : null;
    const parentSharedDirectory = parentSegments.length > 0
        ? path.join(storageRoot, "conversations", ...parentSegments, "_shared")
        : null;
    return {
        conversationId,
        conversationFolderPath: parentSegments.length > 0 ? parentSegments.join("/") : null,
        conversationDirectory,
        parentFolderName,
        parentSharedDirectory,
        defaultDirectory,
        mode: parentSharedDirectory ? "conversation_plus_parent" : "global",
    };
}
async function getConversationStorageContext(_root) {
    return buildConversationStorageContextFromId(await getCurrentConversationIdFromLmStudioState());
}
async function resolveMemoryPaths(root, global) {
    const context = await getConversationStorageContext(root);
    if (global || !context.parentSharedDirectory) {
        const filePath = memoryFilePathFromDirectory(context.defaultDirectory);
        return { readPaths: [filePath], writePaths: [filePath], context: { ...context, mode: "global" } };
    }
    return {
        readPaths: [
            memoryFilePathFromDirectory(context.conversationDirectory),
            memoryFilePathFromDirectory(context.parentSharedDirectory),
        ],
        writePaths: [
            memoryFilePathFromDirectory(context.conversationDirectory),
            memoryFilePathFromDirectory(context.parentSharedDirectory),
        ],
        context,
    };
}
async function resolveTodoPaths(root, global) {
    const context = await getConversationStorageContext(root);
    if (global || !context.parentSharedDirectory) {
        const filePath = todoFilePathFromDirectory(context.defaultDirectory);
        return { readPaths: [filePath], writePaths: [filePath], context: { ...context, mode: "global" } };
    }
    return {
        readPaths: [
            todoFilePathFromDirectory(context.conversationDirectory),
            todoFilePathFromDirectory(context.parentSharedDirectory),
        ],
        writePaths: [
            todoFilePathFromDirectory(context.conversationDirectory),
            todoFilePathFromDirectory(context.parentSharedDirectory),
        ],
        context,
    };
}
async function detectEnabledPluginsFromLmStudioState() {
    try {
        const internalDir = lmStudioInternalDirectory();
        const conversationConfigPath = path.join(internalDir, "conversation-config.json");
        const conversationConfig = JSON.parse(await fs_1.promises.readFile(conversationConfigPath, "utf8"));
        const selectedConversation = String(conversationConfig.selectedConversation || "");
        const uiStateDirectory = path.join(internalDir, "ui-state");
        const stateFiles = await fs_1.promises.readdir(uiStateDirectory, { withFileTypes: true }).catch(() => []);
        const candidates = [];
        for (const entry of stateFiles) {
            if (!entry.isFile() || !/^window-\d+\.json$/i.test(entry.name))
                continue;
            try {
                const statePath = path.join(uiStateDirectory, entry.name);
                const windowState = JSON.parse(await fs_1.promises.readFile(statePath, "utf8"));
                const chat = (windowState.chat || {});
                const activeConversation = String(chat.activeConversationIdentifier || "");
                const perConversation = (chat.additionalShortcutPluginIdentifiersPerChatIdentifier || {});
                const selectedPlugins = perConversation[selectedConversation];
                if (Array.isArray(selectedPlugins)) {
                    const normalized = selectedPlugins.filter((value) => typeof value === "string");
                    if (activeConversation === selectedConversation) {
                        return normalized;
                    }
                    candidates.push(normalized);
                }
            }
            catch {
                continue;
            }
        }
        for (const candidate of candidates) {
            if (candidate.length > 0)
                return candidate;
        }
    }
    catch {
        // Fall through to a minimal set when LM Studio state is unavailable.
    }
    return ["vykosx/agentic-studio"];
}
//# sourceMappingURL=providerState.js.map