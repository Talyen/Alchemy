import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(currentFile), "../..");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args) {
  console.log(`▸ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
}

function capture(command, args) {
  return execFileSync(command, args, {
    cwd: root,
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
  })
    .toString()
    .trim();
}

function packageVersion() {
  return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
}

function parseGithubRepoPath(remoteUrl) {
  const match = remoteUrl.match(/github\.com[/:](.+?)\/(.+?)(?:\.git)?$/u);
  return match ? `${match[1]}/${match[2]}` : null;
}

export function parseReleaseArgs(argv) {
  return { dryRun: argv.includes("--dry-run") };
}

function previewPatchNotes() {
  console.log("\n═══ Player-facing patch notes (draft) ═══\n");
  run(npm, ["run", "generate:patch-notes", "--", "--dry-run"]);
}

function assertReleaseHead() {
  if (capture("git", ["status", "--porcelain"])) {
    throw new Error("Working tree is not clean. Commit or stash changes first.");
  }
  const branch = capture("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== "main") throw new Error(`Not on main (on ${branch}). Switch to main first.`);
}

async function watchRelease({ label, tag }) {
  console.log(`\n═══ ${label} ${tag} pushed ═══\n`);
  let repoPath = null;
  try {
    repoPath = parseGithubRepoPath(capture("git", ["remote", "get-url", "origin"]));
  } catch {
    // A local checkout may not have an origin configured; the tag is still pushed.
  }

  let runId = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 5_000);
    });
    try {
      runId = capture("gh", [
        "run",
        "list",
        "--workflow",
        "release.yml",
        "--branch",
        tag,
        "--limit",
        "1",
        "--json",
        "databaseId",
        "--jq",
        ".[0].databaseId",
      ]);
      if (runId) break;
    } catch {
      // gh may be unavailable or the workflow may not have appeared yet.
    }
  }

  if (runId) {
    console.log("Watching release workflow...");
    try {
      run("gh", ["run", "watch", runId]);
      console.log(`\n✅ ${label} ${tag} completed successfully.`);
    } catch {
      let conclusion = "unknown";
      try {
        conclusion = capture("gh", ["run", "view", runId, "--json", "conclusion", "--jq", ".conclusion"]);
      } catch {
        // Preserve the workflow failure even if the follow-up inspection is unavailable.
      }
      throw new Error(`${label} ${tag} failed (${conclusion || "unknown"}).`);
    }
    return;
  }

  const url = repoPath
    ? `https://github.com/${repoPath}/actions/workflows/release.yml`
    : "[GitHub Actions release workflow]";
  console.log("Monitoring not available. Check release at:");
  console.log(url);
}

/**
 * Run the shared release sequence with mode-specific gates and bump args.
 * @param {{ label: string, gates: string[][], bumpArgs?: string[], dryRun?: boolean }} options
 */
export async function runRelease({ label, gates, bumpArgs = [], dryRun = false }) {
  if (dryRun) {
    console.log(`\n═══ ${label} dry run ═══\n`);
    previewPatchNotes();
    return;
  }

  assertReleaseHead();

  console.log(`\n═══ ${label} pre-flight gate ═══\n`);
  try {
    for (const gate of gates) run(npm, ["run", ...gate]);
  } catch {
    throw new Error("Pre-flight gate failed. Fix issues before releasing.");
  }

  previewPatchNotes();

  const oldVersion = packageVersion();
  console.log(`\n═══ Bumping version${bumpArgs.length > 0 ? ` (${bumpArgs.join(" ")})` : ""} ═══\n`);
  run(npx, ["commit-and-tag-version", ...bumpArgs]);

  const newVersion = packageVersion();
  const tag = `v${newVersion}`;
  if (oldVersion === newVersion) throw new Error("Version did not change after bump. Aborting push.");

  console.log("\n═══ Pushing ═══\n");
  run("git", ["push", "--no-verify", "origin", "main"]);
  run("git", ["push", "--no-verify", "origin", tag]);
  await watchRelease({ label, tag });
}
