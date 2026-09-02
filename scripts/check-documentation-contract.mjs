#!/usr/bin/env node
/** Validate durable Markdown links, paths, commands, anchors, and reachability. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IGNORED_DIRECTORIES = new Set([
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
const REPO_PATH_PREFIX = /^(?:\.github\/|(?:src|tests|scripts|docs|desktop|public)\/)/u;
const PATH_TEMPLATE_CHARS = /[*?{}$<>"'`]/u;

let markdownFileCache = null;
const markdownSourceCache = new Map();
let repositoryFileCache = null;

function markdownFiles(directory = ROOT) {
  if (directory !== ROOT || markdownFileCache) {
    if (directory === ROOT && markdownFileCache) return markdownFileCache;
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      if (entry.isDirectory()) {
        return IGNORED_DIRECTORIES.has(entry.name) ? [] : markdownFiles(join(directory, entry.name));
      }
      return [".md", ".mdx"].includes(extname(entry.name)) ? [join(directory, entry.name)] : [];
    });
  }
  markdownFileCache = readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name) ? [] : markdownFiles(join(directory, entry.name));
    }
    return [".md", ".mdx"].includes(extname(entry.name)) ? [join(directory, entry.name)] : [];
  });
  return markdownFileCache;
}

function readMarkdownSource(file) {
  const cached = markdownSourceCache.get(file);
  if (cached !== undefined) return cached;
  const source = readFileSync(file, "utf8");
  markdownSourceCache.set(file, source);
  return source;
}

function repositoryFiles(directory = ROOT) {
  if (directory === ROOT && repositoryFileCache) return repositoryFileCache;
  const files = readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name) ? [] : repositoryFiles(join(directory, entry.name));
    }
    return [join(directory, entry.name)];
  });
  if (directory === ROOT) repositoryFileCache = files;
  return files;
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function githubHeadingSlug(title) {
  return title
    .toLowerCase()
    .replaceAll(/<[^>]*>/gu, "")
    .replaceAll(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/gu, "")
    .replaceAll(/\s/gu, "-");
}

function headingPlainText(raw) {
  return raw
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replaceAll(/\[([^\]]+)\]\[[^\]]*\]/gu, "$1")
    .replaceAll(/`([^`]+)`/gu, "$1")
    .replaceAll(/\*/gu, "")
    .trim();
}

