const { collectSampleResults } = require("./tool-result-samples.cjs");

const budgets = {
  as_input_controller_help: 3200,
  as_window_controller_list: 3200,
  as_process_controller_list: 550,
  as_memory_controller_list: 80,
  as_todo_controller_list: 80,
  as_skill_recommend_desktop: 2300,
  as_tool_catalog_desktop: 700,
  as_tool_help_input_controller: 2500,
  as_tool_help_goal_desktop: 3000,
  as_screenshot_capture_current: 1600,
  as_system_info_summary: 950,
};

function failIf(condition, message, failures) {
  if (condition) failures.push(message);
}

async function main() {
  const results = await collectSampleResults();
  const failures = [];
  const byId = new Map(results.map((sample) => [sample.id, sample]));

  for (const sample of results) {
    const maxBytes = budgets[sample.id];
    failIf(typeof maxBytes !== "number", `Missing byte budget for ${sample.id}.`, failures);
    if (typeof maxBytes === "number") {
      failIf(sample.bytes > maxBytes, `${sample.id} is ${sample.bytes} bytes, over budget ${maxBytes}.`, failures);
    }
    failIf(!sample.parsed || typeof sample.parsed !== "object", `${sample.id} did not return parseable JSON.`, failures);
  }

  const inputHelp = byId.get("as_input_controller_help");
  const inputHelpParsed = inputHelp && inputHelp.parsed;
  failIf(Boolean(inputHelp?.resultText.includes("\"keyNames\"")), "as_input_controller_help regressed to the legacy flat keyNames payload.", failures);
  failIf(!Array.isArray(inputHelpParsed?.keyNameGroups?.operators), "as_input_controller_help should expose grouped key names.", failures);

  const skillRecommend = byId.get("as_skill_recommend_desktop");
  const skillRecommendParsed = skillRecommend && skillRecommend.parsed;
  failIf(Boolean(skillRecommend?.resultText.includes("\"primaryRecommendation\":")), "as_skill_recommend_desktop should not duplicate the full primaryRecommendation object.", failures);
  failIf(Boolean(skillRecommend?.resultText.includes("\"nextStep\"")), "as_skill_recommend_desktop should not repeat per-item nextStep strings.", failures);
  failIf(skillRecommendParsed?.primaryRecommendationId !== skillRecommendParsed?.recommendations?.[0]?.id, "as_skill_recommend_desktop primaryRecommendationId should match the top recommendation.", failures);

  const toolCatalog = byId.get("as_tool_catalog_desktop");
  for (const forbidden of ["\"profileSwitchGuidance\":null", "\"writtenToFile\":null", "\"followupHint\":null"]) {
    failIf(Boolean(toolCatalog?.resultText.includes(forbidden)), `as_tool_catalog_desktop should omit ${forbidden}.`, failures);
  }

  const toolHelpInput = byId.get("as_tool_help_input_controller");
  for (const forbidden of ["\"schema\":null", "\"aliasTarget\":null", "\"generalCall\":null", "\"requestedToolName\":\"as_input_controller\"", "\"isAlias\":false", "\"aliasesEnabled\":false"]) {
    failIf(Boolean(toolHelpInput?.resultText.includes(forbidden)), `as_tool_help_input_controller should omit ${forbidden}.`, failures);
  }

  const goalHelp = byId.get("as_tool_help_goal_desktop");
  const goalHelpParsed = goalHelp && goalHelp.parsed;
  const topGoalToolNames = Array.isArray(goalHelpParsed?.recommendedTools)
    ? goalHelpParsed.recommendedTools.slice(0, 6).map((entry) => entry && entry.name).filter(Boolean)
    : [];
  for (const requiredTool of ["as_window_controller", "as_screenshot_capture", "as_input_controller"]) {
    failIf(!topGoalToolNames.includes(requiredTool), `as_tool_help_goal_desktop should prioritize ${requiredTool} near the top of recommendedTools.`, failures);
  }
  const workflow = Array.isArray(goalHelpParsed?.recommendedWorkflow) ? goalHelpParsed.recommendedWorkflow : [];
  failIf(!workflow.some((step) => /Verify after each meaningful input burst or click/i.test(String(step))), "as_tool_help_goal_desktop should explicitly teach stepwise verification.", failures);
  failIf(!workflow.some((step) => /autohotkey_script/.test(String(step))), "as_tool_help_goal_desktop should mention the AutoHotkey fallback.", failures);

  const systemInfo = byId.get("as_system_info_summary");
  for (const forbidden of ["\"folder\":null", "\"cpuPackages\":[]", "\"networkInterfaces\":null", "\"disks\":[]", "\"runtimes\":null", "\"hardware\":", "\"connectivity\":", "\"userSessions\":null", "\"processSummary\":null"]) {
    failIf(Boolean(systemInfo?.resultText.includes(forbidden)), `as_system_info_summary should not include stale empty field ${forbidden}.`, failures);
  }

  if (failures.length > 0) {
    throw new Error(`Tool result budget checks failed:\n- ${failures.join("\n- ")}`);
  }

  console.log("Tool result budget checks passed.");
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
