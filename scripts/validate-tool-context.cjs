const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const tsconfigPath = path.join(root, "tsconfig.json");
const providerCorePath = path.join(root, "src", "shared", "providerCore.ts");
const toolsDirectory = path.join(root, "src", "tools");

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function extractSharedToolContextKeys(source) {
  const marker = "const sharedToolContext = {";
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error("Could not find sharedToolContext in providerCore.ts");
  }

  let index = start + marker.length;
  let depth = 1;
  let body = "";
  while (index < source.length && depth > 0) {
    const char = source[index++];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth > 0) body += char;
  }

  const keys = new Set();
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    const match = trimmed.match(/^([A-Za-z_$][\w$]*)\s*:/) || trimmed.match(/^([A-Za-z_$][\w$]*),?$/);
    if (match) keys.add(match[1]);
  }
  return keys;
}

function extractCtxKeys(source) {
  const match = source.match(/const\s*\{([\s\S]*?)\}\s*=\s*ctx\s+as\s+any;/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/\s*=.*$/, ""))
    .map((entry) => entry.replace(/\s+as\s+.*/, ""))
    .map((entry) => entry.replace(/^[.]{3}/, ""))
    .map((entry) => entry.replace(/:.*$/, ""))
    .filter(Boolean);
}

function stripStringsAndComments(source) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, source);
  const removableKinds = new Set([
    ts.SyntaxKind.SingleLineCommentTrivia,
    ts.SyntaxKind.MultiLineCommentTrivia,
    ts.SyntaxKind.StringLiteral,
    ts.SyntaxKind.NoSubstitutionTemplateLiteral,
    ts.SyntaxKind.TemplateHead,
    ts.SyntaxKind.TemplateMiddle,
    ts.SyntaxKind.TemplateTail,
    ts.SyntaxKind.RegularExpressionLiteral,
  ]);
  let result = "";
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const text = scanner.getTokenText();
    result += removableKinds.has(token) ? " ".repeat(text.length) : text;
  }
  return result;
}

function countIdentifierUsage(source, identifier) {
  const sanitized = stripStringsAndComments(source);
  const pattern = new RegExp(`\\b${identifier.replace(/[$]/g, "\\$&")}\\b`, "g");
  return (sanitized.match(pattern) || []).length;
}

function stripTsNoCheckDirective(source) {
  return source
    .replace(/^\s*\/\/\s*@ts-nocheck\s*$/m, "")
    .replace(/^\s*\/\*\s*@ts-nocheck\s*\*\/\s*$/m, "");
}

function collectUnresolvedToolIdentifiers() {
  const configResult = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configResult.error) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext([configResult.error], {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => root,
      getNewLine: () => ts.sys.newLine,
    }));
  }

  const parsed = ts.parseJsonConfigFileContent(configResult.config, ts.sys, root);
  const toolFileSet = new Set(
    parsed.fileNames
      .map((fileName) => path.resolve(fileName))
      .filter((fileName) => fileName.startsWith(path.resolve(toolsDirectory) + path.sep) && fileName.endsWith(".ts")),
  );
  const overriddenSources = new Map();
  for (const fileName of toolFileSet) {
    overriddenSources.set(fileName, stripTsNoCheckDirective(readFile(fileName)));
  }

  const host = ts.createCompilerHost({ ...parsed.options, noEmit: true });
  const originalReadFile = host.readFile.bind(host);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.readFile = (fileName) => {
    const resolved = path.resolve(fileName);
    if (overriddenSources.has(resolved)) return overriddenSources.get(resolved);
    return originalReadFile(fileName);
  };
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const resolved = path.resolve(fileName);
    const content = overriddenSources.get(resolved);
    if (typeof content === "string") {
      return ts.createSourceFile(fileName, content, languageVersion, true);
    }
    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };

  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: { ...parsed.options, noEmit: true },
    host,
  });

  function findInnermostNode(sourceFile, position) {
    let best = sourceFile;
    const visit = (node) => {
      if (position < node.getFullStart() || position >= node.getEnd()) return;
      best = node;
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return best;
  }

  function isTypeOnlyDiagnostic(diagnostic) {
    if (!diagnostic.file || typeof diagnostic.start !== "number") return false;
    let current = findInnermostNode(diagnostic.file, diagnostic.start);
    while (current) {
      if (ts.isTypeNode(current)) return true;
      current = current.parent;
    }
    return false;
  }

  return ts.getPreEmitDiagnostics(program)
    .filter((diagnostic) => {
      if (!diagnostic.file || ![2304, 2552].includes(diagnostic.code)) return false;
      const fileName = path.resolve(diagnostic.file.fileName);
      return toolFileSet.has(fileName) && !isTypeOnlyDiagnostic(diagnostic);
    })
    .map((diagnostic) => {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start || 0);
      return {
        file: path.relative(root, diagnostic.file.fileName),
        line: line + 1,
        column: character + 1,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      };
    });
}

function main() {
  const providerCoreSource = readFile(providerCorePath);
  const sharedKeys = extractSharedToolContextKeys(providerCoreSource);
  const sharedKeyList = [...sharedKeys];
  const toolFiles = fs.readdirSync(toolsDirectory).filter((file) => file.endsWith(".ts"));

  const missingUsed = [];
  const sharedKeysUsedWithoutCtx = [];

  for (const file of toolFiles) {
    const filePath = path.join(toolsDirectory, file);
    const source = readFile(filePath);
    const ctxKeys = extractCtxKeys(source);
    const ctxKeySet = new Set(ctxKeys);
    if (ctxKeys.length === 0) continue;

    const usedKeys = ctxKeys.filter((key) => countIdentifierUsage(source, key) > 1);
    const missingKeys = usedKeys.filter((key) => !sharedKeys.has(key));
    if (missingKeys.length > 0) {
      missingUsed.push({ file, keys: missingKeys });
    }

    const missingCtxKeys = sharedKeyList.filter((key) => {
      if (ctxKeySet.has(key)) return false;
      return countIdentifierUsage(source, key) > 0;
    });
    if (missingCtxKeys.length > 0) {
      sharedKeysUsedWithoutCtx.push({ file, keys: missingCtxKeys });
    }
  }

  if (missingUsed.length > 0) {
    console.error("Missing sharedToolContext bindings for used ctx properties:");
    for (const item of missingUsed) {
      console.error(`- ${item.file}: ${item.keys.join(", ")}`);
    }
    process.exit(1);
  }

  if (sharedKeysUsedWithoutCtx.length > 0) {
    console.error("Shared helpers used in tool modules without ctx destructuring:");
    for (const item of sharedKeysUsedWithoutCtx) {
      console.error(`- ${item.file}: ${item.keys.join(", ")}`);
    }
    process.exit(1);
  }

  const unresolvedIdentifiers = collectUnresolvedToolIdentifiers();
  if (unresolvedIdentifiers.length > 0) {
    console.error("Unresolved identifier usage detected in tool modules:");
    for (const item of unresolvedIdentifiers) {
      console.error(`- ${item.file}:${item.line}:${item.column} ${item.message}`);
    }
    process.exit(1);
  }

  console.log(`Validated tool context contract across ${toolFiles.length} tool modules.`);
}

main();
