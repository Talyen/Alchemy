// Pre-push helper: sync CHANGELOG.md and auto-commit when dirty.
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { changelogCommitSubject, syncChangelog } from "./sync-changelog.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

syncChangelog({ root });

const status = execSync("git status --porcelain CHANGELOG.md", {
  cwd: root,
  encoding: "utf8",
}).trim();

if (status) {
  execSync("git add CHANGELOG.md", { cwd: root, stdio: "inherit" });
  const subject = changelogCommitSubject(root);
  execSync(`git commit -m "${subject}"`, { cwd: root, stdio: "inherit" });
}
