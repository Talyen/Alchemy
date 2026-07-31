// Pre-push helper: verify CHANGELOG.md is synchronized without mutating git state.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeSyncedChangelog, readChangelog } from "./sync-changelog.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const existing = readChangelog(root);
const synced = computeSyncedChangelog(existing, root);

if (synced !== existing) {
  console.error(
    "CHANGELOG.md is out of sync with git history. The post-commit sync may have skipped separate changelog edits; run npm run sync:changelog, stage CHANGELOG.md, commit, and retry the push.",
  );
  process.exitCode = 1;
}
