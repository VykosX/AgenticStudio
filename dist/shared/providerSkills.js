"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.builtInSkillsDirectory = builtInSkillsDirectory;
exports.customSkillsDirectory = customSkillsDirectory;
exports.listBuiltInSkills = listBuiltInSkills;
exports.listCustomSkills = listCustomSkills;
exports.listAllSkills = listAllSkills;
exports.resolveSkillRecord = resolveSkillRecord;
exports.readSkillContent = readSkillContent;
exports.readBuiltInSkillPrompts = readBuiltInSkillPrompts;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const yaml_1 = __importDefault(require("yaml"));
const providerState_1 = require("./providerState");
const providerUtils_1 = require("./providerUtils");
const PER_APP_AUTOMATION_SKILL_IDS = new Set([
    "desktop/per-app-automation-guidance",
]);
function parseFrontmatter(text) {
    if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) {
        return { frontmatter: {}, body: text };
    }
    const endMarker = text.indexOf("\n---", 4);
    if (endMarker < 0) {
        return { frontmatter: {}, body: text };
    }
    const yamlText = text.slice(4, endMarker).replace(/\r\n/g, "\n");
    const body = text.slice(endMarker + 4).replace(/^\r?\n/, "");
    try {
        const frontmatter = yaml_1.default.parse(yamlText) || {};
        return { frontmatter, body };
    }
    catch {
        return { frontmatter: {}, body: text };
    }
}
function summarizeMarkdown(body) {
    const line = body
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .find((entry) => entry && !entry.startsWith("#") && !entry.startsWith("---") && !entry.startsWith("- ") && !/^\d+\./.test(entry));
    return line || null;
}
function builtInSkillsDirectory() {
    return path.resolve(__dirname, "..", "..", "builtin-skills");
}
function customSkillsDirectory() {
    return path.join((0, providerState_1.pluginDataDirectory)(), "default", "skills");
}
async function listBuiltinSkillFiles(rootDirectory) {
    const results = [];
    const walk = async (currentDirectory) => {
        const entries = await fs_1.promises.readdir(currentDirectory, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
            const fullPath = path.join(currentDirectory, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
                continue;
            }
            if (entry.isFile() && entry.name === "SKILL.md") {
                results.push(fullPath);
            }
        }
    };
    await walk(rootDirectory);
    return results;
}
function includeSkillRecord(skill, options = {}) {
    const includePerAppAutomationSkills = options.includePerAppAutomationSkills ?? true;
    if (!includePerAppAutomationSkills && PER_APP_AUTOMATION_SKILL_IDS.has(skill.id)) {
        return false;
    }
    return true;
}
async function listBuiltInSkills(options = {}) {
    const rootDirectory = builtInSkillsDirectory();
    const files = await listBuiltinSkillFiles(rootDirectory);
    const skills = [];
    for (const skillPath of files) {
        const relativeFolder = path.relative(rootDirectory, path.dirname(skillPath)).replace(/\\/g, "/");
        const segments = relativeFolder.split("/").filter(Boolean);
        if (segments.length < 2)
            continue;
        const [category, ...rest] = segments;
        const name = rest[rest.length - 1];
        const text = await fs_1.promises.readFile(skillPath, "utf8");
        const { frontmatter, body } = parseFrontmatter(text);
        const promptPath = path.join(path.dirname(skillPath), "PROMPT.md");
        skills.push({
            id: `${category}/${name}`,
            name: String(frontmatter.name || name),
            category,
            source: "builtin",
            path: skillPath,
            summary: summarizeMarkdown(body),
            description: String(frontmatter.description || "").trim() || null,
            promptPath: await fs_1.promises.stat(promptPath).then(() => promptPath).catch(() => null),
        });
    }
    return skills
        .filter((skill) => includeSkillRecord(skill, options))
        .sort((left, right) => left.id.localeCompare(right.id));
}
async function listCustomSkills() {
    const rootDirectory = customSkillsDirectory();
    await fs_1.promises.mkdir(rootDirectory, { recursive: true });
    const entries = await fs_1.promises.readdir(rootDirectory, { withFileTypes: true }).catch(() => []);
    const skills = [];
    for (const entry of entries) {
        if (!entry.isFile() || !/\.md$/i.test(entry.name))
            continue;
        const skillPath = path.join(rootDirectory, entry.name);
        const text = await fs_1.promises.readFile(skillPath, "utf8");
        skills.push({
            id: entry.name.replace(/\.md$/i, ""),
            name: entry.name.replace(/\.md$/i, ""),
            category: null,
            source: "custom",
            path: skillPath,
            summary: summarizeMarkdown(text) || text.split(/\r?\n/, 1)[0].replace(/^#+\s*/, "").trim() || null,
            description: null,
            promptPath: null,
        });
    }
    return skills.sort((left, right) => left.id.localeCompare(right.id));
}
async function listAllSkills(options = {}) {
    const [builtin, custom] = await Promise.all([listBuiltInSkills(options), listCustomSkills()]);
    return [...builtin, ...custom];
}
async function resolveSkillRecord(name, options = {}) {
    const trimmed = String(name || "").trim();
    if (!trimmed)
        return null;
    const wanted = (0, providerUtils_1.normalize)(trimmed);
    const skills = await listAllSkills(options);
    const exact = skills.find((skill) => (0, providerUtils_1.normalize)(skill.id) === wanted || (0, providerUtils_1.normalize)(skill.name) === wanted);
    if (exact)
        return exact;
    const builtinByBasename = skills.filter((skill) => skill.source === "builtin" && (0, providerUtils_1.normalize)(skill.name) === wanted);
    return builtinByBasename.length === 1 ? builtinByBasename[0] : null;
}
async function readSkillContent(record) {
    return await fs_1.promises.readFile(record.path, "utf8");
}
async function readBuiltInSkillPrompts(ids, options = {}) {
    const prompts = [];
    for (const id of ids) {
        const skill = await resolveSkillRecord(id, options);
        if (!skill || skill.source !== "builtin")
            continue;
        if (skill.promptPath) {
            const prompt = (await fs_1.promises.readFile(skill.promptPath, "utf8")).trim();
            if (prompt) {
                prompts.push(prompt);
                continue;
            }
        }
        if (skill.description)
            prompts.push(skill.description);
    }
    return prompts;
}
//# sourceMappingURL=providerSkills.js.map