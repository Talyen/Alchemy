import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const ignoredDirectories = new Set([".git", "node_modules", "dist", "dist-desktop", "release-desktop", "test-results"]);

function markdownFiles(directory = root): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) ? [] : markdownFiles(join(directory, entry.name));
    }
    return [".md", ".mdx"].includes(extname(entry.name)) ? [join(directory, entry.name)] : [];
  });
}

function lineNumberAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

describe("documentation contracts", () => {
  it("keeps local Markdown link targets valid", () => {
    const broken: string[] = [];
    for (const file of markdownFiles()) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
        const target = match[1]?.split(/\s+/u)[0]?.replace(/^<|>$/gu, "");
        if (!target || /^(?:https?:|mailto:|#)/u.test(target)) continue;
        const relativePath = target.split("#")[0];
        if (!relativePath) continue;
        const absolutePath = resolve(dirname(file), decodeURIComponent(relativePath));
        if (!existsSync(absolutePath)) {
          broken.push(`${file.slice(root.length + 1)}:${lineNumberAt(source, match.index)} -> ${target}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("documents only existing npm run scripts", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const missing: string[] = [];
    for (const file of markdownFiles()) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/npm run ([a-zA-Z0-9:_-]+)/gu)) {
        const script = match[1];
        if (script && !packageJson.scripts[script]) {
          missing.push(`${file.slice(root.length + 1)}:${lineNumberAt(source, match.index)} -> ${script}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
