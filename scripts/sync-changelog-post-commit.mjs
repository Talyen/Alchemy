// Post-commit helper: fold the generated CHANGELOG.md into the commit that was just created.
import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule } from "./lib/is-main-module.mjs";
import { computeSyncedChangelog, readChangelog } from "./sync-changelog.mjs";

const root = process.env.ALCHEMY_REPO_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const CHANGELOG_PATH = "CHANGELOG.md";
const SYNC_COMMIT_SUBJECT_PREFIX = "chore(changelog): sync unreleased";

function git(rootDir, args) {
  return execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function isCleanDiff(rootDir, args) {
  return (
    spawnSync("git", ["diff", "--quiet", ...args], {
      cwd: rootDir,
      stdio: "ignore",
    }).status === 0
  );
}

function hasUncommittedChangelog(rootDir) {
  return !isCleanDiff(rootDir, ["--", CHANGELOG_PATH]) || !isCleanDiff(rootDir, ["--cached", "--", CHANGELOG_PATH]);
}

/**
 * Synchronize CHANGELOG.md after a commit and amend it into that same commit.
 * The pre-push guard remains non-mutating as a final safety check.
 */
export function syncChangelogAfterCommit(rootDir = root) {
  const subject = git(rootDir, ["log", "-1", "--format=%s"]);
  if (subject.startsWith(SYNC_COMMIT_SUBJECT_PREFIX)) return "skipped-sync-commit";

  // Never overwrite a user's separate CHANGELOG.md work. The pre-push guard
  // will report the drift once that work is intentionally ready to commit.
  if (hasUncommittedChangelog(rootDir)) {
    console.warn("Skipping automatic changelog sync because CHANGELOG.md has uncommitted changes.");
    return "skipped-dirty-changelog";
  }

  const existing = readChangelog(rootDir);
  const synced = computeSyncedChangelog(existing, rootDir);
  if (synced === existing) return "already-synced";

  const changelogFile = join(rootDir, CHANGELOG_PATH);
  writeFileSync(changelogFile, synced, "utf8");
  git(rootDir, ["add", "--", CHANGELOG_PATH]);
  git(rootDir, ["commit", "--amend", "--no-edit", "--no-verify"]);
  console.log("Synchronized CHANGELOG.md into the commit just created.");
  return "amended";
}

if (isMainModule(import.meta.url)) {
  try {
    syncChangelogAfterCommit();
  } catch (error) {
    console.error("Automatic changelog sync failed; the pre-push guard will require a manual sync.", error);
    process.exitCode = 1;
  }
}
