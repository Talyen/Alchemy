// Rebuilds CHANGELOG.md ## [Unreleased] from git commits since the latest v* tag.
// Used at release time (`.versionrc.json` prerelease) and for optional local preview.
// Do not keep Unreleased in sync on every commit — git history is the day-to-day source of truth.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getCommitsSinceTag, latestVersionTag } from "./lib/release/git-release.mjs";
import { buildChangelogUnreleased, replaceChangelogUnreleased } from "./lib/release/patch-notes-core.mjs";
import { defineScript } from "./lib/script-run.mjs";
import { writeTextIfChanged } from "./lib/write-text-if-changed.mjs";

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

export async function syncChangelog(options = {}) {
  const rootDir = options.root ?? root;
  const checkOnly = options.check === true;
  const changelogPath = join(rootDir, "CHANGELOG.md");
  const existing = readChangelog(rootDir);
  const synced = computeSyncedChangelog(existing, rootDir);

  try {
    const written = await writeTextIfChanged(changelogPath, synced, { check: checkOnly });
    if (written) {
      console.log(`Updated ${changelogPath}`);
    } else {
      console.log("CHANGELOG.md is already in sync");
    }
  } catch (error) {
    // Throw instead of exiting so tests observe the failure; defineScript
    // still maps this to exit 1 for the CLI.
    throw new Error("CHANGELOG.md ## [Unreleased] is out of sync with git log. Run: npm run sync:changelog", {
      cause: error,
    });
  }

  return synced;
}

defineScript(import.meta.url, () => {
  const isCheck = process.argv.includes("--check");
  return syncChangelog({ check: isCheck });
});