function headingSlugs(source) {
  const slugs = new Set();
  const seen = new Map();
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

function stripFencedBlocks(source) {
  const kept = [];
  let inFence = false;
  for (const line of source.split("\n")) {
    if (/^\s{0,3}(?:```|~~~)/u.test(line)) inFence = !inFence;
    else if (!inFence) kept.push(line);
  }
  return kept.join("\n");
}

export function checkLocalMarkdownLinks() {
  const broken = [];
  for (const file of markdownFiles()) {
    const source = readMarkdownSource(file);
    for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
      const target = match[1]?.split(/\s+/u)[0]?.replace(/^<|>$/gu, "");
      if (!target || /^(?:https?:|mailto:|#)/u.test(target)) continue;
      const relativePath = target.split("#")[0];
      if (!relativePath) continue;
      const absolutePath = resolve(dirname(file), decodeURIComponent(relativePath));
      if (!existsSync(absolutePath)) {
        broken.push(`${file.slice(ROOT.length + 1)}:${lineNumberAt(source, match.index)} -> ${target}`);
      }
    }
  }
  return broken;
}

export function checkInlineRepositoryPaths() {
  const missing = [];
  for (const file of markdownFiles()) {
    if (file.endsWith("CHANGELOG.md")) continue;
    const source = stripFencedBlocks(readMarkdownSource(file));
    for (const match of source.matchAll(/`([^`\n]+)`/gu)) {
      const candidate = match[1].trim();
      if (!REPO_PATH_PREFIX.test(candidate) || PATH_TEMPLATE_CHARS.test(candidate)) continue;
      const target = candidate.split("#")[0];
      if (target && !existsSync(resolve(ROOT, target))) {
        missing.push(`${file.slice(ROOT.length + 1)} -> ${candidate}`);
      }
    }
  }
  return missing;
}

export function checkBacktickedCurrentFileReferences() {
  const isHistorical = (relativePath) =>
    relativePath === "CHANGELOG.md" ||
    relativePath.startsWith("docs/Plans/") ||
    relativePath === "docs/Audits/decisions.md" ||
    relativePath === ".agents/knowledge/skill-impact.md";
  const repositoryPaths = repositoryFiles().map((file) => file.slice(ROOT.length + 1).replaceAll("\\", "/"));
  const repositoryBasenames = new Set(repositoryPaths.map((file) => file.split("/").at(-1)));
  const generatedReferencePrefixes = ["reports/", "release-notes/"];
  const missing = [];

  for (const file of markdownFiles()) {
    const relativeDocumentPath = file.slice(ROOT.length + 1).replaceAll("\\", "/");
    if (isHistorical(relativeDocumentPath)) continue;
    const source = stripFencedBlocks(readMarkdownSource(file));
    for (const match of source.matchAll(/`([^`\n]+)`/gu)) {
      const candidate = match[1]?.trim();
      if (!candidate || PATH_TEMPLATE_CHARS.test(candidate) || candidate.includes(" ")) continue;
      const reference = /^(.+?\.(?:[cm]?[jt]sx?|mdx?))(?:[:#].*)?$/u.exec(candidate)?.[1];
      if (!reference) continue;
      if (generatedReferencePrefixes.some((prefix) => reference.startsWith(prefix))) continue;
      if (reference.startsWith("./") || reference.startsWith("../")) {
        if (existsSync(resolve(dirname(file), reference))) continue;
        missing.push(`${relativeDocumentPath}:${lineNumberAt(source, match.index)} -> ${candidate}`);
        continue;
      }
      const normalized = reference.startsWith("@/") ? `src/${reference.slice(2)}` : reference;
      const exists = normalized.includes("/")
        ? repositoryPaths.some((repoPath) => repoPath === normalized || repoPath.endsWith(`/${normalized}`))
        : repositoryBasenames.has(normalized);
      if (!exists) missing.push(`${relativeDocumentPath}:${lineNumberAt(source, match.index)} -> ${candidate}`);
    }
  }
  return missing;
}

export function checkDocumentedNpmScripts() {
  const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const missing = [];
  for (const file of markdownFiles()) {
    const source = readMarkdownSource(file);
    for (const match of source.matchAll(/npm run ([a-zA-Z0-9:_-]+)/gu)) {
      const script = match[1];
      if (script && !packageJson.scripts[script]) {
        missing.push(`${file.slice(ROOT.length + 1)}:${lineNumberAt(source, match.index)} -> ${script}`);
      }
    }
  }
  return missing;
}

export function checkMarkdownHeadingAnchors() {
  const slugCache = new Map();
  const slugsFor = (absolutePath) => {
    const cached = slugCache.get(absolutePath);
    if (cached) return cached;
    const slugs = headingSlugs(markdownSourceCache.get(absolutePath) ?? readFileSync(absolutePath, "utf8"));
    slugCache.set(absolutePath, slugs);
    return slugs;
  };
  const broken = [];
  for (const file of markdownFiles()) {
    if (file.endsWith("CHANGELOG.md")) continue;
    const source = readMarkdownSource(file);
    for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
      const target = match[1]?.split(/\s+/u)[0]?.replace(/^<|>$/gu, "");
      if (!target || /^(?:https?:|mailto:)/u.test(target) || !target.includes("#")) continue;
      const [relativePath, ...anchorParts] = target.split("#");
      const anchor = decodeURIComponent(anchorParts.join("#"));
      if (!anchor) continue;
      const absolutePath = relativePath ? resolve(dirname(file), decodeURIComponent(relativePath)) : file;
      if (!existsSync(absolutePath) || !absolutePath.endsWith(".md") || absolutePath.endsWith("CHANGELOG.md")) {
        continue;
      }
      if (!slugsFor(absolutePath).has(anchor)) {
        broken.push(`${file.slice(ROOT.length + 1)}:${lineNumberAt(source, match.index)} -> ${target}`);
      }
    }
  }
  return broken;
}

export function checkContributingE2ePaths() {
  const source = readFileSync(join(ROOT, "CONTRIBUTING.md"), "utf8");
  const missing = [];
  for (const match of source.matchAll(/`tests\/[a-zA-Z0-9._/-]+\.spec\.ts`/gu)) {
    const relativePath = match[0].slice(1, -1);
    if (!existsSync(join(ROOT, relativePath))) missing.push(relativePath);
  }
  return missing;
}

export function checkDurableDocumentReachability() {
  const isExempt = (relativePath) =>
    relativePath === "CHANGELOG.md" || relativePath.startsWith("docs/Plans/") || relativePath.startsWith(".agents/");
  const documents = new Map();
  for (const file of markdownFiles()) {
    const relativePath = file.slice(ROOT.length + 1);
    if (isExempt(relativePath)) continue;
    const targets = new Set();
    for (const match of readMarkdownSource(file).matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
      const target = match[1]?.split(/\s+/u)[0]?.replace(/^<|>$/gu, "");
      if (!target || /^(?:https?:|mailto:|#)/u.test(target)) continue;
      const absolutePath = resolve(dirname(file), decodeURIComponent(target.split("#")[0]));
      if (!/\.(?:md|mdx)$/u.test(absolutePath)) continue;
      const targetRelativePath = absolutePath.slice(ROOT.length + 1);
      if (targetRelativePath !== relativePath && !isExempt(targetRelativePath)) targets.add(targetRelativePath);
    }
    documents.set(relativePath, targets);
  }

  const entryPoints = ["AGENTS.md", "README.md"];
  const reachable = new Set(entryPoints);
  const queue = [...reachable];
  while (queue.length > 0) {
    for (const next of documents.get(queue.pop() ?? "") ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  return [...documents.keys()].filter((relativePath) => !reachable.has(relativePath));
}

export function checkKnowledgeIndexCompleteness() {
  const knowledgeDir = join(ROOT, ".agents", "knowledge", "patterns");
  const indexPath = join(ROOT, ".agents", "knowledge", "index.md");
  if (!existsSync(knowledgeDir) || !existsSync(indexPath)) return [];
  const patterns = readdirSync(knowledgeDir).filter((name) => name.endsWith(".md"));
  const indexSource = readFileSync(indexPath, "utf8");
  return patterns
    .filter((name) => !indexSource.includes(name))
    .map((name) => `knowledge index missing: .agents/knowledge/patterns/${name}`);
}

export function checkSkillIndexCompleteness() {
  const skillsDir = join(ROOT, ".agents", "skills");
  const indexPath = join(skillsDir, "README.md");
  if (!existsSync(skillsDir) || !existsSync(indexPath)) return [];
  const skillNames = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(skillsDir, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
  const tableSource = readFileSync(indexPath, "utf8")
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .join("\n");
  const routedNames = new Set(
    [...tableSource.matchAll(/`([a-z][a-z0-9-]+)`/gu)].map((match) => match[1]).filter((name) => name !== "none"),
  );
  return [
    ...skillNames.filter((name) => !routedNames.has(name)).map((name) => `skill index missing: ${name}`),
    ...[...routedNames]
      .filter((name) => !skillNames.includes(name))
      .map((name) => `skill route has no SKILL.md: ${name}`),
  ];
}

export function checkSkillImpactLedger({ changedPaths } = {}) {
  // Enforce skill-impact history when instruction memory changes.
  // Uses git diff when available; falls back to allowing local edits without git metadata.
  let paths = changedPaths;
  if (!paths) {
    try {
      const output = execSync("git diff --name-only HEAD 2>/dev/null; git diff --cached --name-only 2>/dev/null", {
        encoding: "utf8",
      });
      paths = output.split("\n").filter(Boolean);
      // No diff (e.g. committed tree or fresh clone) — don't gate docs:check.
      if (paths.length === 0) return [];
    } catch {
      return [];
    }
  }
  const touchesInstructionMemory = paths.some(
    (p) => p.startsWith(".agents/skills/") || p.startsWith(".agents/knowledge/"),
  );
  const touchesLedger = paths.includes(".agents/knowledge/skill-impact.md");
  // Only gate when instruction memory is touched but ledger is not.
  if (touchesInstructionMemory && !touchesLedger) {
    return [
      "skill-impact ledger missing: .agents/knowledge/skill-impact.md must be updated when .agents/skills/ or .agents/knowledge/ changes",
    ];
  }
  return [];
}

export const DOCUMENTATION_CONTRACTS = [
  ["local Markdown links", checkLocalMarkdownLinks],
  ["inline repository paths", checkInlineRepositoryPaths],
  ["backticked current file references", checkBacktickedCurrentFileReferences],
  ["documented npm scripts", checkDocumentedNpmScripts],
  ["Markdown heading anchors", checkMarkdownHeadingAnchors],
  ["CONTRIBUTING E2E paths", checkContributingE2ePaths],
  ["durable document reachability", checkDurableDocumentReachability],
  ["knowledge index completeness", checkKnowledgeIndexCompleteness],
  ["skill index completeness", checkSkillIndexCompleteness],
  ["skill-impact ledger", checkSkillImpactLedger],
];

export function checkDocumentationContracts() {
  return DOCUMENTATION_CONTRACTS.flatMap(([name, check]) => check().map((failure) => `${name}: ${failure}`));
}

export function reportDocumentationContracts() {
  const failures = checkDocumentationContracts();
  if (failures.length > 0) {
    console.error("Documentation contracts failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    return false;
  }
  console.log(`Documentation contracts passed (${DOCUMENTATION_CONTRACTS.length} checks).`);
  return true;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = reportDocumentationContracts() ? 0 : 1;
}
