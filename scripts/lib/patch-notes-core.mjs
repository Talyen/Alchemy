// Parses conventional commits into changelog and player-facing patch note sections.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const versionConfig = JSON.parse(readFileSync(path.join(root, ".versionrc.json"), "utf8"));
const TYPE_METADATA = [
  ...versionConfig.types,
  { type: "style", section: "Style", hidden: true },
  { type: "other", section: "Other", hidden: true },
];
const PLAYER_TYPES = new Set(TYPE_METADATA.filter(({ hidden }) => !hidden).map(({ type }) => type));
const CHANGELOG_BODY_MAX_LINES = 6;
const CHANGELOG_BODY_MAX_CHARS = 800;

export const CHANGELOG_SECTION_ORDER = TYPE_METADATA.map(({ section }) => section);
const TYPE_TO_CHANGELOG_SECTION = Object.fromEntries(TYPE_METADATA.map(({ type, section }) => [type, section]));
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
    .filter((line) => !line.startsWith("Co-authored-by:"))
    .join("\n")
    .trim();
}

function firstSentence(paragraph) {
  const trimmed = paragraph.trim();
  if (trimmed.length < 15) return null;
  const match = /^(.+?[.!?])(?:\s|$)/u.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

function sentencesFromParagraph(paragraph) {
  const trimmed = paragraph.replace(/\n/gu, " ").trim();
  if (trimmed.length < 15) return [];

  const parts = trimmed
    .split(/(?<=[.!?])\s+/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 15);

  if (parts.length > 0) return parts;

  const sentence = firstSentence(trimmed);
  return sentence ? [sentence] : [];
}

export function extractPlayerFacingLines({ subject, body }) {
  const parsed = parseConventionalCommit(subject);
  if (!parsed.include) return [];

  const cleaned = cleanCommitBody(body);
  const scopePrefix = parsed.scope ? `**${parsed.scope}:** ` : "";
  const lines = [];

  if (cleaned) {
    const bulletLines = cleaned.split("\n").filter((line) => /^\s*-\s+/.test(line));
    if (bulletLines.length > 0) {
      for (const line of bulletLines) {
        const text = line.replace(/^\s*-\s+/, "").trim();
        if (text.length >= 15) lines.push(`${scopePrefix}${text}`);
      }
      if (lines.length > 0) return lines;
    }

    const paragraphs = cleaned.split(/\n\s*\n/u).filter(Boolean);
    for (const paragraph of paragraphs) {
      for (const sentence of sentencesFromParagraph(paragraph)) {
        lines.push(`${scopePrefix}${sentence}`);
      }
    }
    if (lines.length > 0) return lines;
  }

  return [`${scopePrefix}${parsed.description}`];
}

export function normalizeCommits(commits) {
  return commits.map((commit) =>
    typeof commit === "string" ? { subject: commit, body: "" } : { subject: commit.subject, body: commit.body ?? "" },
  );
}

function compactChangelogBody(body) {
  const cleaned = cleanCommitBody(body);
  if (!cleaned) return "";

  const lines = cleaned.split("\n").slice(0, CHANGELOG_BODY_MAX_LINES);
  let compacted = lines.join("\n").trim();
  if (compacted.length > CHANGELOG_BODY_MAX_CHARS) {
    compacted = `${compacted.slice(0, CHANGELOG_BODY_MAX_CHARS).trimEnd()}…`;
  } else if (cleaned.split("\n").length > CHANGELOG_BODY_MAX_LINES) {
    compacted = `${compacted}\n…`;
  }
  return compacted;
}

export function buildChangelogUnreleased(commits) {
  const grouped = new Map();

  for (const { subject, body } of normalizeCommits(commits)) {
    const parsed = parseConventionalCommit(subject);
    const section = TYPE_TO_CHANGELOG_SECTION[parsed.type];
    if (!section || section === TYPE_TO_CHANGELOG_SECTION.other) continue;
    if (!grouped.has(section)) grouped.set(section, []);

    let entry = `- ${subject}`;
    const cleaned = compactChangelogBody(body);
    if (cleaned) {
      entry += `\n${cleaned
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n")}`;
    }
    grouped.get(section).push(entry);
  }

  const lines = ["## [Unreleased]", ""];

  for (const section of CHANGELOG_SECTION_ORDER) {
    const items = grouped.get(section);
    if (!items?.length) continue;
    lines.push(`### ${section}`, "", ...items, "");
  }

  if (lines.length === 2) {
    lines.push("_No changes yet._", "");
  }

  return lines.join("\n").trimEnd() + "\n";
}

export function buildPatchNotesMarkdown(version, commits, knownIssues = []) {
  const sections = {
    Features: [],
    Fixes: [],
    Balance: [],
    Performance: [],
  };

  for (const commit of normalizeCommits(commits)) {
    const parsed = parseConventionalCommit(commit.subject);
    if (!parsed.include) continue;
    const target = TYPE_TO_PATCH_SECTION[parsed.type];
    if (!target) continue;
    sections[target].push(...extractPlayerFacingLines(commit));
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

export function parseChangelogCommits(sectionMarkdown) {
  const commits = [];
  const lines = sectionMarkdown.split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.startsWith("- ")) {
      index += 1;
      continue;
    }

    const subject = line.slice(2).trim();
    index += 1;
    const bodyLines = [];
    while (index < lines.length && lines[index].startsWith("  ")) {
      bodyLines.push(lines[index].slice(2));
      index += 1;
    }
    while (index < lines.length && lines[index] === "") {
      index += 1;
    }

    commits.push({ subject, body: bodyLines.join("\n") });
  }

  return commits;
}

export function extractChangelogSection(content, heading) {
  const lines = content.split("\n");
  const baseHeading = heading.trim();
  const startIndex = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed === baseHeading || trimmed.startsWith(`${baseHeading} (`);
  });
  if (startIndex === -1) return null;

  const sectionLines = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("## [")) break;
    sectionLines.push(line);
  }

  return sectionLines.join("\n").trim();
}

