// Rebuilds CHANGELOG.md ## [Unreleased] from git commits since the latest v* tag.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getCommitsSinceTag, latestCommitHash, latestVersionTag } from "./lib/git-release.mjs";
import { buildChangelogUnreleased, replaceChangelogUnreleased } from "./lib/patch-notes-core.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SYNC_COMMIT_SUBJECT_PREFIX = "chore(changelog): sync unreleased";

function isSyncCommitSubject(subject) {
  return subject.startsWith(SYNC_COMMIT_SUBJECT_PREFIX);
}

function normalizeNewlines(text) {
  return text.replace(/\r\n/gu, "\n");
}

export function readChangelog(rootDir = root) {
  return normalizeNewlines(readFileSync(join(rootDir, "CHANGELOG.md"), "utf8"));
}

export function computeSyncedChangelog(existingContent, rootDir = root) {
  const lastTag = latestVersionTag(rootDir);
  const commits = getCommitsSinceTag(rootDir, lastTag).filter((commit) => !isSyncCommitSubject(commit.subject));
  const unreleasedMarkdown = buildChangelogUnreleased(commits);
  return replaceChangelogUnreleased(normalizeNewlines(existingContent), unreleasedMarkdown);
}

export function syncChangelog(options = {}) {
  const rootDir = options.root ?? root;
  const checkOnly = options.check === true;
  const existing = readChangelog(rootDir);
  const synced = computeSyncedChangelog(existing, rootDir);

  if (checkOnly) {
    if (synced !== existing) {
      console.error("CHANGELOG.md ## [Unreleased] is out of sync with git log. Run: npm run sync:changelog");
      process.exit(1);
    }
    return synced;
  }

  if (synced !== existing) {
    writeFileSync(join(rootDir, "CHANGELOG.md"), synced, "utf8");
    console.log(`Updated ${join(rootDir, "CHANGELOG.md")}`);
  } else {
    console.log("CHANGELOG.md is already in sync");
  }

  return synced;
}

export function changelogCommitSubject(rootDir = root) {
  const lastTag = latestVersionTag(rootDir);
  const commits = getCommitsSinceTag(rootDir, lastTag).filter((commit) => !isSyncCommitSubject(commit.subject));
  const hash = latestCommitHash(rootDir);
  return `chore(changelog): sync unreleased (${commits.length} commits, ${hash})`;
}

const isCheck = process.argv.includes("--check");
syncChangelog({ check: isCheck });
