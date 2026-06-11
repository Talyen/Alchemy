// Generates player-facing patch notes from conventional commits since the previous tag.
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPatchNotesMarkdown } from "./lib/patch-notes-core.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = (process.env.RELEASE_VERSION ?? `v${pkg.version}`).replace(/^v/, "");
const currentTag = `v${version}`;

function listVersionTags() {
  try {
    const output = execSync('git tag --list "v*" --sort=-v:refname', {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (!output) return [];
    return output.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function previousTag(beforeTag) {
  const tags = listVersionTags();
  const index = tags.indexOf(beforeTag);
  if (index === -1 || index + 1 >= tags.length) return null;
  return tags[index + 1];
}

function commitsSince(tag) {
  const range = tag ? `${tag}..${currentTag}` : currentTag;
  const log = execSync(`git log ${range} --pretty=format:%s`, { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();
  if (!log) return [];
  return log.split("\n").filter(Boolean);
}

const priorTag = previousTag(currentTag);
const commits = commitsSince(priorTag);
const markdown = buildPatchNotesMarkdown(version, commits);

const outDir = join(root, "release-notes");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `${currentTag}.md`);
writeFileSync(outPath, markdown, "utf8");
console.log(`Wrote ${outPath} (${commits.length} commits since ${priorTag ?? "beginning"})`);
