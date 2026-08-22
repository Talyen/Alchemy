import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-desktop",
  "release-desktop",
  "test-results",
  "playwright-report",
  "coverage",
  "reports",
  "release-notes",
]);

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

const REPO_PATH_PREFIX = /^(?:\.github\/|(?:src|tests|scripts|docs|desktop|public)\/)/u;
const PATH_TEMPLATE_CHARS = /[*?{}$<>"'`]/u;

function stripFencedBlocks(source: string): string {
  const kept: string[] = [];
  let inFence = false;
  for (const line of source.split("\n")) {
    if (/^\s{0,3}(?:```|~~~)/u.test(line)) inFence = !inFence;
    else if (!inFence) kept.push(line);
  }
  return kept.join("\n");
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

  it("keeps inline backtick repository paths valid", () => {
    const missing: string[] = [];
    for (const file of markdownFiles()) {
      if (file.endsWith("CHANGELOG.md")) continue;
      const source = stripFencedBlocks(readFileSync(file, "utf8"));
      for (const match of source.matchAll(/`([^`\n]+)`/gu)) {
        const candidate = match[1].trim();
        if (!REPO_PATH_PREFIX.test(candidate) || PATH_TEMPLATE_CHARS.test(candidate)) continue;
        const target = candidate.split("#")[0];
        if (!target || !REPO_PATH_PREFIX.test(target)) continue;
        if (!existsSync(resolve(root, target))) {
          missing.push(`${file.slice(root.length + 1)} -> ${candidate}`);
        }
      }
    }
    expect(missing).toEqual([]);
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

  it("keeps CONTRIBUTING backtick E2E spec paths existent", () => {
    const source = readFileSync(join(root, "CONTRIBUTING.md"), "utf8");
    const missing: string[] = [];
    for (const match of source.matchAll(/`tests\/[a-zA-Z0-9._/-]+\.spec\.ts`/gu)) {
      const rel = match[0].slice(1, -1);
      if (!existsSync(join(root, rel))) missing.push(rel);
    }
    expect(missing).toEqual([]);
  });

  it("keeps every durable document reachable from a documented entry point", () => {
    // Ephemeral/generated trees are exempt: plans are deleted at handoff, CHANGELOG is release-generated,
    // and .agents skill manifests load by loader convention rather than documentation links.
    const isExempt = (rel: string): boolean =>
      rel === "CHANGELOG.md" || rel.startsWith("docs/Plans/") || rel.startsWith(".agents/");
    const documents = new Map<string, Set<string>>();
    for (const file of markdownFiles()) {
      const rel = file.slice(root.length + 1);
      if (isExempt(rel)) continue;
      const targets = new Set<string>();
      for (const match of readFileSync(file, "utf8").matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
        const target = match[1]?.split(/\s+/u)[0]?.replace(/^<|>$/gu, "");
        if (!target || /^(?:https?:|mailto:|#)/u.test(target)) continue;
        const absolutePath = resolve(dirname(file), decodeURIComponent(target.split("#")[0]));
        if (!/\.(?:md|mdx)$/u.test(absolutePath)) continue;
        const targetRel = absolutePath.slice(root.length + 1);
        if (targetRel !== rel && !isExempt(targetRel)) targets.add(targetRel);
      }
      documents.set(rel, targets);
    }

    const entryPoints = ["AGENTS.md", "README.md"];
    for (const entry of entryPoints) {
      if (!documents.has(entry)) throw new Error(`entry point missing from scanned documents: ${entry}`);
    }
    const reachable = new Set<string>(entryPoints);
    const queue = [...reachable];
    while (queue.length > 0) {
      for (const next of documents.get(queue.pop() ?? "") ?? []) {
        if (!reachable.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }
    const orphans = [...documents.keys()].filter((rel) => !reachable.has(rel));
    expect(orphans).toEqual([]);
  });
});
