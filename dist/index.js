"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const toolsProvider_1 = require("./toolsProvider");
const config_1 = require("./config");
const promptPreprocessor_1 = require("./promptPreprocessor");
async function main(context) {
    context.withConfigSchematics(config_1.configSchematics);
    context.withPromptPreprocessor(promptPreprocessor_1.promptPreprocessor);
    context.withToolsProvider(toolsProvider_1.toolsProvider);
}
//# sourceMappingURL=index.js.map