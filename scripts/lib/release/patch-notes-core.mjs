// Parses conventional commits into player-facing patch notes.
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");

const versionConfig = JSON.parse(readFileSync(path.join(root, ".versionrc.json"), "utf8"));
const TYPE_METADATA = [
  ...versionConfig.types,
  { type: "style", section: "Style", hidden: true },
  { type: "other", section: "Other", hidden: true },
];
const PLAYER_TYPES = new Set(TYPE_METADATA.filter(({ hidden }) => !hidden).map(({ type }) => type));
const USER_FACING_TRAILER = /^User-Facing:\s*(yes|no)\s*$/imu;
const IMPLEMENTATION_BULLET = /^(update|add|fix) tests\b/iu;
const TECHNICAL_TERMS = [
  "ESLint",
  "Oxlint",
  "knip",
  "lefthook",
  "commitlint",
  "tsconfig",
  "vite.config",
  "TypeScript",
  "electron-builder",
  "GitHub Actions",
  "noUnusedLocals",
  "noUnusedParameters",
  "as unknown",
];
const INFRA_PREFIXES = [
  "scripts/",
  "Docs/",
  ".github/",
  ".agents/",
  "tests/",
  // Release ranges can include commits from before the Oxlint migration.
  "eslint/",
  "lint/",
  "reports/",
  "steam/",
];
const INFRA_NAMES = new Set([
  "CHANGELOG.md",
  "package-lock.json",
  "package.json",
  "knip.config.js",
  "eslint.config.js",
  "oxlint.config.ts",
  "lefthook.yml",
  "AGENTS.md",
  "CONTRIBUTING.md",
  ".gitignore",
  ".commitlintrc.json",
  ".versionrc.json",
  "tsconfig.json",
  "tsconfig.test.json",
  "vite.config.ts",
  "playwright.config.ts",
  "playwright.electron.config.ts",
  "playwright.performance.config.ts",
  "vercel.json",
]);

const TYPE_TO_PATCH_SECTION = Object.fromEntries(
  TYPE_METADATA.filter(({ type }) => PLAYER_TYPES.has(type)).map(({ type, section }) => [
    type,
    section === "Bug Fixes" ? "Fixes" : section,
  ]),
);

export function parseConventionalCommit(subject) {
  const match = /^(?<type>\w+)(?:\((?<scope>[\w-]+)\))?(?<breaking>!)?:\s*(?<description>.+)$/u.exec(subject.trim());
  if (!match?.groups) {
    return { type: "other", scope: null, description: subject.trim(), include: false };
  }
  const type = match.groups.type;
  const include = PLAYER_TYPES.has(type);
  return {
    type,
    scope: match.groups.scope ?? null,
    description: match.groups.description,
    include,
  };
}

export function cleanCommitBody(body) {
  return (body ?? "")
    .split("\n")
    .filter((line) => !/^\s*Co-authored-by:/iu.test(line))
    .filter((line) => !USER_FACING_TRAILER.test(line.trim()))
    .join("\n")
    .trim();
}

export function userFacingTrailer(body) {
  const match = USER_FACING_TRAILER.exec(body ?? "");
  return match ? match[1].toLowerCase() : null;
}

export function isInfraPath(filePath) {
  if (INFRA_NAMES.has(filePath) || filePath.endsWith(".md") || filePath.endsWith(".generated.ts")) {
    return true;
  }
  if (filePath.includes("/tests/") || /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(filePath)) {
    return true;
  }
  return INFRA_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

export function isUserFacing(commit) {
  const subject = (commit.subject ?? "").trim();
  if (subject.startsWith("Merge ") || subject.startsWith("Revert ")) return false;

  const trailer = userFacingTrailer(commit.body);
  if (trailer === "no") return false;
  if (trailer === "yes") return true;

  const files = commit.files ?? [];
  if (files.length > 0 && files.every((filePath) => isInfraPath(filePath))) return false;

  const parsed = parseConventionalCommit(subject);
  return PLAYER_TYPES.has(parsed.type);
}

function isImplementationLine(line) {
  const text = line.replace(/^\*\*[^*]+\*\*\s*/u, "").trim();
  if (IMPLEMENTATION_BULLET.test(text)) return true;
  return TECHNICAL_TERMS.some((term) => text.includes(term));
}

function sentencesFromParagraph(paragraph) {
  const trimmed = paragraph.replace(/\n/gu, " ").trim();
  if (trimmed.length < 15) return [];
  const sentences = trimmed
    .split(/(?<=[.!?])\s+/u)
    .map((part) => part.trim());
  const substantial = sentences.filter((part) => part.length >= 15);
  return substantial.length > 0 ? substantial : [sentences[0]];
}

export function extractPlayerFacingLines(commit) {
  if (!isUserFacing(commit)) return [];

  const parsed = parseConventionalCommit(commit.subject);
  const cleaned = cleanCommitBody(commit.body);
  const scopePrefix = parsed.scope ? `**${parsed.scope}:** ` : "";
  const bullets = cleaned.split("\n").filter((line) => /^\s*-\s+/.test(line));
  const bodyLines = bullets.length > 0
    ? bullets.map((line) => line.replace(/^\s*-\s+/, "").trim()).filter((line) => line.length >= 15)
    : cleaned.split(/\n\s*\n/u).flatMap(sentencesFromParagraph);
  const playerLines = bodyLines.map((line) => `${scopePrefix}${line}`).filter((line) => !isImplementationLine(line));
  if (playerLines.length > 0) return playerLines;

  return [`${scopePrefix}${parsed.description}`];
}

export function normalizeCommits(commits) {
  return commits.map((commit) =>
    typeof commit === "string"
      ? { subject: commit, body: "", files: [] }
      : { subject: commit.subject, body: commit.body ?? "", files: commit.files ?? [] },
  );
}

export function buildPatchNotesMarkdown(version, commits, knownIssues = []) {
  const sections = {
    Features: [],
    Fixes: [],
    Balance: [],
    Performance: [],
  };

  for (const commit of normalizeCommits(commits)) {
    if (!isUserFacing(commit)) continue;
    const parsed = parseConventionalCommit(commit.subject);
    const target = Object.hasOwn(TYPE_TO_PATCH_SECTION, parsed.type) ? TYPE_TO_PATCH_SECTION[parsed.type] : "Features";
    const lines = extractPlayerFacingLines(commit);
    if (lines.length === 0) continue;
    sections[target].push(...lines);
  }

  const lines = [`# Alchemy v${version.replace(/^v/, "")}`, ""];
  for (const [title, items] of Object.entries(sections)) {
    if (items.length === 0) continue;
    lines.push(`## ${title}`, "");
    for (const item of items) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  lines.push("## Known issues", "");
  if (knownIssues.length === 0) {
    lines.push("- None reported.", "");
  } else {
    for (const issue of knownIssues) {
      lines.push(`- ${issue}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