export function replaceChangelogUnreleased(content, unreleasedMarkdown) {
  const unreleasedHeading = "## [Unreleased]";
  const unreleasedBlock = unreleasedMarkdown.trimEnd() + "\n";
  const unreleasedIndex = content.indexOf(unreleasedHeading);

  if (unreleasedIndex === -1) {
    const versionSection = content.search(/\n## \[/u);
    if (versionSection !== -1) {
      return `${content.slice(0, versionSection + 1)}${unreleasedBlock}${content.slice(versionSection + 1)}`;
    }
    return `${content.trimEnd()}\n\n${unreleasedBlock}`;
  }

  const afterHeading = unreleasedIndex + unreleasedHeading.length;
  const nextSectionMatch = /\n## \[/u.exec(content.slice(afterHeading));
  const endIndex = nextSectionMatch ? afterHeading + nextSectionMatch.index + 1 : content.length;

  return `${content.slice(0, unreleasedIndex)}${unreleasedBlock}${content.slice(endIndex)}`;
}

export function promoteUnreleasedSection(content, version, dateIso) {
  const unreleased = extractChangelogSection(content, "## [Unreleased]");
  const versionHeading = `## [${version.replace(/^v/, "")}] (${dateIso})`;
  const promotedBody = (unreleased ?? "_No changes yet._").replace(/^_No changes yet\._$/u, "").trim();
  const emptyUnreleased = buildChangelogUnreleased([]);

  let next = replaceChangelogUnreleased(content, emptyUnreleased);
  const insertAt = next.indexOf("## [Unreleased]");
  const versionBlock = `${versionHeading}\n\n${promotedBody}\n\n`;
  next = `${next.slice(0, insertAt)}${versionBlock}${next.slice(insertAt)}`;
  return next;
}
