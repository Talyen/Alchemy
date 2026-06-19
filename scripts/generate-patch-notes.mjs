// Generates player-facing patch notes from CHANGELOG.md (Unreleased or a release version).
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPatchNotesMarkdown, extractChangelogSection, parseChangelogCommits } from "./lib/patch-notes-core.mjs";
import { computeSyncedChangelog, readChangelog } from "./sync-changelog.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const releaseVersion = process.env.RELEASE_VERSION?.replace(/^v/, "");
const isRelease = Boolean(releaseVersion);
const version = isRelease ? releaseVersion : "Unreleased";
const outputName = isRelease ? `v${version}` : "UNRELEASED";

let changelogContent = readChangelog(root);
const synced = computeSyncedChangelog(changelogContent, root);
if (synced !== changelogContent) {
  changelogContent = synced;
}

const sectionHeading = isRelease ? `## [${version}]` : "## [Unreleased]";
const sectionMarkdown = extractChangelogSection(changelogContent, sectionHeading);
if (!sectionMarkdown) {
  console.error(`Missing changelog section: ${sectionHeading}`);
  process.exit(1);
}

const commits = parseChangelogCommits(sectionMarkdown);
const markdown = buildPatchNotesMarkdown(version, commits);

const outDir = join(root, "release-notes");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `${outputName}.md`);
writeFileSync(outPath, markdown, "utf8");
console.log(`Wrote ${outPath} (${commits.length} changelog entries)`);
