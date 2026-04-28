const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const providerCatalog = require(path.join(root, "dist", "shared", "providerCatalog.js"));
const providerState = require(path.join(root, "dist", "shared", "providerState.js"));
const providerSkills = require(path.join(root, "dist", "shared", "providerSkills.js"));
const { registerStatefulTools } = require(path.join(root, "dist", "tools", "stateful.js"));
const { configSchematics } = require(path.join(root, "dist", "config.js"));
const { z } = require("zod");

function expectHas(set, value, message) {
  assert(set && set.has(value), message || `Expected set to include ${value}`);
}

function expectLacks(set, value, message) {
  assert(set && !set.has(value), message || `Expected set not to include ${value}`);
}

async function runSkillRecommendSample(query, enablePerAppAutomationGuidance) {
  const tools = [];
  const ctx = {
    tool: (spec) => spec,
    z,
    safeTool: (_name, fn) => fn,
    workspaceRoot: root,
    pluginDataDirectory: () => path.join(root, ".tmp-plugin-data"),
    resolveInsideDirectory: (...parts) => path.join(...parts),
    readJsonFile: async (_filePath, fallback) => fallback,
    writeJsonFile: async () => {},
    readMergedRecords: async () => [],
    resolveMemoryPaths: async () => ({ readPaths: [], writePaths: [], context: { mode: "workspace" } }),
    resolveTodoPaths: async () => ({ readPaths: [], writePaths: [], context: { mode: "workspace" } }),
    fileExists: async () => false,
    skillsDirectory: () => path.join(root, ".tmp-skills"),
    dynamicToolNameSchema: { parse: (value) => value },
    mergeDefined: (value) => Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)),
    path,
    fsp: fs.promises,
    json: (value) => value,
    normalize: (value) => String(value || "").toLowerCase(),
    ctl: {
      getPluginConfig: () => ({
        get: (key) => key === "enablePerAppAutomationGuidance" ? enablePerAppAutomationGuidance : undefined,
      }),
    },
    configSchematics,
  };
  registerStatefulTools(ctx, tools);
  const recommendTool = tools.find((tool) => tool.name === "as_skill_recommend");
  assert(recommendTool && typeof recommendTool.implementation === "function", "as_skill_recommend should be registered");
  return await recommendTool.implementation({
    query,
    category: "",
    limit: 5,
    include_builtin: true,
    include_custom: true,
  });
}

