import { promises as fsp } from "fs";
import * as path from "path";
import YAML from "yaml";
import { pluginDataDirectory } from "./providerState";
import { normalize } from "./providerUtils";

export type SkillRecord = {
  id: string;
  name: string;
  category: string | null;
  source: "builtin" | "custom";
  path: string;
  summary: string | null;
  description: string | null;
  promptPath: string | null;
};

export type SkillQueryOptions = {
  includePerAppAutomationSkills?: boolean;
};

const PER_APP_AUTOMATION_SKILL_IDS = new Set<string>([
  "desktop/per-app-automation-guidance",
]);

type SkillFrontmatter = {
  name?: string;
  description?: string;
};

function parseFrontmatter(text: string): { frontmatter: SkillFrontmatter; body: string } {
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
    const frontmatter = YAML.parse(yamlText) || {};
    return { frontmatter, body };
  } catch {
    return { frontmatter: {}, body: text };
  }
}

function summarizeMarkdown(body: string): string | null {
  const line = body
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry && !entry.startsWith("#") && !entry.startsWith("---") && !entry.startsWith("- ") && !/^\d+\./.test(entry));
  return line || null;
}

export function builtInSkillsDirectory(): string {
  return path.resolve(__dirname, "..", "..", "builtin-skills");
}

export function customSkillsDirectory(): string {
  return path.join(pluginDataDirectory(), "default", "skills");
}

async function listBuiltinSkillFiles(rootDirectory: string): Promise<string[]> {
  const results: string[] = [];
  const walk = async (currentDirectory: string) => {
    const entries = await fsp.readdir(currentDirectory, { withFileTypes: true }).catch(() => []);
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

function includeSkillRecord(skill: SkillRecord, options: SkillQueryOptions = {}): boolean {
  const includePerAppAutomationSkills = options.includePerAppAutomationSkills ?? true;
  if (!includePerAppAutomationSkills && PER_APP_AUTOMATION_SKILL_IDS.has(skill.id)) {
    return false;
  }
  return true;
}

export async function listBuiltInSkills(options: SkillQueryOptions = {}): Promise<SkillRecord[]> {
  const rootDirectory = builtInSkillsDirectory();
  const files = await listBuiltinSkillFiles(rootDirectory);
  const skills: SkillRecord[] = [];
  for (const skillPath of files) {
    const relativeFolder = path.relative(rootDirectory, path.dirname(skillPath)).replace(/\\/g, "/");
    const segments = relativeFolder.split("/").filter(Boolean);
    if (segments.length < 2) continue;
    const [category, ...rest] = segments;
    const name = rest[rest.length - 1];
    const text = await fsp.readFile(skillPath, "utf8");
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
      promptPath: await fsp.stat(promptPath).then(() => promptPath).catch(() => null),
    });
  }
  return skills
    .filter((skill) => includeSkillRecord(skill, options))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export async function listCustomSkills(): Promise<SkillRecord[]> {
  const rootDirectory = customSkillsDirectory();
  await fsp.mkdir(rootDirectory, { recursive: true });
  const entries = await fsp.readdir(rootDirectory, { withFileTypes: true }).catch(() => []);
  const skills: SkillRecord[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/\.md$/i.test(entry.name)) continue;
    const skillPath = path.join(rootDirectory, entry.name);
    const text = await fsp.readFile(skillPath, "utf8");
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

export async function listAllSkills(options: SkillQueryOptions = {}): Promise<SkillRecord[]> {
  const [builtin, custom] = await Promise.all([listBuiltInSkills(options), listCustomSkills()]);
  return [...builtin, ...custom];
}

export async function resolveSkillRecord(name: string, options: SkillQueryOptions = {}): Promise<SkillRecord | null> {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;
  const wanted = normalize(trimmed);
  const skills = await listAllSkills(options);
  const exact = skills.find((skill) => normalize(skill.id) === wanted || normalize(skill.name) === wanted);
  if (exact) return exact;
  const builtinByBasename = skills.filter((skill) => skill.source === "builtin" && normalize(skill.name) === wanted);
  return builtinByBasename.length === 1 ? builtinByBasename[0] : null;
}

export async function readSkillContent(record: SkillRecord): Promise<string> {
  return await fsp.readFile(record.path, "utf8");
}

export async function readBuiltInSkillPrompts(ids: string[], options: SkillQueryOptions = {}): Promise<string[]> {
  const prompts: string[] = [];
  for (const id of ids) {
    const skill = await resolveSkillRecord(id, options);
    if (!skill || skill.source !== "builtin") continue;
    if (skill.promptPath) {
      const prompt = (await fsp.readFile(skill.promptPath, "utf8")).trim();
      if (prompt) {
        prompts.push(prompt);
        continue;
      }
    }
    if (skill.description) prompts.push(skill.description);
  }
  return prompts;
}
