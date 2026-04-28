"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamicToolNameSchema = void 0;
exports.normalize = normalize;
exports.expandEnvironmentPath = expandEnvironmentPath;
exports.levenshteinDistance = levenshteinDistance;
exports.computeFuzzyScore = computeFuzzyScore;
exports.truncateOutput = truncateOutput;
exports.json = json;
exports.cavemanifyToolResult = cavemanifyToolResult;
exports.escapeForPython = escapeForPython;
exports.indentPython = indentPython;
exports.quote = quote;
exports.asArray = asArray;
exports.toNumberOrNull = toNumberOrNull;
exports.splitCommandList = splitCommandList;
exports.mergeDefined = mergeDefined;
exports.parseJsonArrayOfStrings = parseJsonArrayOfStrings;
exports.parseJsonObject = parseJsonObject;
const zod_1 = require("zod");
exports.dynamicToolNameSchema = zod_1.z.string().regex(/^[A-Za-z0-9_-]+$/);
function normalize(input) {
    return input.toLowerCase().replace(/\s+/g, " ").trim();
}
function expandEnvironmentPath(input) {
    let value = String(input || "");
    if (!value)
        return value;
    value = value.replace(/%([^%]+)%/g, (_match, rawName) => {
        const wanted = String(rawName || "").trim().toLowerCase();
        const key = Object.keys(process.env).find((entry) => entry.toLowerCase() === wanted);
        return key ? String(process.env[key] || "") : `%${rawName}%`;
    });
    value = value.replace(/\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, braced, bare) => {
        const rawName = String(braced || bare || "").trim();
        const key = Object.keys(process.env).find((entry) => entry === rawName);
        return key ? String(process.env[key] || "") : match;
    });
    if (value === "~") {
        return process.env.USERPROFILE || process.env.HOME || value;
    }
    if (/^~[\\/]/.test(value)) {
        const home = process.env.USERPROFILE || process.env.HOME;
        if (home)
            return `${home}${value.slice(1)}`;
    }
    return value;
}
function levenshteinDistance(a, b) {
    const left = normalize(a);
    const right = normalize(b);
    const m = left.length;
    const n = right.length;
    if (m === 0)
        return n;
    if (n === 0)
        return m;
    const prev = new Array(n + 1);
    const curr = new Array(n + 1);
    for (let j = 0; j <= n; j++)
        prev[j] = j;
    for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
            const cost = left[i - 1] === right[j - 1] ? 0 : 1;
            curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        }
        for (let j = 0; j <= n; j++)
            prev[j] = curr[j];
    }
    return prev[n];
}
function computeFuzzyScore(query, candidate) {
    const q = normalize(query);
    const c = normalize(candidate);
    if (!q || !c)
        return 0;
    if (q === c)
        return 1;
    if (c.includes(q)) {
        const coverage = q.length / c.length;
        return Math.min(1, 0.85 + coverage * 0.15);
    }
    const distance = levenshteinDistance(q, c);
    const maxLen = Math.max(q.length, c.length);
    return Math.max(0, 1 - distance / maxLen);
}
function truncateOutput(text, maxBytes) {
    const buf = Buffer.from(text, "utf8");
    if (buf.length <= maxBytes)
        return text;
    return `${buf.slice(0, maxBytes).toString("utf8")}\n[truncated at ${maxBytes} bytes]`;
}
function json(value) {
    return JSON.stringify(value);
}
const agentFacingStringKeys = new Set([
    "note",
    "hint",
    "guidance",
    "profileSwitchGuidance",
    "followupHint",
    "nextStep",
    "availabilityReason",
    "whenToUse",
    "description",
    "summary",
    "recommendedWorkflow",
    "recommendation",
    "instructions",
]);
const literalStringKeys = new Set([
    "content",
    "stdout",
    "stderr",
    "error",
    "raw",
    "body",
    "html",
    "text",
    "value",
    "query",
    "url",
    "path",
    "diff",
    "preview",
    "command",
    "schema",
    "title",
    "name",
]);
function cavemanString(value) {
    return value
        .replace(/\bRecommendations are limited to\b/gi, "Pick only")
        .replace(/\bUse availability to distinguish\b/gi, "Check availability for")
        .replace(/\bSwitch profiles?\b/gi, "Switch profile")
        .replace(/\bbefore calling\b/gi, "before use")
        .replace(/\bDirect tool help is intended for understanding capabilities, parameters, and common use cases before calling a tool\./gi, "Tool help show what do, args, examples before use.")
        .replace(/\bPrefer names first\. Query only the tools you need\./gi, "Names first. Query only needed tools.")
        .replace(/\bRead the exported file only if you need the full reference detail\./gi, "Read file only if need full detail.")
        .replace(/\bRead the file only if needed\./gi, "Read file only if need.")
        .replace(/\bIf a recommended tool is profile_switch_required, switch profiles, stop, and wait for the next turn before calling it\./gi, "If profile_switch_required: switch profile, stop, use next turn.")
        .replace(/\bThis tool belongs to agentic-studio but is hidden by the current tool profile\. Switch profiles to make it callable on a subsequent turn\./gi, "Tool hidden by profile. Switch profile; use next turn.")
        .replace(/\bRequest it individually with as_request_tool for one-off use, or switch profiles if you expect to keep using tools from that category\. Either way, wait until the next turn before calling it\./gi, "Ask as_request_tool for one use, or switch profile for many uses. Use next turn.")
        .replace(/\bThis tool is provided by the current custom agentic-studio plugin and is callable now\. LM Studio itself does not include native tools by default\./gi, "Tool from agentic-studio. Callable now.")
        .replace(/\bCreate or update\b/gi, "Make or update")
        .replace(/\bReturn\b/gi, "Give")
        .replace(/\bList\b/gi, "Show")
        .replace(/\bInspect\b/gi, "Check")
        .replace(/\bRecommend\b/gi, "Suggest")
        .replace(/\bUse\b/gi, "Use")
        .replace(/\s+/g, " ")
        .trim();
}
function cavemanifyToolResult(value, key = "") {
    if (typeof value === "string") {
        if (literalStringKeys.has(key))
            return value;
        if (!agentFacingStringKeys.has(key))
            return value;
        return cavemanString(value);
    }
    if (Array.isArray(value)) {
        const shouldCompactItems = agentFacingStringKeys.has(key);
        return value.map((entry) => cavemanifyToolResult(entry, shouldCompactItems ? key : ""));
    }
    if (!value || typeof value !== "object")
        return value;
    const next = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
        next[entryKey] = cavemanifyToolResult(entryValue, entryKey);
    }
    return next;
}
function escapeForPython(value) {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
function indentPython(code) {
    return code.split(/\r?\n/).map((line) => `    ${line}`).join("\n");
}
function quote(value) {
    return process.platform === "win32"
        ? `"${String(value).replace(/"/g, "\"\"")}"`
        : `"${String(value).replace(/"/g, '\\"')}"`;
}
function asArray(value) {
    if (Array.isArray(value))
        return value;
    return value == null ? [] : [value];
}
function toNumberOrNull(value) {
    if (value === null || value === undefined || value === "")
        return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function splitCommandList(value) {
    const raw = String(value || "").trim();
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.map((entry) => normalize(String(entry))).filter(Boolean);
        }
    }
    catch {
        // Fall through to CSV/newline parsing.
    }
    const entries = [];
    let current = "";
    let quoteChar = "";
    for (let index = 0; index < raw.length; index++) {
        const char = raw[index];
        if (quoteChar) {
            if (char === quoteChar) {
                const next = raw[index + 1];
                if (next === quoteChar) {
                    current += char;
                    index += 1;
                }
                else {
                    quoteChar = "";
                }
            }
            else {
                current += char;
            }
            continue;
        }
        if (char === "\"" || char === "'") {
            quoteChar = char;
            continue;
        }
        if (char === "," || char === "\n" || char === "\r") {
            const trimmed = normalize(current);
            if (trimmed)
                entries.push(trimmed);
            current = "";
            continue;
        }
        current += char;
    }
    const trimmed = normalize(current);
    if (trimmed)
        entries.push(trimmed);
    return entries;
}
function mergeDefined(...objects) {
    const merged = {};
    for (const object of objects) {
        for (const [key, value] of Object.entries(object)) {
            if (value !== undefined && value !== "") {
                merged[key] = value;
            }
        }
    }
    return merged;
}
function parseJsonArrayOfStrings(value, fieldName) {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
        throw new Error(`${fieldName} must be a JSON array of strings.`);
    }
    return parsed;
}
function parseJsonObject(value, fieldName) {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`${fieldName} must be a JSON object.`);
    }
    return parsed;
}
//# sourceMappingURL=providerUtils.js.map