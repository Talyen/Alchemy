import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const CONTENT_BUILDERS = new Map([
  ["src/lib/game-data/talents/talent-pool-definitions.ts", new Set(["talent"])],
  ["src/lib/gear/affix-catalog.ts", new Set(["uniqueAffix", "resistAffix"])],
]);

/** Parse source locations only; never import or execute authored content or tests. */
export function sourceOutline(rootDir, relativePath, { entries = false, tests = false } = {}) {
  const ts = require("typescript");
  const absolute = path.resolve(rootDir, relativePath);
  const source = fs.readFileSync(absolute, "utf8");
  const file = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
  const location = (node, name) => ({
    name,
    path: relativePath,
    start: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
    end: file.getLineAndCharacterOfPosition(node.end).line + 1,
    text: node.getText(file),
  });
  if (tests) return testOutline(ts, file, location);
  if (entries) {
    const found = [];
    const sourcePath = path.relative(rootDir, absolute).replaceAll(path.sep, "/");
    const builders = /^src\/lib\/game-data\/talents\/pools\/[^/]+\.ts$/u.test(sourcePath)
      ? new Set(["talent"])
      : ["src/lib/gear/ordinary-affixes.ts", "src/lib/gear/unique-affixes.ts"].includes(sourcePath)
        ? new Set(["uniqueAffix", "resistAffix"])
        : CONTENT_BUILDERS.get(sourcePath);
    const literalName = (node) =>
      node && (ts.isStringLiteral(node) || ts.isNumericLiteral(node) || ts.isIdentifier(node)) ? node.text : null;
    const unwrap = (node) => {
      while (ts.isSatisfiesExpression(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node))
        node = node.expression;
      return node;
    };
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && builders?.has(node.expression.text)) {
        const id = node.arguments[0];
        if (id && ts.isStringLiteral(id)) {
          found.push(location(node, id.text));
          return;
        }
      }
      if (ts.isObjectLiteralExpression(node)) {
        const id = node.properties.find(
          (property) => ts.isPropertyAssignment(property) && literalName(property.name) === "id",
        );
        if (id && (ts.isStringLiteral(id.initializer) || ts.isNumericLiteral(id.initializer))) {
          found.push(location(node, id.initializer.text));
          return; // The entry owns its nested configuration; do not index roll tiers or effects.
        }
        // Keyed catalogs are top-level variable initializers, not arbitrary nested objects.
        if (
          ts.isVariableDeclaration(node.parent) ||
          (ts.isSatisfiesExpression(node.parent) && ts.isVariableDeclaration(node.parent.parent)) ||
          (ts.isAsExpression(node.parent) && ts.isVariableDeclaration(node.parent.parent))
        ) {
          for (const property of node.properties) {
            if (!ts.isPropertyAssignment(property)) continue;
            const value = unwrap(property.initializer);
            const previous = found.length;
            visit(value);
            // Prefer stable IDs inside grouped catalogs; leaf keyed entries need no ID.
            if (found.length === previous && ts.isObjectLiteralExpression(value)) {
              const name = literalName(property.name);
              if (name) found.push(location(property, name));
            }
          }
          return;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
    return found;
  }
  return file.statements.flatMap((statement) => {
    const names = ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.map((declaration) => declaration.name.getText(file))
      : statement.name
        ? [statement.name.getText(file)]
        : [];
    return names.map((name) => location(statement, name));
  });
}

function testOutline(ts, file, location) {
  const roots = new Set(["describe", "it", "test"]);
  const modifiers = new Set(["each", "skip", "only", "todo", "concurrent", "sequential", "fails", "skipIf", "runIf"]);
  function invocation(node) {
    if (!ts.isCallExpression(node)) return null;
    let expression = node.expression;
    while (!ts.isIdentifier(expression)) {
      if (ts.isPropertyAccessExpression(expression)) {
        if (!modifiers.has(expression.name.text)) return null;
        expression = expression.expression;
      } else if (ts.isCallExpression(expression)) expression = expression.expression;
      else if (ts.isTaggedTemplateExpression(expression)) expression = expression.tag;
      else return null;
    }
    if (!roots.has(expression.text)) return null;
    const title = node.arguments[0];
    const callback = node.arguments.find((arg) => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg));
    // Exclude the intermediate .each(cases) / .skipIf(condition) invocation.
    if (!title || (!callback && !(ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title)))) return null;
    const name =
      ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title)
        ? title.text
        : `[dynamic: ${title.getText(file).slice(0, 120)}]`;
    return { kind: expression.text, name, callback };
  }
  const found = [];
  const setupPointers = (scope) =>
    scope.statements
      .filter((statement) => !(ts.isExpressionStatement(statement) && invocation(statement.expression)))
      .map((statement) => {
        const label = statement.getText(file).split("\n")[0].slice(0, 100);
        const entry = location(statement, label);
        return `${entry.path}:${entry.start}-${entry.end}: ${label}`;
      });
  function visit(node, suites, setup) {
    const call = invocation(node);
    if (call) {
      const names = [...suites, call.name];
      if (call.kind === "describe") {
        const body = call.callback?.body;
        if (body && ts.isBlock(body)) visit(body, names, [...setup, ...setupPointers(body)]);
      } else found.push({ ...location(node, names.join(" > ")), setup });
      return;
    }
    ts.forEachChild(node, (child) => visit(child, suites, setup));
  }
  visit(file, [], setupPointers(file));
  return found;
}
