// Hotfix release wrapper: lighter gate → force patch bump → push → watch
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd) {
  console.log(`▸ ${cmd}`);
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

function capture(cmd) {
  return execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" }).toString().trim();
}

// Step 1: Check clean git status
const status = capture("git status --porcelain");
if (status) {
  console.error("Working tree is not clean. Commit or stash changes first.");
  process.exit(1);
}

// Step 2: Verify we're on main
const branch = capture("git rev-parse --abbrev-ref HEAD");
if (branch !== "main") {
  console.error(`Not on main (on ${branch}). Switch to main first.`);
  process.exit(1);
}

// Step 3: Lighter gate (skip full E2E and desktop E2E)
console.log("\n═══ Hotfix pre-flight gate (check:ship + prepush E2E) ═══\n");
try {
  run("npm run check:ship");
  run("npm run test:e2e:prepush");
} catch {
  console.error("\nPre-flight gate failed. Fix issues before releasing.");
  process.exit(1);
}

// Step 4: Read current version
const oldVersion = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

// Step 5: Force patch bump
console.log("\n═══ Bumping version (patch) ═══\n");
run("npx commit-and-tag-version --release-as patch");

// Step 6: Detect new tag
const newVersion = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const tag = `v${newVersion}`;

if (oldVersion === newVersion) {
  console.error("Version did not change after bump. Aborting push.");
  process.exit(1);
}

// Step 7: Push commit and tag
console.log("\n═══ Pushing ═══\n");
run("git push --no-verify origin main");
run(`git push --no-verify origin ${tag}`);

// Step 8: Watch release workflow
console.log(`\n═══ Hotfix ${tag} pushed ═══\n`);

try {
  const remoteUrl = capture("git remote get-url origin");
  const match = remoteUrl.match(/github\.com[/:](.+?)\/(.+?)(?:\.git)?$/);
  const repoPath = match ? `${match[1]}/${match[2]}` : null;

  let runId = null;
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      runId = capture(
        `gh run list --workflow release.yml --limit 1 --json databaseId,headBranch --jq '.[0] | select(.headBranch == "main") | .databaseId'`,
      );
      if (runId) break;
    } catch {
      // gh not available or no run yet
    }
  }

  if (runId) {
    console.log("Watching release workflow...");
    try {
      run(`gh run watch ${runId}`);
      console.log(`\n✅ Hotfix ${tag} completed successfully.`);
    } catch {
      const conclusion = capture(`gh run view ${runId} --json conclusion --jq '.conclusion'`);
      console.error(`\n❌ Hotfix ${tag} failed (${conclusion || "unknown"}).`);
      process.exit(1);
    }
  } else {
    const url = repoPath
      ? `https://github.com/${repoPath}/actions/workflows/release.yml`
      : `[GitHub Actions release workflow]`;
    console.log(`Monitoring not available. Check hotfix at:`);
    console.log(url);
  }
} catch {
  console.log(`Hotfix ${tag} pushed. Monitor the release workflow on GitHub.`);
}