async function main() {
  const minimal = providerCatalog.getAllowedToolNamesForProfile("minimal");
  const fileManagement = providerCatalog.getAllowedToolNamesForProfile("file_management");
  const multimedia = providerCatalog.getAllowedToolNamesForProfile("multimedia");
  const web = providerCatalog.getAllowedToolNamesForProfile("web");
  const research = providerCatalog.getAllowedToolNamesForProfile("research");
  const data = providerCatalog.getAllowedToolNamesForProfile("data");
  const systemAdmin = providerCatalog.getAllowedToolNamesForProfile("system_admin");
  const balanced = providerCatalog.getAllowedToolNamesForProfile("balanced");
  const development = providerCatalog.getAllowedToolNamesForProfile("development");
  const automation = providerCatalog.getAllowedToolNamesForProfile("automation");
  const exposedProfileSets = [minimal, fileManagement, multimedia, web, research, data, systemAdmin, balanced, development, automation];

  ["as_math", "as_unit_conversion", "as_date_math", "as_file_patch", "as_git_controller"].forEach((toolName) => {
    expectLacks(minimal, toolName, `minimal profile must not include ${toolName}`);
  });

  ["as_skill", "as_skill_recommend"].forEach((toolName) => {
    expectHas(minimal, toolName, `minimal profile should include ${toolName}`);
  });

  ["as_math", "as_unit_conversion", "as_date_math", "as_file_patch", "as_git_controller"].forEach((toolName) => {
    expectHas(balanced, toolName, `balanced profile should include ${toolName}`);
  });

  [
    "as_file_rename",
    "as_file_patch",
    "as_file_create",
    "as_file_copy_move",
    "as_file_search",
    "as_file_compare",
    "as_file_watch",
    "as_file_organize",
    "as_date_math",
    "as_skill",
    "as_skill_recommend",
    "as_memory_controller",
    "as_todo_controller",
    "as_structured_data",
    "as_tabular_data",
  ].forEach((toolName) => expectHas(fileManagement, toolName, `file_management profile should include ${toolName}`));

  ["as_archive", "as_file_rename", "as_file_organize", "as_date_math"].forEach((toolName) => {
    expectHas(multimedia, toolName, `multimedia profile should include ${toolName}`);
  });
  ["as_vision_ocr", "as_vision_target", "as_vision_focus", "as_vision_recognize"].forEach((toolName) => {
    expectHas(multimedia, toolName, `multimedia profile should include ${toolName}`);
    expectHas(balanced, toolName, `balanced profile should include ${toolName}`);
    expectHas(providerCatalog.getAllowedToolNamesForProfile("desktop"), toolName, `desktop profile should include ${toolName}`);
  });

  ["as_web_extract", "as_multi_website_search", "as_web_search", "as_web_download", "as_torrent_controller"].forEach((toolName) => {
    expectHas(web, toolName, `web profile should include ${toolName}`);
  });

  ["as_web_search", "as_web_extract", "as_memory_controller", "as_agent_task"].forEach((toolName) => {
    expectHas(research, toolName, `research profile should include ${toolName}`);
  });

  ["as_database_query", "as_tabular_data", "as_structured_data", "as_archive"].forEach((toolName) => {
    expectHas(data, toolName, `data profile should include ${toolName}`);
  });

  ["as_process_controller", "as_service_controller", "as_environ_controller", "as_registry_controller", "as_task_controller"].forEach((toolName) => {
    expectHas(systemAdmin, toolName, `system_admin profile should include ${toolName}`);
  });

  [
    "as_git_controller",
    "as_project_verify",
    "as_project_bug_scan",
    "as_dynamic_tool",
    "as_skill",
    "as_skill_recommend",
    "as_file_patch",
    "as_agent_task",
  ].forEach((toolName) => expectHas(development, toolName, `development profile should include ${toolName}`));

  ["as_agent_task", "as_task_controller", "as_service_controller", "as_process_controller", "as_http_wait", "as_port_wait", "as_sleep", "as_date_math"].forEach((toolName) => {
    expectHas(automation, toolName, `automation profile should include ${toolName}`);
  });

  [
    "as_file_apply_diff",
    "as_file_multi_replace",
    "as_file_append",
    "as_diff_preview",
    "as_file_batch_regex_replace",
    "as_file_batch_rename",
    "as_now",
    "as_git_status",
    "as_git_commit",
    "as_tool_catalog_disabled",
    "as_skill_list",
    "as_memory_list",
    "as_todo_upsert",
    "as_file_mkdir",
    "as_file_copy",
    "as_file_move",
    "as_file_trash_list",
    "as_file_trash_restore",
    "as_file_watch_create",
    "as_file_plan_reorganization",
    "as_file_preview_moves",
    "as_file_apply_reorganization",
    "as_env_list",
    "as_process_list",
    "as_process_wait",
    "as_task_schedule_create",
    "as_clipboard_read",
    "as_window_list",
    "as_input_keyboard",
    "as_tool_create",
    "as_agent_task_create",
    "as_sqlite_query",
    "as_csv_read",
    "as_json_yaml_validate",
    "as_visit_website",
    "as_search_wikipedia",
    "as_reddit_search",
    "as_web_firecrawl_scrape",
    "as_archive_list",
    "as_file_compress",
  ].forEach((toolName) => {
    for (const profileSet of exposedProfileSets) {
      expectLacks(profileSet, toolName, `profile should not retain removed alias ${toolName}`);
    }
  });

  const noConversation = providerState.buildConversationStorageContextFromId(null);
  assert.strictEqual(noConversation.mode, "global", "missing conversation should default to global storage");

  const topLevelConversation = providerState.buildConversationStorageContextFromId("chat-123");
  assert.strictEqual(topLevelConversation.mode, "global", "top-level conversations should default to global storage");
  assert.strictEqual(topLevelConversation.parentSharedDirectory, null, "top-level conversations should not have a parent shared directory");
  assert.strictEqual(providerState.buildToolProfileScopeKey("chat-123"), "chat-123", "top-level profile overrides should stay scoped to that conversation");

  const nestedConversation = providerState.buildConversationStorageContextFromId("folder-a/chat-123");
  assert.strictEqual(nestedConversation.mode, "conversation_plus_parent", "nested conversations should use conversation-plus-parent storage");
  assert(nestedConversation.parentSharedDirectory && nestedConversation.parentSharedDirectory.endsWith(path.join("folder-a", "_shared")), "nested conversations should point at the parent shared directory");
  assert.strictEqual(providerState.buildToolProfileScopeKey("folder-a/chat-123"), "folder-a", "nested profile overrides should apply to the conversation group");
  assert.strictEqual(providerState.buildToolProfileScopeKey("folder-a/sub/chat-123"), "folder-a/sub", "deeper nested profile overrides should scope to the parent conversation group");

  const builtInSkills = await providerSkills.listBuiltInSkills();
  const builtInIds = new Set(builtInSkills.map((skill) => skill.id));
  expectHas(builtInIds, "communication/caveman", "built-in skills should include communication/caveman");
  expectHas(builtInIds, "maintenance/caveman-compress", "built-in skills should include maintenance/caveman-compress");
  [
    "automation/durable-agent-work",
    "automation/file-watch-inbox-automation",
    "automation/local-maintenance-scheduler",
    "automation/safe-desktop-agent-loop",
    "data/database-readonly-analysis",
    "data/date-time-calculation",
    "data/document-extraction",
    "data/spreadsheet-csv-workflow",
    "data/structured-data-cleaning",
    "desktop/computer-use-operator",
    "desktop/per-app-automation-guidance",
    "development/codebase-map",
    "development/systematic-debugging",
    "development/test-first-change",
    "development/tool-and-skill-authoring",
    "finance/market-research-risk-guard",
    "github/autonomous-project-maintenance",
    "organization/file-management-workbench",
    "planning/project-planning",
    "research/source-grounded-research",
    "web/autonomous-browser-navigation",
    "web/web-capture-monitor",
    "workflow/agent-work-loop",
  ].forEach((skillId) => expectHas(builtInIds, skillId, `built-in skills should include ${skillId}`));

  [
    "automation/long-running-agent-loop",
    "communication/batch-status-report",
    "documents/document-library-curation",
    "media/photo-library-curation",
    "organization/advanced-batch-rename",
    "planning/goal-backward-roadmap",
    "research/source-first",
    "web/website-archive-and-extract",
    "workflow/resume-from-state",
  ].forEach((skillId) => assert(!builtInIds.has(skillId), `removed consolidated skill should not be listed: ${skillId}`));

  assert.strictEqual(builtInIds.size, builtInSkills.length, "built-in skill ids should be unique");
  for (const skill of builtInSkills) {
    assert(skill.description && skill.description.trim(), `built-in skill ${skill.id} should declare a description`);
    assert((skill.summary && skill.summary.trim()) || skill.description, `built-in skill ${skill.id} should have discoverable summary text`);
    const content = fs.readFileSync(skill.path, "utf8");
    assert(/^---\s*[\r\n][\s\S]*?[\r\n]---/m.test(content), `built-in skill ${skill.id} should include YAML frontmatter`);
    assert(/^---\s*[\r\n][\s\S]*?\bname:\s*\S+/m.test(content), `built-in skill ${skill.id} should declare a frontmatter name`);
    assert(/^---\s*[\r\n][\s\S]*?\bdescription:\s*\S+/m.test(content), `built-in skill ${skill.id} should declare a frontmatter description`);
    assert(/^##\s+(When To Use|Workflow|Steps)/m.test(content), `built-in skill ${skill.id} should explain when to use it or how it works`);
  }

  const prompts = await providerSkills.readBuiltInSkillPrompts(["communication/caveman"]);
  assert(prompts.length === 1 && /caveman/i.test(prompts[0]), "caveman built-in prompt should load");

  const filteredBuiltInSkills = await providerSkills.listBuiltInSkills({ includePerAppAutomationSkills: false });
  const filteredSkillIds = new Set(filteredBuiltInSkills.map((skill) => skill.id));
  assert(!filteredSkillIds.has("desktop/per-app-automation-guidance"), "per-app automation skill should be hidden when the config-gated filter is off");
  const hiddenPerAppSkill = await providerSkills.resolveSkillRecord("desktop/per-app-automation-guidance", { includePerAppAutomationSkills: false });
  assert.strictEqual(hiddenPerAppSkill, null, "resolveSkillRecord should hide per-app automation skills when the filter is off");
  const visiblePerAppSkill = await providerSkills.resolveSkillRecord("desktop/per-app-automation-guidance", { includePerAppAutomationSkills: true });
  assert(visiblePerAppSkill, "resolveSkillRecord should return the per-app automation skill when the filter is on");
  const genericVisionSkill = builtInSkills.find((skill) => skill.id === "desktop/vision-guided-computer-use");
  assert(genericVisionSkill, "generic vision-guided desktop skill should exist");
  const genericVisionSkillContent = await providerSkills.readSkillContent(genericVisionSkill);
  assert(!/calculator-style apps/i.test(genericVisionSkillContent), "generic vision-guided desktop skill should not contain app-specific calculator guidance");
  assert(visiblePerAppSkill && /### Calculator/m.test(await providerSkills.readSkillContent(visiblePerAppSkill)), "per-app automation skill should hold Calculator-specific guidance");
  const recommendWithPerAppGuidance = await runSkillRecommendSample("Read the Calculator display, clear it, and input 7*8+9/2.5 in the Calculator app window", true);
  assert.strictEqual(recommendWithPerAppGuidance.primaryRecommendationId, "desktop/per-app-automation-guidance", "single-app calculator prompts should prefer the per-app automation skill when guidance is enabled");
  assert.deepStrictEqual(recommendWithPerAppGuidance.recommendedReadCall, { action: "read", name: "desktop/per-app-automation-guidance" }, "skill recommendation should expose an exact read call for the top skill");
  assert(/desktop\/per-app-automation-guidance/.test(String(recommendWithPerAppGuidance.instruction || "")), "skill recommendation instruction should name the exact top skill");
  const recommendWithoutPerAppGuidance = await runSkillRecommendSample("Read the Calculator display, clear it, and input 7*8+9/2.5 in the Calculator app window", false);
  assert.strictEqual(recommendWithoutPerAppGuidance.primaryRecommendationId, "desktop/vision-guided-computer-use", "single-app calculator prompts should fall back to the generic vision-guided desktop skill when per-app guidance is disabled");
  const recommendAutonomousBrowser = await runSkillRecommendSample("Navigate a website autonomously, follow links, and use a headless browser agent instead of my local browser window", true);
  assert.strictEqual(recommendAutonomousBrowser.primaryRecommendationId, "web/autonomous-browser-navigation", "autonomous browser tasks should prefer the dedicated browser-navigation skill");
  const recommendLocalBrowser = await runSkillRecommendSample("Use Chrome on my computer to click through a website and fill a field in the local browser window", true);
  assert.strictEqual(recommendLocalBrowser.primaryRecommendationId, "desktop/vision-guided-computer-use", "specific installed browser window tasks should fall back to the generic vision-guided desktop skill");

  const consolidatedSource = fs.readFileSync(path.join(root, "src", "tools", "consolidated.ts"), "utf8");
  const desktopAutomationSource = fs.readFileSync(path.join(root, "src", "tools", "desktopAutomation.ts"), "utf8");
  const systemInfoSource = fs.readFileSync(path.join(root, "src", "tools", "systemInfo.ts"), "utf8");
  assert(/if \(action === "press"\)[\s\S]*?key \|\| combo \|\| text/.test(consolidatedSource), "as_input_controller press routing should consume key before falling back to combo/text.");
  assert(/if \(action === "paste_text"\)[\s\S]*?as_input_key_event[\s\S]*?key:\s*"v"/.test(consolidatedSource), "paste_text should use lower-level ctrl+v dispatch instead of the older SendKeys shortcut path.");
  assert(/combo is required and must resolve to a non-empty key press\./.test(desktopAutomationSource), "as_input_keyboard_combo should reject empty combo dispatches.");
  assert(/typeof record\.key === "string"/.test(desktopAutomationSource), "keyboard sequence steps should accept key fields.");
  assert(/Send-FriendlyKeyPress/.test(desktopAutomationSource), "keyboard sequences should share the lower-level friendly key dispatch helper for press-like steps.");
  assert(desktopAutomationSource.includes('CoordMode(\\"Mouse\\", \\"Screen\\")'), "AutoHotkey fallback should force mouse coordinates into screen mode for window-relative helpers.");
  assert(/fan\.speed/.test(systemInfoSource), "as_system_info should query GPU fan speed telemetry when vendor tooling supports it.");
  assert(/libreHardwareMonitorPath/.test(systemInfoSource), "as_system_info should support LibreHardwareMonitor as a vendor-agnostic GPU telemetry provider.");
  assert(/field_list/.test(systemInfoSource), "as_system_info should accept a structured field_list for targeted system-info queries.");
  assert(/help:\s*z\.union\(\[z\.boolean\(\), z\.string\(\)\]\)\.default\(false\)/.test(systemInfoSource), "as_system_info should expose a help parameter for descriptor discovery.");
  assert(/validFields/.test(systemInfoSource), "as_system_info help responses should return validFields.");
  assert(systemInfoSource.includes("Set-Content -LiteralPath $outputPath -Encoding UTF8"), "as_system_info should persist oversized LibreHardwareMonitor snapshots to disk before parsing them.");
  assert(!/operatorGuidance/.test(consolidatedSource), "generic input help should not ship per-app operator guidance inline.");
  assert(!/recommendedSkill:\s*"desktop\/vision-guided-computer-use"/.test(consolidatedSource), "generic desktop reminders should not hardcode the vision-guided skill over per-app recommendation flow.");
  const providerCoreSource = fs.readFileSync(path.join(root, "src", "shared", "providerCore.ts"), "utf8");
  const promptPreprocessorSource = fs.readFileSync(path.join(root, "src", "promptPreprocessor.ts"), "utf8");
  const webSource = fs.readFileSync(path.join(root, "src", "tools", "web.ts"), "utf8");
  const developmentSource = fs.readFileSync(path.join(root, "src", "tools", "development.ts"), "utf8");
  const dataMediaSource = fs.readFileSync(path.join(root, "src", "tools", "dataMedia.ts"), "utf8");
  assert(/as_skill_recommend/.test(providerCoreSource) && /shouldBypassCavemanRewrite/.test(providerCoreSource), "providerCore should exempt skill discovery from caveman rewriting.");
  assert(/caveman_reminder/.test(providerCoreSource), "providerCore should append a caveman reminder during caveman mode.");
  assert(/When a tool returns a log path or report path, do not read the whole file by default\./.test(promptPreprocessorSource), "prompt preprocessor should teach the agent to inspect spill files surgically.");
  assert(/name:\s*"as_web_search"[\s\S]*detail:\s*z\.enum\(\["compact", "full", "max", "maximum"\]\)\.default\("compact"\)/.test(webSource), "as_web_search should default to compact detail.");
  assert(/name:\s*"as_web_image_search"[\s\S]*detail:\s*z\.enum\(\["compact", "full", "max", "maximum"\]\)\.default\("compact"\)/.test(webSource), "as_web_image_search should default to compact detail.");
  [
    "archive",
    "internet_archive",
    "archive_org",
    "wikipedia",
    "reddit",
    "stackoverflow",
    "stackexchange",
    "wikihow",
    "youtube",
    "hackernews",
    "slashdot",
    "github",
    "npm",
    "pypi",
    "arxiv",
    "annas_archive",
    "libgen",
    "mdn",
    "msdn",
  ].forEach((websiteName) => {
    assert(new RegExp(`case "${websiteName}"`).test(webSource), `as_multi_website_search should give ${websiteName} a dedicated site routine.`);
  });
  assert(/name:\s*"as_project_bug_scan"[\s\S]*detail:\s*z\.enum\(\["compact", "full", "max", "maximum"\]\)\.default\("compact"\)/.test(developmentSource), "as_project_bug_scan should default to compact detail.");
  assert(/name:\s*"as_dynamic_tool"[\s\S]*detail:\s*z\.enum\(\["compact", "full", "max", "maximum"\]\)\.default\("compact"\)/.test(developmentSource), "as_dynamic_tool should default to compact detail.");
  assert(/name:\s*"as_media_probe"[\s\S]*detail:\s*z\.enum\(\["compact", "full", "max", "maximum"\]\)\.default\("compact"\)/.test(dataMediaSource), "as_media_probe should default to compact detail.");
  assert(/name:\s*"as_mkv_info"[\s\S]*detail:\s*z\.enum\(\["compact", "full", "max", "maximum"\]\)\.default\("compact"\)/.test(dataMediaSource), "as_mkv_info should default to compact detail.");

  console.log("Smoke checks passed.");
}

main();
