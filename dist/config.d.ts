export declare const configSchematics: import("@lmstudio/sdk").ConfigSchematics<{
    defaultToolProfile: {
        key: "defaultToolProfile";
        type: string;
        valueTypeKey: "select";
    };
} & {
    informAgentOfAllTools: {
        key: "informAgentOfAllTools";
        type: boolean;
        valueTypeKey: "boolean";
    };
} & {
    allowIndividualToolRequests: {
        key: "allowIndividualToolRequests";
        type: boolean;
        valueTypeKey: "boolean";
    };
} & {
    enableToolAliases: {
        key: "enableToolAliases";
        type: boolean;
        valueTypeKey: "boolean";
    };
} & {
    enablePerAppAutomationGuidance: {
        key: "enablePerAppAutomationGuidance";
        type: boolean;
        valueTypeKey: "boolean";
    };
} & {
    cavemanSkillProfile: {
        key: "cavemanSkillProfile";
        type: string;
        valueTypeKey: "select";
    };
} & {
    cavemanifyToolResults: {
        key: "cavemanifyToolResults";
        type: boolean;
        valueTypeKey: "boolean";
    };
} & {
    allowFullFilesystemAccess: {
        key: "allowFullFilesystemAccess";
        type: boolean;
        valueTypeKey: "boolean";
    };
} & {
    allowAutoExecution: {
        key: "allowAutoExecution";
        type: boolean;
        valueTypeKey: "boolean";
    };
} & {
    executionPolicy: {
        key: "executionPolicy";
        type: string;
        valueTypeKey: "select";
    };
} & {
    allowedCommands: {
        key: "allowedCommands";
        type: string;
        valueTypeKey: "string";
    };
} & {
    forbiddenCommands: {
        key: "forbiddenCommands";
        type: string;
        valueTypeKey: "string";
    };
} & {
    disableBlacklistCommands: {
        key: "disableBlacklistCommands";
        type: string;
        valueTypeKey: "string";
    };
} & {
    testMode: {
        key: "testMode";
        type: boolean;
        valueTypeKey: "boolean";
    };
} & {
    fileDeletionMode: {
        key: "fileDeletionMode";
        type: string;
        valueTypeKey: "select";
    };
} & {
    directoryDeleteConfirmationCount: {
        key: "directoryDeleteConfirmationCount";
        type: number;
        valueTypeKey: "numeric";
    };
} & {
    zstdCompressionLevel: {
        key: "zstdCompressionLevel";
        type: number;
        valueTypeKey: "numeric";
    };
} & {
    watcherDefaultLimit: {
        key: "watcherDefaultLimit";
        type: number;
        valueTypeKey: "numeric";
    };
} & {
    workspacePath: {
        key: "workspacePath";
        type: string;
        valueTypeKey: "string";
    };
} & {
    screenshotDirectory: {
        key: "screenshotDirectory";
        type: string;
        valueTypeKey: "string";
    };
} & {
    compilerPreference: {
        key: "compilerPreference";
        type: string;
        valueTypeKey: "select";
    };
} & {
    lmStudioEndpoint: {
        key: "lmStudioEndpoint";
        type: string;
        valueTypeKey: "string";
    };
} & {
    defaultTimeoutMs: {
        key: "defaultTimeoutMs";
        type: number;
        valueTypeKey: "numeric";
    };
} & {
    maxOutputBytes: {
        key: "maxOutputBytes";
        type: number;
        valueTypeKey: "numeric";
    };
} & {
    browserAutomationBackend: {
        key: "browserAutomationBackend";
        type: string;
        valueTypeKey: "select";
    };
} & {
    camofoxHomeDirectory: {
        key: "camofoxHomeDirectory";
        type: string;
        valueTypeKey: "string";
    };
} & {
    firecrawlApiKey: {
        key: "firecrawlApiKey";
        type: string;
        valueTypeKey: "string";
    };
} & {
    firecrawlBaseUrl: {
        key: "firecrawlBaseUrl";
        type: string;
        valueTypeKey: "string";
    };
} & {
    enableSecondaryAgent: {
        key: "enableSecondaryAgent";
        type: boolean;
        valueTypeKey: "boolean";
    };
} & {
    subAgentModelId: {
        key: "subAgentModelId";
        type: string;
        valueTypeKey: "string";
    };
} & {
    subAgentMaxIterations: {
        key: "subAgentMaxIterations";
        type: number;
        valueTypeKey: "numeric";
    };
} & {
    subAgentPermissions: {
        key: "subAgentPermissions";
        type: string;
        valueTypeKey: "select";
    };
} & {
    enableAutoDebug: {
        key: "enableAutoDebug";
        type: boolean;
        valueTypeKey: "boolean";
    };
} & {
    subAgentProfiles: {
        key: "subAgentProfiles";
        type: string;
        valueTypeKey: "string";
    };
} & {
    subAgentShowFullCode: {
        key: "subAgentShowFullCode";
        type: boolean;
        valueTypeKey: "boolean";
    };
} & {
    subAgentMaxDepth: {
        key: "subAgentMaxDepth";
        type: number;
        valueTypeKey: "numeric";
    };
} & {
    additionalSearchPaths: {
        key: "additionalSearchPaths";
        type: string;
        valueTypeKey: "string";
    };
} & {
    pythonInterpreter: {
        key: "pythonInterpreter";
        type: string;
        valueTypeKey: "string";
    };
} & {
    shellPath: {
        key: "shellPath";
        type: string;
        valueTypeKey: "string";
    };
} & {
    denoExecutable: {
        key: "denoExecutable";
        type: string;
        valueTypeKey: "string";
    };
} & {
    nodeExecutable: {
        key: "nodeExecutable";
        type: string;
        valueTypeKey: "string";
    };
} & {
    vswherePath: {
        key: "vswherePath";
        type: string;
        valueTypeKey: "string";
    };
} & {
    msvcVcVarsPath: {
        key: "msvcVcVarsPath";
        type: string;
        valueTypeKey: "string";
    };
} & {
    exiftoolPath: {
        key: "exiftoolPath";
        type: string;
        valueTypeKey: "string";
    };
} & {
    ffmpegPath: {
        key: "ffmpegPath";
        type: string;
        valueTypeKey: "string";
    };
} & {
    ffprobePath: {
        key: "ffprobePath";
        type: string;
        valueTypeKey: "string";
    };
} & {
    ytDlpPath: {
        key: "ytDlpPath";
        type: string;
        valueTypeKey: "string";
    };
} & {
    qbittorrentUrl: {
        key: "qbittorrentUrl";
        type: string;
        valueTypeKey: "string";
    };
} & {
    qbittorrentUsername: {
        key: "qbittorrentUsername";
        type: string;
        valueTypeKey: "string";
    };
} & {
    qbittorrentPassword: {
        key: "qbittorrentPassword";
        type: string;
        valueTypeKey: "string";
    };
} & {
    seerrUrl: {
        key: "seerrUrl";
        type: string;
        valueTypeKey: "string";
    };
} & {
    seerrApiKey: {
        key: "seerrApiKey";
        type: string;
        valueTypeKey: "string";
    };
} & {
    pdfToTextPath: {
        key: "pdfToTextPath";
        type: string;
        valueTypeKey: "string";
    };
} & {
    autoHotkeyPath: {
        key: "autoHotkeyPath";
        type: string;
        valueTypeKey: "string";
    };
} & {
    libreHardwareMonitorPath: {
        key: "libreHardwareMonitorPath";
        type: string;
        valueTypeKey: "string";
    };
} & {
    imageMagickPath: {
        key: "imageMagickPath";
        type: string;
        valueTypeKey: "string";
    };
} & {
    mkvmergePath: {
        key: "mkvmergePath";
        type: string;
        valueTypeKey: "string";
    };
} & {
    mkvpropeditPath: {
        key: "mkvpropeditPath";
        type: string;
        valueTypeKey: "string";
    };
} & {
    mkvextractPath: {
        key: "mkvextractPath";
        type: string;
        valueTypeKey: "string";
    };
} & {
    psqlPath: {
        key: "psqlPath";
        type: string;
        valueTypeKey: "string";
    };
} & {
    mysqlPath: {
        key: "mysqlPath";
        type: string;
        valueTypeKey: "string";
    };
}>;
//# sourceMappingURL=config.d.ts.map