// Scaffolds a Vitest test file mirroring a source path.
// Usage: node scripts/scaffold-test.mjs src/lib/battle/foo.ts
//
// Creates tests/lib/battle/foo.test.ts with an appropriate template.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

// Cross-platform dir separator (string context, not regex literal)
const sep = process.platform === "win32" ? "\\" : "/";

const srcArg = process.argv[2];
if (!srcArg) {
  console.error("Usage: node scripts/scaffold-test.mjs <source-file>");
  console.error("  e.g. node scripts/scaffold-test.mjs src/lib/battle/foo.ts");
  process.exit(1);
}

const srcPath = resolve(srcArg);
if (!existsSync(srcPath)) {
  console.error(`Source file not found: ${srcPath}`);
  process.exit(1);
}

// Derive test path: src/... => tests/..., inserting .test before extension
const relativePath = relative(process.cwd(), srcPath);
if (!relativePath.startsWith("src" + sep)) {
  console.error(`Source file must be under src/ (got: ${relativePath})`);
  process.exit(1);
}

const testRelativePath = relativePath.replace(/^src[/\\]/, "tests/").replace(/\.(ts|tsx)$/, ".test.$1");
const testPath = resolve(testRelativePath);

if (existsSync(testPath)) {
  console.error(`Test file already exists: ${testPath}`);
  process.exit(1);
}

const srcContent = readFileSync(srcPath, "utf-8");
const needsJsdom =
  srcContent.includes("react") ||
  srcContent.includes("jsx") ||
  srcContent.includes("tsx") ||
  srcContent.includes("@testing-library");

const moduleName = relativePath.split(sep).pop().replace(/\.(ts|tsx)$/, "");
const srcImportPath = relativePath
  .replace(/^src[/\\]/, "@/")
  .replace(/\.(ts|tsx)$/, "");

const fixtureImport = guessFixtureImport(relativePath);

function guessFixtureImport(srcRel) {
  // Strip the src/ prefix so we match on the path under src/
  const subPath = srcRel.replace(/^src[/\\]/, "");
  if (subPath.startsWith("lib" + sep + "battle")) return `import { makeTestBattleState, makeTestCard } from "../../fixtures/battle"`;
  if (subPath.startsWith("lib" + sep + "game-data")) return `import { makeTestCard } from "../fixtures/battle"`;
  if (subPath.startsWith("lib" + sep + "routing")) return `import { makeMinimalActiveRunInput } from "../fixtures/active-run"`;
  if (subPath.startsWith("lib" + sep + "validation")) return `import { baseHomesteadSave } from "../fixtures/saves"`;
  if (subPath.startsWith("features")) return `import { makeMinimalActiveRunInput } from "../fixtures/active-run"`;
  return "";
}

const template = needsJsdom ? jsdomTemplate(moduleName, srcImportPath, fixtureImport) : unitTemplate(moduleName, srcImportPath, fixtureImport);

mkdirSync(dirname(testPath), { recursive: true });
writeFileSync(testPath, template, "utf-8");
console.log(`Created: ${testRelativePath}`);

function unitTemplate(name, importPath, fixtures) {
  const fixtureLines = fixtures ? `\n${fixtures};` : "";
  return `import { describe, expect, it } from "vitest";
import { /* TODO: import from */ } from "${importPath}";${fixtureLines}

describe("${name}", () => {
  it("TODO: describe expected behavior", () => {
    // Arrange — use fixture factories
    // Act
    // Assert
    expect(true).toBe(true);
  });
});
`;
}

function jsdomTemplate(name, importPath, fixtures) {
  const fixtureLines = fixtures ? `\n${fixtures};` : "";
  return `// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { /* TODO: import */ } from "${importPath}";${fixtureLines}

afterEach(() => {
  cleanup();
});

describe("${name}", () => {
  it("TODO: describe expected behavior", () => {
    render(<${name} />);
    expect(screen.getByText(/* ... */)).toBeDefined();
  });
});
`;
}
