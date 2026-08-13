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

/** GitHub-style heading slug (github-slugger): punctuation stripped, spaces become hyphens, duplicates get -1. */
function githubHeadingSlug(title: string): string {
  return title
    .toLowerCase()
    .replaceAll(/<[^>]*>/gu, "")
    .replaceAll(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/gu, "")
    .replaceAll(/\s/gu, "-");
}

function headingPlainText(raw: string): string {
  return raw
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replaceAll(/\[([^\]]+)\]\[[^\]]*\]/gu, "$1")
    .replaceAll(/`([^`]+)`/gu, "$1")
    .replaceAll(/\*/gu, "")
    .trim();
}

function headingSlugs(source: string): Set<string> {
  const slugs = new Set<string>();
  const seen = new Map<string, number>();
  let inFence = false;
  for (const line of source.split("\n")) {
    if (/^\s{0,3}```/u.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(line);
    if (!match?.[2]) continue;
    const base = githubHeadingSlug(headingPlainText(match[2]));
    if (!base) continue;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    slugs.add(count === 0 ? base : `${base}-${count}`);
  }
  return slugs;
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

  it("keeps Markdown heading anchors valid", () => {
    const slugCache = new Map<string, Set<string>>();
    const slugsFor = (absolutePath: string): Set<string> => {
      const cached = slugCache.get(absolutePath);
      if (cached) return cached;
      const slugs = headingSlugs(readFileSync(absolutePath, "utf8"));
      slugCache.set(absolutePath, slugs);
      return slugs;
    };

    const broken: string[] = [];
    for (const file of markdownFiles()) {
      if (file.endsWith("CHANGELOG.md")) continue;
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
        const target = match[1]?.split(/\s+/u)[0]?.replace(/^<|>$/gu, "");
        if (!target || /^(?:https?:|mailto:)/u.test(target) || !target.includes("#")) continue;
        const [relativePath, ...anchorParts] = target.split("#");
        const anchor = decodeURIComponent(anchorParts.join("#"));
        if (!anchor) continue;
        const absolutePath = relativePath ? resolve(dirname(file), decodeURIComponent(relativePath)) : file;
        if (!existsSync(absolutePath) || !absolutePath.endsWith(".md")) continue;
        if (absolutePath.endsWith("CHANGELOG.md")) continue;
        if (!slugsFor(absolutePath).has(anchor)) {
          broken.push(`${file.slice(root.length + 1)}:${lineNumberAt(source, match.index)} -> ${target}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});
