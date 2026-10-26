#!/usr/bin/env node
/** Validate durable Markdown links, paths, commands, anchors, and reachability. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateContextCatalog } from "./lib/agent/agent-context.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { BUILD_ARTIFACT_DIRS } from "./lib/clean-dev-artifacts.mjs";
import { extractMarkdownLinkTargets, headingSlugs } from "./lib/agent/markdown-sections.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".worktrees",
  "node_modules",
  ...BUILD_ARTIFACT_DIRS,
  "dist-desktop",
  "test-results",
  "playwright-report",
  "coverage",
  "reports",
  "release-notes",
]);

const markdownSourceCache = new Map();
let repositoryFileCache = null;

// Release notes intentionally retain historical commands.
export function isHistoryOnlyDoc(relativePath) {
  return relativePath === "CHANGELOG.md";
}

/** Reachability exemption: active plans and agent-local workflows need no inbound owner links. */
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
 * One walk over every Markdown file: source, link
 * targets and documented npm scripts. The individual
 * contract checks below read from these facts instead of re-scanning sources.
 */
const markdownFactsCache = new Map();
function markdownFacts() {
  const facts = [];
  for (const file of markdownFiles()) {
    let fact = markdownFactsCache.get(file);
    if (!fact) {
      const source = readMarkdownSource(file);
      fact = {
        file,
        relative: file.slice(ROOT.length + 1).replaceAll("\\", "/"),
        source,
        links: extractMarkdownLinkTargets(source),
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
  ["documented npm scripts", checkDocumentedNpmScripts],
  ["Markdown heading anchors", checkMarkdownHeadingAnchors],
  ["agent discovery catalog", () => validateContextCatalog(ROOT)],
];

const DOCUMENTATION_ADVISORIES = [
  ["durable document reachability", checkDurableDocumentReachability],
  ["skill index completeness", checkSkillIndexCompleteness],
];

export function checkDocumentationContracts() {
  return DOCUMENTATION_CONTRACTS.flatMap(([name, check]) => check().map((failure) => `${name}: ${failure}`));
}

export function reportDocumentationContracts() {
  for (const [name, check] of DOCUMENTATION_ADVISORIES) {
    for (const finding of check()) console.warn(`Documentation advisory — ${name}: ${finding}`);
  }
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
