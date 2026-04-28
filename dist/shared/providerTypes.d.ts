import type { Tool } from "@lmstudio/sdk";
export type CommandResult = {
    stdout: string;
    stderr: string;
    stdoutBytes?: number;
    stderrBytes?: number;
    stdoutLines?: number;
    stderrLines?: number;
    stdoutPath?: string | null;
    stderrPath?: string | null;
    stdoutTruncated?: boolean;
    stderrTruncated?: boolean;
    workingDirectory?: string;
    exitCode: number | null;
    error: string | null;
};
export type CommandPolicy = {
    executionPolicy: "allow_all" | "allow_only";
    allowedCommands: string[];
    forbiddenCommands: string[];
    disableBlacklistCommands: string[];
    testMode: boolean;
};
export type SubAgentMessage = {
    role: "system" | "user" | "assistant" | "tool";
    content: string | null;
    tool_call_id?: string;
    tool_calls?: SubAgentToolCall[];
};
export type SubAgentToolCall = {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
};
export type SubAgentChatResponse = {
    choices: Array<{
        message: SubAgentMessage;
        finish_reason: string | null;
    }>;
};
export type SubAgentFunctionDefinition = {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
};
export type ToolDocumentation = {
    name: string;
    plugin: string;
    pluginLabel?: string;
    category: string;
    description: string;
    whenToUse?: string;
    example?: string;
    alternatives?: string[];
    availability?: "live" | "installed_only" | "profile_switch_required";
    availabilityReason?: string;
    sourceKind?: "plugin_tool";
};
export type PluginInventoryEntry = {
    plugin: string;
    pluginLabel: string;
    enabled: boolean;
    parsedToolCount: number;
    capabilityKind: "tools" | "non_tool_plugin" | "unknown";
    note: string;
};
export type ToolProfile = "minimal" | "file_management" | "multimedia" | "web" | "research" | "data" | "desktop" | "system_admin" | "automation" | "development" | "balanced" | "full";
export type CavemanMode = "normal" | "caveman" | "caveman_compress";
export type FileWatcherSnapshotEntry = {
    path: string;
    type: "file" | "directory" | "symlink";
    sizeBytes: number;
    modifiedMs: number;
};
export type FileWatcherDefinition = {
    id: string;
    directory: string;
    recursive: boolean;
    includeHidden: boolean;
    createdAt: string;
    updatedAt: string;
    snapshot: FileWatcherSnapshotEntry[];
};
export type ConversationStorageContext = {
    conversationId: string | null;
    conversationFolderPath: string | null;
    conversationDirectory: string;
    parentFolderName: string | null;
    parentSharedDirectory: string | null;
    defaultDirectory: string;
    mode: "conversation_only" | "conversation_plus_parent" | "global";
};
export type RuntimeToolDiscoveryArgs = {
    registeredTools: Tool[];
    pluginId: string;
    currentProfile: ToolProfile;
    requestedProfile: ToolProfile;
};
//# sourceMappingURL=providerTypes.d.ts.map