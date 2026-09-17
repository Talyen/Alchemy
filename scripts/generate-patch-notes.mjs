// Generates player-facing patch notes from git history since the previous v* tag.
// Day-to-day CHANGELOG.md is not the source; conventional types, paths, and
// User-Facing trailers decide what players see.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertValidSemver, getCommitsSinceTag, resolvePatchNoteRange } from "./lib/git-release.mjs";
import { buildPatchNotesMarkdown } from "./lib/patch-notes-core.mjs";
import { defineScript } from "./lib/script-run.mjs";
import { writeTextIfChanged } from "./lib/write-text-if-changed.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function parseGeneratePatchNotesArgs(argv, env = process.env) {
  for (const arg of argv) if (arg !== "--dry-run") throw new Error(`Unknown patch-note option: ${arg}`);
  const raw = env.RELEASE_VERSION?.replace(/^v/, "") || "";
  if (raw) assertValidSemver(raw);
  return {
    dryRun: argv.includes("--dry-run"),
    releaseVersion: raw,
  };
}

export function generatePatchNotesMarkdown(rootDir, options = {}) {
  const releaseVersion = options.releaseVersion || "";
  const isRelease = Boolean(releaseVersion);
  const version = isRelease ? releaseVersion : "Unreleased";
  const range = resolvePatchNoteRange(rootDir, isRelease ? `v${version}` : null);
  const commits = getCommitsSinceTag(rootDir, range.since, { until: range.until });
  if (commits === null) {
    throw new Error(
      `git log failed while reading commits since ${range.since ?? "the start of history"} until ${range.until}`,
    );
  }
  return {
    version,
    outputName: isRelease ? `v${version}` : "UNRELEASED",
    commits,
    markdown: buildPatchNotesMarkdown(version, commits),
  };
}

async function generatePatchNotes(options = {}) {
  const rootDir = options.root ?? root;
  const parsed = parseGeneratePatchNotesArgs(options.argv ?? process.argv.slice(2), options.env ?? process.env);
  const result = generatePatchNotesMarkdown(rootDir, parsed);

  if (parsed.dryRun || options.dryRun) {
    process.stdout.write(result.markdown);
    return result;
  }

  const { mkdirSync } = await import("node:fs");
  const outDir = join(rootDir, "release-notes");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${result.outputName}.md`);
  await writeTextIfChanged(outPath, result.markdown);
  console.log(`Wrote ${outPath} (${result.commits.length} git commits)`);
  return result;
}

defineScript(import.meta.url, () => generatePatchNotes());
