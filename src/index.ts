import type { PluginContext } from "@lmstudio/sdk";
import { toolsProvider } from "./toolsProvider";
import { configSchematics } from "./config";
import { promptPreprocessor } from "./promptPreprocessor";

export async function main(context: PluginContext) {
  context.withConfigSchematics(configSchematics);
  context.withPromptPreprocessor(promptPreprocessor);
  context.withToolsProvider(toolsProvider);
}
