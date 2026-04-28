import { ChatMessage, type PromptPreprocessor } from "@lmstudio/sdk";
import { configSchematics } from "./config";
import { listAgenticStudioToolMinimumProfiles } from "./shared/providerCatalog";
import { readBuiltInSkillPrompts } from "./shared/providerSkills";
import { getCurrentCavemanState, getCurrentConversationIdFromLmStudioState, getLastPromptCavemanProfile, hasSeenPromptInventory, markPromptInventorySeen, writeCurrentCavemanState, writeLastPromptCavemanProfile } from "./shared/providerState";

function parseSkillList(value: unknown): string[] {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function cavemanReminder(profile: string): string {
  if (profile === "caveman_compress") {
    return "Respond terse like smart caveman. Technical substance stay. Fluff die. Active every response. Keep technical literals exact. Compress natural-language helper prose aggressively. Continue caveman mode after every tool call.";
  }
  if (profile === "caveman") {
    return "Respond terse like smart caveman. Technical substance stay. Fluff die. Active every response. Keep technical literals exact. Continue caveman mode after every tool call.";
  }
  return "";
}

export const promptPreprocessor: PromptPreprocessor = async (ctl, userMessage) => {
  const config = ctl.getPluginConfig(configSchematics);
  const configuredCavemanProfile = (config.get("cavemanSkillProfile") as string | undefined) || "normal";
  const informAgentOfAllTools = ((config.get("informAgentOfAllTools") as boolean | undefined) ?? true) === true;
  const allowIndividualToolRequests = ((config.get("allowIndividualToolRequests") as boolean | undefined) ?? true) === true;
  const aliasesEnabled = ((config.get("enableToolAliases") as boolean | undefined) ?? false) === true;
  const perAppAutomationGuidanceEnabled = ((config.get("enablePerAppAutomationGuidance") as boolean | undefined) ?? true) === true;
  const legacyEnabled = (config.get("enableBuiltInSkillPrompt" as any) as boolean | undefined) ?? false;
  const legacySkillIds = legacyEnabled ? parseSkillList(config.get("builtInSkillPromptList" as any)) : [];
  const cavemanState = await getCurrentCavemanState();
  const skipThisTurn = cavemanState.skipTurnStage === "pending";
  if (skipThisTurn) {
    await writeCurrentCavemanState({ skipTurnStage: "active" });
  } else if (cavemanState.skipTurnStage === "active") {
    await writeCurrentCavemanState({ skipTurnStage: "idle" });
  }
  const effectiveCavemanProfile = skipThisTurn
    ? "normal"
    : (cavemanState.modeOverride || configuredCavemanProfile);
  const skillIds = effectiveCavemanProfile === "caveman"
    ? ["communication/caveman"]
    : effectiveCavemanProfile === "caveman_compress"
      ? ["communication/caveman", "maintenance/caveman-compress"]
      : legacySkillIds;
  const prompts = skillIds.length > 0
    ? await readBuiltInSkillPrompts(skillIds, { includePerAppAutomationSkills: perAppAutomationGuidanceEnabled })
    : [];
  const nextMessage = ChatMessage.from(userMessage);
  const existingText = nextMessage.getText().trim();
  const conversationId = await getCurrentConversationIdFromLmStudioState();
  const prependParts: string[] = [];
  const skillPrefix = prompts.join("\n\n").trim();
  const lastPromptCavemanProfile = await getLastPromptCavemanProfile(conversationId);
  if (effectiveCavemanProfile === "caveman" || effectiveCavemanProfile === "caveman_compress") {
    if (skillPrefix && lastPromptCavemanProfile !== effectiveCavemanProfile) {
      prependParts.push(skillPrefix);
    } else {
      const reminder = cavemanReminder(effectiveCavemanProfile);
      if (reminder) prependParts.push(reminder);
    }
  }
  const seenPromptIntro = await hasSeenPromptInventory(conversationId);
  if (!seenPromptIntro) {
    prependParts.push([
      "Agentic Studio skill-first rule for fresh conversations.",
      "If the user's request seems like it would benefit from using a skill, call as_skill_recommend before doing raw tool work.",
      "If as_skill_recommend returns a relevant skill, read it with as_skill(action=\"read\") and follow it before using raw tools.",
      "If skill discovery does not clearly settle the workflow and you need tool discovery for the task, call as_tool_help with goal first; if you are still unsure, call as_tool_catalog with scope=\"own\" second.",
      "This is especially important for multi-step work, desktop automation, OCR or vision workflows, recurring workflows, and tasks that sound like an existing workflow recipe.",
      "Skip skill discovery when the task is obviously trivial, no relevant skill exists, or the user explicitly wants raw tool use.",
      "When a tool returns a log path or report path, do not read the whole file by default.",
      "First narrow the file with as_file_search_text using error codes, ids, filenames, stack frames, URLs, or other target patterns.",
      "Then use as_file_read with offset/length only on the matching regions you actually need.",
    ].join("\n"));
  }
  if (informAgentOfAllTools && !seenPromptIntro) {
    const toolMap = listAgenticStudioToolMinimumProfiles(allowIndividualToolRequests, aliasesEnabled)
      .map((entry) => `${entry.name}=${entry.minimumProfile}${entry.configNote ? ` (${entry.configNote})` : ""}`)
      .join("; ");
    prependParts.push([
      "Agentic Studio fresh-conversation tool map.",
      "Use as_tool_help for schema/examples.",
      allowIndividualToolRequests
        ? "Prefer as_request_tool for one-off tools from higher profiles; use as_set_tool_profile for repeated work in that category. After requesting or switching, wait until the next turn before calling the new tool."
        : "Use as_set_tool_profile when you need tools from a higher profile, then wait until the next turn before calling them.",
      `Tool minimum profiles: ${toolMap}`,
    ].join("\n"));
  }
  if (!seenPromptIntro) {
    await markPromptInventorySeen(conversationId);
  }
  const prefix = prependParts.join("\n\n").trim();
  await writeLastPromptCavemanProfile(conversationId, effectiveCavemanProfile === "caveman" || effectiveCavemanProfile === "caveman_compress" ? effectiveCavemanProfile : "normal");
  if (!prefix || existingText.startsWith(prefix)) return userMessage;
  nextMessage.replaceText(existingText ? `${prefix}\n\n${existingText}` : prefix);
  return nextMessage;
};
