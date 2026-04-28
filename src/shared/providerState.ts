import type { ToolsProviderController } from "@lmstudio/sdk";
import { promises as fsp } from "fs";
import * as path from "path";
import { configSchematics } from "../config";
import type { CavemanMode, ConversationStorageContext, ToolProfile } from "./providerTypes";

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fsp.stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function getWorkspaceRoot(ctl: ToolsProviderController): string {
  const config = ctl.getPluginConfig(configSchematics);
  const configured = (config.get("workspacePath") as string | undefined)?.trim();
  if (configured) return path.resolve(configured);
  try {
    const workingDir = (ctl as any).getWorkingDirectory?.();
    if (typeof workingDir === "string" && workingDir.length > 0) return path.resolve(workingDir);
  } catch {
    // Prediction processes may not have an attached working directory.
  }
  return process.cwd();
}

function parseToolProfile(value: unknown): ToolProfile | null {
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

export function normalizeToolProfile(value: unknown): ToolProfile {
  return parseToolProfile(value) || "minimal";
}

export function getDefaultToolProfile(ctl: ToolsProviderController): ToolProfile {
  return normalizeToolProfile(ctl.getPluginConfig(configSchematics).get("defaultToolProfile"));
}

export function getPluginsRootDirectory(): string {
  let current = path.resolve(__dirname);
  while (true) {
    if (
      path.basename(current).toLowerCase() === "plugins"
      && path.basename(path.dirname(current)).toLowerCase() === "extensions"
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(__dirname, "../../../../");
}

export function lmStudioRootDirectory(): string {
  return path.resolve(getPluginsRootDirectory(), "..", "..");
}

export function pluginDataDirectory(): string {
  return path.join(lmStudioRootDirectory(), "plugin-data", "vykosx", "agentic-studio");
}

export function misplacedPluginDataDirectory(): string {
  return path.join(lmStudioRootDirectory(), "extensions", "plugin-data", "vykosx", "agentic-studio");
}

export function legacyPluginStateDirectory(): string {
  return path.resolve(__dirname, "..", ".agentic-studio-state");
}

export function toolProfileStatePath(): string {
  return path.join(pluginDataDirectory(), "state", "tool-profile.json");
}

export function requestedToolsStatePath(): string {
  return path.join(pluginDataDirectory(), "state", "requested-tools.json");
}

export function promptInventoryStatePath(): string {
  return path.join(pluginDataDirectory(), "state", "prompt-inventory.json");
}

export function cavemanStatePath(): string {
  return path.join(pluginDataDirectory(), "state", "caveman-status.json");
}

export function lmStudioInternalDirectory(): string {
  return path.join(lmStudioRootDirectory(), ".internal");
}

const TOOL_PROFILE_STATE_VERSION = 2;
const REQUESTED_TOOLS_STATE_VERSION = 1;
const PROMPT_INVENTORY_STATE_VERSION = 1;
const CAVEMAN_STATE_VERSION = 1;

async function mergeDirectoryContents(sourceDir: string, targetDir: string): Promise<void> {
  await fsp.mkdir(targetDir, { recursive: true });
  const entries = await fsp.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await mergeDirectoryContents(sourcePath, targetPath);
      await fsp.rm(sourcePath, { recursive: true, force: true });
      continue;
    }
    if (entry.isFile()) {
      if (await pathExists(targetPath)) {
        const sourceStat = await fsp.stat(sourcePath);
        const targetStat = await fsp.stat(targetPath);
        if (sourceStat.mtimeMs > targetStat.mtimeMs) {
          await fsp.copyFile(sourcePath, targetPath);
        }
        await fsp.rm(sourcePath, { force: true });
        continue;
      }
      await fsp.mkdir(path.dirname(targetPath), { recursive: true });
      await fsp.rename(sourcePath, targetPath);
      continue;
    }
    await fsp.rm(sourcePath, { recursive: true, force: true });
  }
}

export async function migrateMisplacedPluginDataDirectory(): Promise<void> {
  const sourceDir = misplacedPluginDataDirectory();
  const targetDir = pluginDataDirectory();
  if (!(await pathExists(sourceDir))) return;
  await mergeDirectoryContents(sourceDir, targetDir);
  await fsp.rm(sourceDir, { recursive: true, force: true });
}

async function migrateLegacyToolProfileState(): Promise<void> {
  const legacyPath = path.join(legacyPluginStateDirectory(), "tool-profile.json");
  const targetPath = toolProfileStatePath();
  if (await pathExists(targetPath) || !(await pathExists(legacyPath))) {
    return;
  }
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.copyFile(legacyPath, targetPath);
}

export async function getCurrentConversationIdFromLmStudioState(): Promise<string | null> {
  try {
    const conversationConfigPath = path.join(lmStudioInternalDirectory(), "conversation-config.json");
    const conversationConfig = JSON.parse(await fsp.readFile(conversationConfigPath, "utf8")) as Record<string, unknown>;
    const selectedConversation = String(conversationConfig.selectedConversation || "").trim();
    return selectedConversation || null;
  } catch {
    return null;
  }
}

export function buildToolProfileScopeKey(conversationId: string | null): string | null {
  if (!conversationId) return null;
  const normalizedId = conversationId.replace(/\\/g, "/").trim();
  if (!normalizedId) return null;
  const segments = normalizedId.split("/").filter(Boolean).map(sanitizePathSegment);
  if (segments.length === 0) return null;
  if (segments.length === 1) return segments[0];
  return segments.slice(0, -1).join("/");
}

function buildRequestedToolsScopeKey(conversationId: string | null): string {
  return buildToolProfileScopeKey(conversationId) || "__global__";
}

function buildConversationPromptScopeKey(conversationId: string | null): string {
  const normalizedId = String(conversationId || "").replace(/\\/g, "/").trim();
  return normalizedId || "__global__";
}

function normalizeCavemanMode(value: unknown): CavemanMode {
  return value === "caveman" || value === "caveman_compress" ? value : "normal";
}

async function readStoredToolProfile(conversationId: string | null): Promise<ToolProfile | null> {
  try {
    await migrateMisplacedPluginDataDirectory();
    await migrateLegacyToolProfileState();
    const raw = JSON.parse(await fsp.readFile(toolProfileStatePath(), "utf8")) as Record<string, unknown>;
    if (raw.profile && !raw.byConversation) {
      await fsp.mkdir(path.dirname(toolProfileStatePath()), { recursive: true });
      await fsp.writeFile(toolProfileStatePath(), JSON.stringify({
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
        : []).filter((value): value is string => typeof value === "string" && value.length > 0);
    for (const key of keysToTry) {
      const entry = (byConversation as Record<string, unknown>)[key];
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        continue;
      }
      const parsed = parseToolProfile((entry as Record<string, unknown>).profile);
      if (parsed) return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeStoredToolProfile(profile: ToolProfile, conversationId: string | null): Promise<void> {
  await migrateMisplacedPluginDataDirectory();
  await migrateLegacyToolProfileState();
  const filePath = toolProfileStatePath();
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(await fsp.readFile(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const byConversation = raw.byConversation && typeof raw.byConversation === "object" && !Array.isArray(raw.byConversation)
    ? raw.byConversation as Record<string, unknown>
    : {};
  const updatedAt = new Date().toISOString();
  const scopeKey = buildToolProfileScopeKey(conversationId);
  if (scopeKey) {
    byConversation[scopeKey] = { profile, updatedAt };
  }
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify({
    stateVersion: TOOL_PROFILE_STATE_VERSION,
    lastProfile: profile,
    lastUpdatedAt: updatedAt,
    byConversation,
  }, null, 2), "utf8");
}

export async function getCurrentToolProfile(ctl: ToolsProviderController): Promise<ToolProfile> {
  const conversationId = await getCurrentConversationIdFromLmStudioState();
  return (await readStoredToolProfile(conversationId)) || getDefaultToolProfile(ctl);
}

function normalizeRequestedToolNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const output: string[] = [];
  for (const entry of value) {
    const normalized = String(entry || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

async function readStoredRequestedTools(conversationId: string | null): Promise<string[]> {
  try {
    await migrateMisplacedPluginDataDirectory();
    const raw = JSON.parse(await fsp.readFile(requestedToolsStatePath(), "utf8")) as Record<string, unknown>;
    const byConversation = raw.byConversation;
    if (!byConversation || typeof byConversation !== "object" || Array.isArray(byConversation)) {
      return [];
    }
    const entry = (byConversation as Record<string, unknown>)[buildRequestedToolsScopeKey(conversationId)];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }
    return normalizeRequestedToolNames((entry as Record<string, unknown>).tools);
  } catch {
    return [];
  }
}

export async function writeStoredRequestedTools(toolNames: string[], conversationId: string | null): Promise<void> {
  await migrateMisplacedPluginDataDirectory();
  const filePath = requestedToolsStatePath();
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(await fsp.readFile(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const byConversation = raw.byConversation && typeof raw.byConversation === "object" && !Array.isArray(raw.byConversation)
    ? raw.byConversation as Record<string, unknown>
    : {};
  const updatedAt = new Date().toISOString();
  byConversation[buildRequestedToolsScopeKey(conversationId)] = {
    tools: normalizeRequestedToolNames(toolNames),
    updatedAt,
  };
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify({
    stateVersion: REQUESTED_TOOLS_STATE_VERSION,
    lastUpdatedAt: updatedAt,
    byConversation,
  }, null, 2), "utf8");
}

export async function getCurrentRequestedTools(): Promise<string[]> {
  const conversationId = await getCurrentConversationIdFromLmStudioState();
  return await readStoredRequestedTools(conversationId);
}

async function readPromptInventoryState(): Promise<Record<string, unknown>> {
  try {
    await migrateMisplacedPluginDataDirectory();
    return JSON.parse(await fsp.readFile(promptInventoryStatePath(), "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function hasSeenPromptInventory(conversationId: string | null): Promise<boolean> {
  const raw = await readPromptInventoryState();
  const seenByConversation = raw.seenByConversation;
  if (!seenByConversation || typeof seenByConversation !== "object" || Array.isArray(seenByConversation)) {
    return false;
  }
  return Boolean((seenByConversation as Record<string, unknown>)[buildConversationPromptScopeKey(conversationId)]);
}

export async function markPromptInventorySeen(conversationId: string | null): Promise<void> {
  const filePath = promptInventoryStatePath();
  const raw = await readPromptInventoryState();
  const seenByConversation = raw.seenByConversation && typeof raw.seenByConversation === "object" && !Array.isArray(raw.seenByConversation)
    ? raw.seenByConversation as Record<string, unknown>
    : {};
  seenByConversation[buildConversationPromptScopeKey(conversationId)] = {
    seenAt: new Date().toISOString(),
  };
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify({
    stateVersion: PROMPT_INVENTORY_STATE_VERSION,
    seenByConversation,
  }, null, 2), "utf8");
}

export async function getLastPromptCavemanProfile(conversationId: string | null): Promise<CavemanMode | null> {
  const raw = await readPromptInventoryState();
  const modeByConversation = raw.cavemanModeByConversation;
  if (!modeByConversation || typeof modeByConversation !== "object" || Array.isArray(modeByConversation)) {
    return null;
  }
  const value = (modeByConversation as Record<string, unknown>)[buildConversationPromptScopeKey(conversationId)];
  return value === "normal" || value === "caveman" || value === "caveman_compress" ? value : null;
}

export async function writeLastPromptCavemanProfile(conversationId: string | null, mode: CavemanMode): Promise<void> {
  const filePath = promptInventoryStatePath();
  const raw = await readPromptInventoryState();
  const seenByConversation = raw.seenByConversation && typeof raw.seenByConversation === "object" && !Array.isArray(raw.seenByConversation)
    ? raw.seenByConversation as Record<string, unknown>
    : {};
  const modeByConversation = raw.cavemanModeByConversation && typeof raw.cavemanModeByConversation === "object" && !Array.isArray(raw.cavemanModeByConversation)
    ? raw.cavemanModeByConversation as Record<string, unknown>
    : {};
  modeByConversation[buildConversationPromptScopeKey(conversationId)] = mode;
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify({
    stateVersion: PROMPT_INVENTORY_STATE_VERSION,
    seenByConversation,
    cavemanModeByConversation: modeByConversation,
  }, null, 2), "utf8");
}

type CavemanStateRecord = {
  modeOverride: CavemanMode | null;
  skipNextTool: boolean;
  skipTurnStage: "idle" | "pending" | "active";
  updatedAt: string;
};

async function readStoredCavemanState(conversationId: string | null): Promise<CavemanStateRecord> {
  try {
    await migrateMisplacedPluginDataDirectory();
    const raw = JSON.parse(await fsp.readFile(cavemanStatePath(), "utf8")) as Record<string, unknown>;
    const byConversation = raw.byConversation;
    if (!byConversation || typeof byConversation !== "object" || Array.isArray(byConversation)) {
      throw new Error("missing state");
    }
    const entry = (byConversation as Record<string, unknown>)[buildConversationPromptScopeKey(conversationId)];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("missing conversation state");
    }
    const record = entry as Record<string, unknown>;
    return {
      modeOverride: record.mode === null || record.mode === undefined ? null : normalizeCavemanMode(record.mode),
      skipNextTool: record.skipNextTool === true,
      skipTurnStage: record.skipTurnStage === "pending" || record.skipTurnStage === "active" ? record.skipTurnStage : "idle",
      updatedAt: String(record.updatedAt || ""),
    };
  } catch {
    return {
      modeOverride: null,
      skipNextTool: false,
      skipTurnStage: "idle",
      updatedAt: "",
    };
  }
}

export async function getCurrentCavemanState(): Promise<CavemanStateRecord> {
  return await readStoredCavemanState(await getCurrentConversationIdFromLmStudioState());
}

export async function writeCurrentCavemanState(
  patch: Partial<Pick<CavemanStateRecord, "modeOverride" | "skipNextTool" | "skipTurnStage">>,
): Promise<CavemanStateRecord> {
  const conversationId = await getCurrentConversationIdFromLmStudioState();
  const current = await readStoredCavemanState(conversationId);
  const next: CavemanStateRecord = {
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
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(await fsp.readFile(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const byConversation = raw.byConversation && typeof raw.byConversation === "object" && !Array.isArray(raw.byConversation)
    ? raw.byConversation as Record<string, unknown>
    : {};
  byConversation[buildConversationPromptScopeKey(conversationId)] = next;
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify({
    stateVersion: CAVEMAN_STATE_VERSION,
    byConversation,
  }, null, 2), "utf8");
  return next;
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, " ").trim() || "_";
}

export function memoryFilePathFromDirectory(baseDirectory: string): string {
  return path.join(baseDirectory, "memory.json");
}

export function todoFilePathFromDirectory(baseDirectory: string): string {
  return path.join(baseDirectory, "todos.json");
}

// Storage stays global unless the active chat lives under a parent folder, in
// which case the conversation file and the parent "_shared" file participate.
export function buildConversationStorageContextFromId(conversationId: string | null): ConversationStorageContext {
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

export async function getConversationStorageContext(_root: string): Promise<ConversationStorageContext> {
  return buildConversationStorageContextFromId(await getCurrentConversationIdFromLmStudioState());
}

export async function resolveMemoryPaths(root: string, global: boolean): Promise<{
  readPaths: string[];
  writePaths: string[];
  context: ConversationStorageContext;
}> {
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

export async function resolveTodoPaths(root: string, global: boolean): Promise<{
  readPaths: string[];
  writePaths: string[];
  context: ConversationStorageContext;
}> {
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

export async function detectEnabledPluginsFromLmStudioState(): Promise<string[]> {
  try {
    const internalDir = lmStudioInternalDirectory();
    const conversationConfigPath = path.join(internalDir, "conversation-config.json");
    const conversationConfig = JSON.parse(await fsp.readFile(conversationConfigPath, "utf8")) as Record<string, unknown>;
    const selectedConversation = String(conversationConfig.selectedConversation || "");
    const uiStateDirectory = path.join(internalDir, "ui-state");
    const stateFiles = await fsp.readdir(uiStateDirectory, { withFileTypes: true }).catch(() => []);
    const candidates: string[][] = [];
    for (const entry of stateFiles) {
      if (!entry.isFile() || !/^window-\d+\.json$/i.test(entry.name)) continue;
      try {
        const statePath = path.join(uiStateDirectory, entry.name);
        const windowState = JSON.parse(await fsp.readFile(statePath, "utf8")) as Record<string, unknown>;
        const chat = (windowState.chat || {}) as Record<string, unknown>;
        const activeConversation = String(chat.activeConversationIdentifier || "");
        const perConversation = (chat.additionalShortcutPluginIdentifiersPerChatIdentifier || {}) as Record<string, unknown>;
        const selectedPlugins = perConversation[selectedConversation];
        if (Array.isArray(selectedPlugins)) {
          const normalized = selectedPlugins.filter((value): value is string => typeof value === "string");
          if (activeConversation === selectedConversation) {
            return normalized;
          }
          candidates.push(normalized);
        }
      } catch {
        continue;
      }
    }
    for (const candidate of candidates) {
      if (candidate.length > 0) return candidate;
    }
  } catch {
    // Fall through to a minimal set when LM Studio state is unavailable.
  }
  return ["vykosx/agentic-studio"];
}
