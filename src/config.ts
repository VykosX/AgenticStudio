import { createConfigSchematics } from "@lmstudio/sdk";

export const configSchematics = createConfigSchematics()
  .field(
    "defaultToolProfile",
    "select",
    {
      displayName: "Default Tool Profile",
      subtitle: "Controls how many agentic-studio tools are registered by default for new predictions. Smaller profiles reduce prompt token overhead.",
      options: [
        { displayName: "Minimal", value: "minimal" },
        { displayName: "File Management", value: "file_management" },
        { displayName: "Multimedia", value: "multimedia" },
        { displayName: "Web", value: "web" },
        { displayName: "Research", value: "research" },
        { displayName: "Data", value: "data" },
        { displayName: "Desktop", value: "desktop" },
        { displayName: "System Admin", value: "system_admin" },
        { displayName: "Automation", value: "automation" },
        { displayName: "Development", value: "development" },
        { displayName: "Balanced", value: "balanced" },
        { displayName: "Full", value: "full" },
      ],
    },
    "minimal"
  )
  .field(
    "informAgentOfAllTools",
    "boolean",
    {
      displayName: "Inform Agent of All Tools",
      subtitle: "Inject a first-turn tool/profile map for fresh conversations. Disable this to save prompt context when you do not want the agent pre-informed about every public tool.",
    },
    true
  )
  .field(
    "allowIndividualToolRequests",
    "boolean",
    {
      displayName: "Allow individual tool requests",
      subtitle: "Expose as_request_tool so the model can enable specific agentic-studio tools one at a time for later turns without switching the whole profile. Keep this on to favor one-off tool access; switch profiles when a category of tools will be used repeatedly.",
    },
    true
  )
  .field(
    "enableToolAliases",
    "boolean",
    {
      displayName: "Enable Tool Aliases",
      subtitle: "Expose compact ax_* helper tools that map to the consolidated as_* controllers. Leave off for the leanest tool list.",
    },
    false
  )
  .field(
    "enablePerAppAutomationGuidance",
    "boolean",
    {
      displayName: "Per-App Automation Guidance",
      subtitle: "Expose the dedicated single-app desktop automation skill with supported-app notes such as Calculator. Disable this to force more generic screenshot, OCR, control, and raw input workflows.",
    },
    true
  )
  .field(
    "cavemanSkillProfile",
    "select",
    {
      displayName: "Caveman Skill Profile",
      subtitle: "Optionally inject the built-in caveman skill immediately to reduce prompt verbosity in every turn.",
      options: [
        { displayName: "Disabled", value: "normal" },
        { displayName: "Caveman", value: "caveman" },
        { displayName: "Caveman + Compression", value: "caveman_compress" },
      ],
    },
    "normal"
  )
  .field(
    "cavemanifyToolResults",
    "boolean",
    {
      displayName: "Caveman-ify Tool Results",
      subtitle: "Shorten agent-facing explanatory strings in JSON tool results while preserving literal data such as file contents, stdout, stderr, database rows, web results, and errors.",
    },
    false
  )
  .field(
    "allowFullFilesystemAccess",
    "boolean",
    {
      displayName: "Allow Full Filesystem Access",
      subtitle: "When enabled, file tools may access paths outside the workspace root. Leave off unless you intentionally want whole-drive automation.",
    },
    false
  )
  .field(
    "allowAutoExecution",
    "boolean",
    {
      displayName: "Allow Automatic Execution",
      subtitle: "Allow command-backed helper tools to execute local commands when the command policy permits them.",
    },
    true
  )
  .field(
    "executionPolicy",
    "select",
    {
      displayName: "Execution Policy",
      subtitle: "Choose whether command-backed helpers allow commands by default or require a whitelist.",
      options: [
        { displayName: "Allow All (Block Blacklist)", value: "allow_all" },
        { displayName: "Allow Only (Strict Whitelist)", value: "allow_only" },
      ],
    },
    "allow_all"
  )
  .field(
    "allowedCommands",
    "string",
    {
      displayName: "Command Shell Whitelist",
      isParagraph: true,
      hint: "Command prefixes allowed when Execution Policy is Allow Only. Use commas, newlines, quoting, or a JSON string array.",
    },
    ""
  )
  .field(
    "forbiddenCommands",
    "string",
    {
      displayName: "Command Shell Blacklist",
      isParagraph: true,
      hint: "Command prefixes blocked by command-backed helpers. Use commas, newlines, quoting, or a JSON string array.",
    },
    ""
  )
  .field(
    "disableBlacklistCommands",
    "string",
    {
      displayName: "Command Shell Blacklist Exceptions",
      isParagraph: true,
      hint: "Command prefixes that may bypass the blacklist. Use commas, newlines, quoting, or a JSON string array.",
    },
    ""
  )
  .field(
    "testMode",
    "boolean",
    {
      displayName: "Test Mode",
      subtitle: "When enabled, command tools validate policy without executing, and file-modifying tools behave like a dry run that reports what would have changed.",
    },
    false
  )
  .field(
    "fileDeletionMode",
    "select",
    {
      displayName: "File Deletion Mode",
      subtitle: "Choose whether deleted files are permanently removed or moved into agentic-studio trash inside plugin data.",
      options: [
        { displayName: "Workspace Trash", value: "trash" },
        { displayName: "Permanent Delete", value: "permanent" },
      ],
    },
    "trash"
  )
  .field(
    "directoryDeleteConfirmationCount",
    "numeric",
    {
      displayName: "Directory Delete Confirmation Threshold",
      subtitle: "Deleting a directory with at least this many descendants requires confirmed=true.",
      min: 1,
      max: 100000,
      int: true,
    },
    10
  )
  .field(
    "zstdCompressionLevel",
    "numeric",
    {
      displayName: "Zstd Compression Level",
      subtitle: "Default compression level used by archive compression actions.",
      min: 1,
      max: 22,
      int: true,
    },
    10
  )
  .field(
    "watcherDefaultLimit",
    "numeric",
    {
      displayName: "Watcher Default File Limit",
      subtitle: "Default maximum number of files tracked by as_file_watch when no explicit limit is provided.",
      min: 10,
      max: 100000,
      int: true,
    },
    5000
  )
  .field(
    "workspacePath",
    "string",
    {
      displayName: "Workspace Path",
      subtitle: "Optional workspace root override. Leave blank to use LM Studio's working directory.",
    },
    ""
  )
  .field(
    "screenshotDirectory",
    "string",
    {
      displayName: "Screenshot Directory",
      subtitle: "Optional default destination directory for screenshots. Leave blank to save inside plugin-managed screenshots.",
    },
    ""
  )
  .field(
    "compilerPreference",
    "select",
    {
      displayName: "Compiler Choices",
      subtitle: "Preferred C++ compiler resolution order. Auto uses clang++, g++, then MSVC cl on Windows.",
      options: [
        { displayName: "Auto", value: "auto" },
        { displayName: "Clang++ First", value: "clang" },
        { displayName: "G++ First", value: "gcc" },
        { displayName: "MSVC cl First", value: "msvc" },
      ],
    },
    "auto"
  )
  .field(
    "lmStudioEndpoint",
    "string",
    {
      displayName: "LM Studio API Endpoint",
      subtitle: "Base URL for LM Studio's OpenAI-compatible API.",
    },
    "http://localhost:1234/v1"
  )
  .field(
    "defaultTimeoutMs",
    "numeric",
    {
      displayName: "Default Timeout (ms)",
      subtitle: "Default timeout for command-backed helpers.",
      min: 1000,
      max: 300000,
      int: true,
    },
    30000
  )
  .field(
    "maxOutputBytes",
    "numeric",
    {
      displayName: "Max Output Bytes",
      subtitle: "Maximum stdout/stderr size returned by command-backed helpers.",
      min: 1024,
      max: 1000000,
      int: true,
    },
    100000
  )
  .field(
    "browserAutomationBackend",
    "select",
    {
      displayName: "Browser Automation Backend",
      subtitle: "Backend used by command-backed browser helpers and browser-driven site searches. Camofox uses the vendored anti-detection Firefox stack when available.",
      options: [
        { displayName: "Playwright Chromium", value: "playwright" },
        { displayName: "Camofox (Stealth Firefox)", value: "camofox" },
      ],
    },
    "playwright"
  )
  .field(
    "camofoxHomeDirectory",
    "string",
    {
      displayName: "Camofox Home Directory",
      subtitle: "Optional home directory used when launching the vendored Camofox backend. Leave blank to keep its runtime cache inside dependencies/camofox-browser/.runtime-home.",
    },
    ""
  )
  .field(
    "firecrawlApiKey",
    "string",
    {
      displayName: "Firecrawl API Key",
      subtitle: "Optional API key for Firecrawl-backed extraction actions. Leave blank for local-only scraping helpers.",
    },
    ""
  )
  .field(
    "firecrawlBaseUrl",
    "string",
    {
      displayName: "Firecrawl Base URL",
      subtitle: "Base URL for the Firecrawl API. Change this only for a self-hosted or proxied deployment.",
    },
    "https://api.firecrawl.dev"
  )
  .field(
    "enableSecondaryAgent",
    "boolean",
    {
      displayName: "Enable Secondary Agent",
      subtitle: "Enable a built-in delegated sub-agent tool inside agentic-studio.",
    },
    false
  )
  .field(
    "subAgentModelId",
    "string",
    {
      displayName: "Sub-Agent Model ID",
      subtitle: "Optional dedicated model identifier for sub-agents. Leave blank to auto-select from loaded models.",
    },
    ""
  )
  .field(
    "subAgentMaxIterations",
    "numeric",
    {
      displayName: "Sub-Agent Max Iterations",
      subtitle: "Maximum number of tool-call loops for a sub-agent run.",
      min: 1,
      max: 30,
      int: true,
    },
    6
  )
  .field(
    "subAgentPermissions",
    "select",
    {
      displayName: "Sub-Agent Permissions",
      subtitle: "Controls what the delegated sub-agent can do.",
      options: [
        { displayName: "Read Only", value: "read_only" },
        { displayName: "Standard", value: "standard" },
        { displayName: "Full", value: "full" },
      ],
    },
    "standard"
  )
  .field(
    "enableAutoDebug",
    "boolean",
    {
      displayName: "Sub-Agent Auto-Debug",
      subtitle: "Run a reviewer sub-agent pass after coding or delegated file modifications.",
    },
    false
  )
  .field(
    "subAgentProfiles",
    "string",
    {
      displayName: "Sub-Agent Profiles",
      isParagraph: true,
      hint: "JSON object mapping role names to persona instructions. Used by consult_secondary_agent.",
    },
    "{\"general\":\"You are a focused helper agent.\",\"summarizer\":\"You summarize content concisely and accurately.\",\"coder\":\"You are a software engineer who writes safe, maintainable code.\",\"reviewer\":\"You are a strict code reviewer who finds bugs and fixes them.\",\"organizer\":\"You organize files methodically, preserve data, and prefer moving over deleting.\",\"researcher\":\"You gather, compare, and summarize information clearly.\"}"
  )
  .field(
    "subAgentShowFullCode",
    "boolean",
    {
      displayName: "Sub-Agent Show Full Code",
      subtitle: "When off, generated code blocks in sub-agent responses are replaced with a compact marker.",
    },
    false
  )
  .field(
    "subAgentMaxDepth",
    "numeric",
    {
      displayName: "Sub-Agent Max Depth",
      subtitle: "Maximum nested secondary-agent depth.",
      min: 1,
      max: 5,
      int: true,
    },
    2
  )
  .field(
    "additionalSearchPaths",
    "string",
    {
      displayName: "Environment PATH Extensions",
      subtitle: "Optional path entries to append to PATH. Use commas, newlines, or a JSON string array.",
    },
    ""
  )
  .field(
    "pythonInterpreter",
    "string",
    {
      displayName: "Python Command",
      subtitle: "Python command used by Python helper tools.",
    },
    "python"
  )
  .field(
    "shellPath",
    "string",
    {
      displayName: "Shell Command",
      subtitle: "Optional shell command override. Leave blank for the platform default.",
    },
    ""
  )
  .field(
    "denoExecutable",
    "string",
    {
      displayName: "Deno Command",
      subtitle: "Optional Deno command for advanced scraping and automation helpers. Leave blank to use LM Studio's bundled Deno when available.",
    },
    ""
  )
  .field(
    "nodeExecutable",
    "string",
    {
      displayName: "Node Command",
      subtitle: "Optional Node command for advanced scraping helpers. Leave blank to use the current runtime.",
    },
    ""
  )
  .field(
    "vswherePath",
    "string",
    {
      displayName: "vswhere Command",
      hint: "Optional vswhere command for discovering Visual Studio C++ toolchains on Windows.",
    },
    ""
  )
  .field(
    "msvcVcVarsPath",
    "string",
    {
      displayName: "MSVC vcvars64 Command",
      hint: "Optional vcvars64.bat command for enabling cl when LM Studio was not launched from a developer shell.",
    },
    ""
  )
  .field(
    "exiftoolPath",
    "string",
    {
      displayName: "ExifTool Command",
      hint: "Optional exiftool command. Leave blank to use PATH lookup.",
    },
    ""
  )
  .field(
    "ffmpegPath",
    "string",
    {
      displayName: "FFmpeg Command",
      hint: "Optional ffmpeg command. Leave blank to use PATH lookup.",
    },
    ""
  )
  .field(
    "ffprobePath",
    "string",
    {
      displayName: "FFprobe Command",
      hint: "Optional ffprobe command. Leave blank to use PATH lookup.",
    },
    ""
  )
  .field(
    "ytDlpPath",
    "string",
    {
      displayName: "yt-dlp Command",
      hint: "Optional yt-dlp command. Leave blank to use PATH lookup.",
    },
    ""
  )
  .field(
    "qbittorrentUrl",
    "string",
    {
      displayName: "qBittorrent Web UI URL",
      hint: "Base URL for qBittorrent Web API used by as_torrent_controller.",
    },
    "http://127.0.0.1:8080"
  )
  .field(
    "qbittorrentUsername",
    "string",
    {
      displayName: "qBittorrent Username",
      hint: "Web UI username used by as_torrent_controller.",
    },
    "admin"
  )
  .field(
    "qbittorrentPassword",
    "string",
    {
      displayName: "qBittorrent Password",
      hint: "Web UI password used by as_torrent_controller.",
    },
    ""
  )
  .field(
    "seerrUrl",
    "string",
    {
      displayName: "Seerr URL",
      hint: "Base URL for Seerr/Jellyseerr/Overseerr-compatible API calls.",
    },
    "http://127.0.0.1:5055"
  )
  .field(
    "seerrApiKey",
    "string",
    {
      displayName: "Seerr API Key",
      hint: "API key for Seerr/Jellyseerr/Overseerr-compatible request workflows.",
    },
    ""
  )
  .field(
    "pdfToTextPath",
    "string",
    {
      displayName: "pdftotext Command",
      hint: "Optional pdftotext command. Leave blank to use PATH lookup.",
    },
    ""
  )
  .field(
    "autoHotkeyPath",
    "string",
    {
      displayName: "AutoHotkey Command",
      hint: "Optional AutoHotkey v2 executable used by advanced Windows desktop automation fallback scripts. Leave blank to use PATH lookup.",
    },
    ""
  )
  .field(
    "libreHardwareMonitorPath",
    "string",
    {
      displayName: "LibreHardwareMonitor Command",
      hint: "Optional LibreHardwareMonitor.exe path for richer vendor-agnostic GPU telemetry when it is installed locally.",
    },
    ""
  )
  .field(
    "imageMagickPath",
    "string",
    {
      displayName: "ImageMagick Command",
      hint: "Optional ImageMagick command. Leave blank to use 'magick' from PATH.",
    },
    ""
  )
  .field(
    "mkvmergePath",
    "string",
    {
      displayName: "MKVToolNix Info Command",
      hint: "Optional command used by as_mkv_info. This tool currently uses mkvmerge's JSON inspect mode (-J), not the standalone mkvinfo CLI. Leave blank to use PATH lookup.",
    },
    ""
  )
  .field(
    "mkvpropeditPath",
    "string",
    {
      displayName: "MKVToolNix Edit Command",
      hint: "Optional mkvpropedit command. Leave blank to use PATH lookup.",
    },
    ""
  )
  .field(
    "mkvextractPath",
    "string",
    {
      displayName: "MKVToolNix Extract Command",
      hint: "Optional mkvextract command used by as_mkv_extract. Leave blank to use PATH lookup.",
    },
    ""
  )
  .field(
    "psqlPath",
    "string",
    {
      displayName: "psql Command",
      hint: "Optional psql command. Leave blank to use PATH lookup.",
    },
    ""
  )
  .field(
    "mysqlPath",
    "string",
    {
      displayName: "mysql Command",
      hint: "Optional mysql command. Leave blank to use PATH lookup.",
    },
    ""
  )
  .build();
