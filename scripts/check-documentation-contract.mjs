#!/usr/bin/env node
/** Validate durable Markdown links, paths, commands, anchors, and reachability. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateContextCatalog } from "./lib/agent-context.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { extractMarkdownLinkTargets, headingSlugs, stripFencedBlocks } from "./lib/markdown-sections.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".worktrees",
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
const REPO_PATH_PREFIX = /^(?:\.github\/|(?:src|tests|scripts|Docs|desktop|public)\/)/u;
const PATH_TEMPLATE_CHARS = /[*?{}$<>"'`]/u;

const markdownSourceCache = new Map();
let repositoryFileCache = null;

// History-only docs are exempt from content checks; reachability has its own
// broader exemption below. Backticked references add plan/decision exemptions
// because those records pin historical paths by design.
export function isHistoryOnlyDoc(relativePath) {
  return relativePath === "CHANGELOG.md" || relativePath.startsWith(".agents/history/");
}

/** Superset of isHistoryOnlyDoc: transient plans and decision records pin old paths by design. */
export function isHistoricalDoc(relativePath) {
  return (
    isHistoryOnlyDoc(relativePath) ||
    relativePath.startsWith("Docs/Plans/") ||
    relativePath === "Docs/Audits/decisions.md" ||
    relativePath === ".agents/knowledge/skill-impact.md"
  );
}

/** Reachability exemption: archives and agent-local records need no inbound owner links. */
export function isReachabilityExempt(relativePath) {
  return (
    relativePath === "CHANGELOG.md" || relativePath.startsWith("Docs/Plans/") || relativePath.startsWith(".agents/")
  );
}

