"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptPreprocessor = void 0;
const sdk_1 = require("@lmstudio/sdk");
const config_1 = require("./config");
const providerCatalog_1 = require("./shared/providerCatalog");
const providerSkills_1 = require("./shared/providerSkills");
const providerState_1 = require("./shared/providerState");
function parseSkillList(value) {
    return String(value || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function cavemanReminder(profile) {
    if (profile === "caveman_compress") {
        return "Respond terse like smart caveman. Technical substance stay. Fluff die. Active every response. Keep technical literals exact. Compress natural-language helper prose aggressively. Continue caveman mode after every tool call.";
    }
    if (profile === "caveman") {
        return "Respond terse like smart caveman. Technical substance stay. Fluff die. Active every response. Keep technical literals exact. Continue caveman mode after every tool call.";
    }
    return "";
}
const promptPreprocessor = async (ctl, userMessage) => {
    const config = ctl.getPluginConfig(config_1.configSchematics);
    const configuredCavemanProfile = config.get("cavemanSkillProfile") || "normal";
    const informAgentOfAllTools = (config.get("informAgentOfAllTools") ?? true) === true;
    const allowIndividualToolRequests = (config.get("allowIndividualToolRequests") ?? true) === true;
    const aliasesEnabled = (config.get("enableToolAliases") ?? false) === true;
    const perAppAutomationGuidanceEnabled = (config.get("enablePerAppAutomationGuidance") ?? true) === true;
    const legacyEnabled = config.get("enableBuiltInSkillPrompt") ?? false;
    const legacySkillIds = legacyEnabled ? parseSkillList(config.get("builtInSkillPromptList")) : [];
    const cavemanState = await (0, providerState_1.getCurrentCavemanState)();
    const skipThisTurn = cavemanState.skipTurnStage === "pending";
    if (skipThisTurn) {
        await (0, providerState_1.writeCurrentCavemanState)({ skipTurnStage: "active" });
    }
    else if (cavemanState.skipTurnStage === "active") {
        await (0, providerState_1.writeCurrentCavemanState)({ skipTurnStage: "idle" });
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
        ? await (0, providerSkills_1.readBuiltInSkillPrompts)(skillIds, { includePerAppAutomationSkills: perAppAutomationGuidanceEnabled })
        : [];
    const nextMessage = sdk_1.ChatMessage.from(userMessage);
    const existingText = nextMessage.getText().trim();
    const conversationId = await (0, providerState_1.getCurrentConversationIdFromLmStudioState)();
    const prependParts = [];
    const skillPrefix = prompts.join("\n\n").trim();
    const lastPromptCavemanProfile = await (0, providerState_1.getLastPromptCavemanProfile)(conversationId);
    if (effectiveCavemanProfile === "caveman" || effectiveCavemanProfile === "caveman_compress") {
        if (skillPrefix && lastPromptCavemanProfile !== effectiveCavemanProfile) {
            prependParts.push(skillPrefix);
        }
        else {
            const reminder = cavemanReminder(effectiveCavemanProfile);
            if (reminder)
                prependParts.push(reminder);
        }
    }
    const seenPromptIntro = await (0, providerState_1.hasSeenPromptInventory)(conversationId);
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
        const toolMap = (0, providerCatalog_1.listAgenticStudioToolMinimumProfiles)(allowIndividualToolRequests, aliasesEnabled)
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
        await (0, providerState_1.markPromptInventorySeen)(conversationId);
    }
    const prefix = prependParts.join("\n\n").trim();
    await (0, providerState_1.writeLastPromptCavemanProfile)(conversationId, effectiveCavemanProfile === "caveman" || effectiveCavemanProfile === "caveman_compress" ? effectiveCavemanProfile : "normal");
    if (!prefix || existingText.startsWith(prefix))
        return userMessage;
    nextMessage.replaceText(existingText ? `${prefix}\n\n${existingText}` : prefix);
    return nextMessage;
};
exports.promptPreprocessor = promptPreprocessor;
//# sourceMappingURL=promptPreprocessor.js.map