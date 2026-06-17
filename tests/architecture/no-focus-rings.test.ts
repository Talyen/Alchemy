import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");
const SCAN_ROOT = join(ROOT, "src");

const ALLOWLIST = new Set(["src/lib/ui/focus.ts"]);

const FORBIDDEN_FOCUS_RING_PATTERNS = [
  { name: "focus-visible ring", pattern: /focus-visible:ring-(?!0\b|offset-)/ },
  { name: "focus-visible ring offset", pattern: /focus-visible:ring-offset-(?!0\b)/ },
  { name: "focus ring", pattern: /focus:ring-(?!0\b|offset-)/ },
] as const;

function listSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      listSourceFiles(fullPath, files);
      continue;
    }
    if (/\.(ts|tsx|css)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

function findForbiddenFocusRings(content: string) {
  const matches: string[] = [];
  for (const { name, pattern } of FORBIDDEN_FOCUS_RING_PATTERNS) {
    if (pattern.test(content)) {
      matches.push(name);
    }
  }
  return matches;
}

describe("no focus rings guard", () => {
  it("does not add focus ring utilities outside NO_FOCUS_RING", () => {
    const violations: string[] = [];

    for (const filePath of listSourceFiles(SCAN_ROOT)) {
      const relPath = relative(ROOT, filePath).replaceAll("\\", "/");
      if (ALLOWLIST.has(relPath)) continue;
      const content = readFileSync(filePath, "utf8");
      const matches = findForbiddenFocusRings(content);
      if (matches.length > 0) {
        violations.push(`${relPath} (${matches.join(", ")})`);
      }
    }

    expect(violations).toEqual([]);
  });
});
