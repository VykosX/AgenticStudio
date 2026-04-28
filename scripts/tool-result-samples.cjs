const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function createMockController() {
  const values = new Map(Object.entries({
    defaultToolProfile: "full",
    workspacePath: root,
    allowAutoExecution: true,
    allowIndividualToolRequests: true,
    allowFullFilesystemAccess: false,
    executionPolicy: "allow_all",
    cavemanifyToolResults: false,
    cavemanSkillProfile: "normal",
    enableToolAliases: false,
    testMode: false,
    maxOutputBytes: 500000,
    defaultTimeoutMs: 30000,
    screenshotDirectory: "",
  }));
  return {
    client: {},
    getWorkingDirectory() {
      return root;
    },
    getPluginConfig() {
      return {
        get(key) {
          return values.get(String(key));
        },
      };
    },
  };
}

const sampleCalls = [
  { id: "as_input_controller_help", name: "as_input_controller", args: { action: "help" } },
  { id: "as_window_controller_list", name: "as_window_controller", args: { action: "list", query: "", limit: 3 } },
  { id: "as_process_controller_list", name: "as_process_controller", args: { action: "list", query: "", include_command_line: false, limit: 3 } },
  { id: "as_memory_controller_list", name: "as_memory_controller", args: { action: "list", query: "", tag: "", global: false, limit: 5 } },
  { id: "as_todo_controller_list", name: "as_todo_controller", args: { action: "list", status: "all", global: false } },
  { id: "as_skill_recommend_desktop", name: "as_skill_recommend", args: { query: "multi-step desktop automation with screenshots, clicks, and verification", category: "", limit: 5, include_builtin: true, include_custom: true } },
  { id: "as_tool_catalog_desktop", name: "as_tool_catalog", args: { scope: "available", category: "desktop", query: "", detailed: false, query_tool: "", write_to_file: "", limit: 20 } },
  { id: "as_tool_help_input_controller", name: "as_tool_help", args: { tool_name: "as_input_controller", goal: "", scope: "available", detail_level: "compact", write_to_file: "" } },
  { id: "as_tool_help_goal_desktop", name: "as_tool_help", args: { goal: "desktop automation with screenshots, clicks, typing, verification, and fallback scripts", tool_name: "", scope: "available", detail_level: "summary", write_to_file: "" } },
  { id: "as_screenshot_capture_current", name: "as_screenshot_capture", args: { source: "current", output_path: "screenshots/runtime-sample.png", include_cursor: true } },
  { id: "as_system_info_summary", name: "as_system_info", args: { detailed: false } },
];

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeToolResult(result) {
  if (typeof result === "string") {
    return { resultText: String(result || ""), parsed: tryParseJson(String(result || "")) };
  }
  const parsed = result && typeof result === "object" ? result : null;
  return {
    resultText: JSON.stringify(result),
    parsed,
  };
}

async function collectSampleResults() {
  const { toolsProvider } = require(path.join(root, "dist", "toolsProvider.js"));
  const ctl = createMockController();
  const tools = await toolsProvider(ctl);
  const toolMap = new Map(tools.map((entry) => [entry.name, entry]));
  const results = [];
  for (const sample of sampleCalls) {
    const tool = toolMap.get(sample.name);
    let resultText = "";
    if (!tool || typeof tool.implementation !== "function") {
      resultText = JSON.stringify({ success: false, error: "missing implementation" });
    } else {
      try {
        resultText = await tool.implementation(sample.args);
      } catch (error) {
        resultText = JSON.stringify({ success: false, error: error && error.message ? error.message : String(error) });
      }
    }
    const normalized = normalizeToolResult(resultText);
    results.push({
      ...sample,
      resultText: normalized.resultText,
      bytes: Buffer.byteLength(normalized.resultText, "utf8"),
      parsed: normalized.parsed,
    });
    const parsed = normalized.parsed;
    const outputPath = parsed && typeof parsed.path === "string" ? String(parsed.path) : "";
    if (outputPath) {
      const absolutePath = path.isAbsolute(outputPath) ? outputPath : path.join(root, outputPath);
      await fs.promises.rm(absolutePath, { force: true }).catch(() => {});
    }
  }
  return results;
}

module.exports = {
  root,
  sampleCalls,
  collectSampleResults,
  createMockController,
};