function markdownFiles(directory = ROOT) {
  return repositoryFiles(directory).filter((file) => [".md", ".mdx"].includes(extname(file)));
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

/**
 * One walk over every Markdown file: source, fence-stripped text, link
 * targets, backticked candidates, and documented npm scripts. The individual
 * contract checks below read from these facts instead of re-scanning sources.
 */
const markdownFactsCache = new Map();
function markdownFacts() {
  const facts = [];
  for (const file of markdownFiles()) {
    let fact = markdownFactsCache.get(file);
    if (!fact) {
      const source = readMarkdownSource(file);
      const stripped = stripFencedBlocks(source);
      fact = {
        file,
        relative: file.slice(ROOT.length + 1).replaceAll("\\", "/"),
        source,
        stripped,
        links: extractMarkdownLinkTargets(source),
        backticked: [...stripped.matchAll(/`([^`\n]+)`/gu)],
        scripts: [...source.matchAll(/npm run ([a-zA-Z0-9:_-]+)/gu)],
      };
      markdownFactsCache.set(file, fact);
    }
    facts.push(fact);
  }
  return facts;
}

export function checkLocalMarkdownLinks() {
  const broken = [];
  for (const { file, source, links } of markdownFacts()) {
    for (const { target, index } of links) {
      if (/^(?:https?:|mailto:|#)/u.test(target)) continue;
      const relativePath = target.split("#")[0];
      if (!relativePath) continue;
      const absolutePath = resolve(dirname(file), decodeURIComponent(relativePath));
      if (!existsSync(absolutePath)) {
        broken.push(`${file.slice(ROOT.length + 1)}:${lineNumberAt(source, index)} -> ${target}`);
      }
    }
  }
  return broken;
}

export function checkInlineRepositoryPaths() {
  const missing = [];
  for (const { file, relative, backticked } of markdownFacts()) {
    if (isHistoryOnlyDoc(relative)) continue;
    for (const match of backticked) {
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
  const repositoryPaths = repositoryFiles().map((file) => file.slice(ROOT.length + 1).replaceAll("\\", "/"));
  const repositoryBasenames = new Set(repositoryPaths.map((file) => file.split("/").at(-1)));
  const generatedReferencePrefixes = ["reports/", "release-notes/"];
  const missing = [];

  for (const { file, relative: relativeDocumentPath, stripped, backticked } of markdownFacts()) {
    if (isHistoricalDoc(relativeDocumentPath)) continue;
    for (const match of backticked) {
      const candidate = match[1]?.trim();
      if (!candidate || PATH_TEMPLATE_CHARS.test(candidate) || candidate.includes(" ")) continue;
      const reference = /^(.+?\.(?:[cm]?[jt]sx?|mdx?))(?:[:#].*)?$/u.exec(candidate)?.[1];
      if (!reference) continue;
      if (generatedReferencePrefixes.some((prefix) => reference.startsWith(prefix))) continue;
      if (reference.startsWith("./") || reference.startsWith("../")) {
        if (existsSync(resolve(dirname(file), reference))) continue;
        missing.push(`${relativeDocumentPath}:${lineNumberAt(stripped, match.index)} -> ${candidate}`);
        continue;
      }
      const normalized = reference.startsWith("@/") ? `src/${reference.slice(2)}` : reference;
      const exists = normalized.includes("/")
        ? repositoryPaths.some((repoPath) => repoPath === normalized || repoPath.endsWith(`/${normalized}`))
        : repositoryBasenames.has(normalized);
      if (!exists) missing.push(`${relativeDocumentPath}:${lineNumberAt(stripped, match.index)} -> ${candidate}`);
    }
  }
  return missing;
}

export function checkDocumentedNpmScripts() {
  const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const missing = [];
  for (const { file, relative, source, scripts } of markdownFacts()) {
    if (isHistoryOnlyDoc(relative)) continue;
    for (const match of scripts) {
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
  for (const { file, relative, source, links } of markdownFacts()) {
    if (isHistoryOnlyDoc(relative)) continue;
    for (const { target, index } of links) {
      if (/^(?:https?:|mailto:)/u.test(target) || !target.includes("#")) continue;
      const [relativePath, ...anchorParts] = target.split("#");
      const anchor = decodeURIComponent(anchorParts.join("#"));
      if (!anchor) continue;
      const absolutePath = relativePath ? resolve(dirname(file), decodeURIComponent(relativePath)) : file;
      if (!existsSync(absolutePath) || !absolutePath.endsWith(".md") || absolutePath.endsWith("CHANGELOG.md")) {
        continue;
      }
      if (!slugsFor(absolutePath).has(anchor)) {
        broken.push(`${file.slice(ROOT.length + 1)}:${lineNumberAt(source, index)} -> ${target}`);
      }
    }
  }
  return broken;
}

export function checkDurableDocumentReachability(rootDir = ROOT) {
  const isExempt = isReachabilityExempt;
  const documents = new Map();
  for (const file of markdownFiles(rootDir)) {
    const relativePath = file.slice(rootDir.length + 1).replaceAll("\\", "/");
    if (isExempt(relativePath)) continue;
    const targets = new Set();
    for (const { target } of extractMarkdownLinkTargets(readMarkdownSource(file))) {
      if (/^(?:https?:|mailto:|#)/u.test(target)) continue;
      const absolutePath = resolve(dirname(file), decodeURIComponent(target.split("#")[0]));
      if (!/\.(?:md|mdx)$/u.test(absolutePath)) continue;
      const targetRelativePath = absolutePath.slice(rootDir.length + 1).replaceAll("\\", "/");
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

export const DOCUMENTATION_CONTRACTS = [
  ["local Markdown links", checkLocalMarkdownLinks],
  ["inline repository paths", checkInlineRepositoryPaths],
  ["backticked current file references", checkBacktickedCurrentFileReferences],
  ["documented npm scripts", checkDocumentedNpmScripts],
  ["Markdown heading anchors", checkMarkdownHeadingAnchors],
  ["durable document reachability", checkDurableDocumentReachability],
  ["knowledge index completeness", checkKnowledgeIndexCompleteness],
  ["skill index completeness", checkSkillIndexCompleteness],
  ["agent discovery catalog", () => validateContextCatalog(ROOT)],
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
