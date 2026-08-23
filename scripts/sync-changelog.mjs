// Rebuilds CHANGELOG.md ## [Unreleased] from git commits since the latest v* tag.
// Used at release time (`.versionrc.json` prerelease) and for optional local preview.
// Do not keep Unreleased in sync on every commit — git history is the day-to-day source of truth.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getCommitsSinceTag, latestVersionTag } from "./lib/git-release.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
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
  const commits = getCommitsSinceTag(rootDir, lastTag);
  if (commits === null) {
    throw new Error(
      `git log failed while reading commits since ${lastTag ?? "HEAD"}; refusing to rewrite CHANGELOG.md`,
    );
  }
  const unreleasedMarkdown = buildChangelogUnreleased(commits.filter((c) => !isSyncCommitSubject(c.subject)));
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

if (isMainModule(import.meta.url)) {
  const isCheck = process.argv.includes("--check");
  syncChangelog({ check: isCheck });
}
