// Full release wrapper: shared pre-flight gate, bump, push, and workflow watch.
// Hotfix mode (release:hotfix): lighter gate, forced patch bump.
import { parseReleaseArgs, runRelease } from "./lib/release-runner.mjs";

const { dryRun, hotfix } = parseReleaseArgs(process.argv.slice(2));

runRelease(
  hotfix
    ? { label: "Hotfix", gates: [["check:ship"], ["test:e2e:critical"]], bumpArgs: ["--release-as", "patch"], dryRun }
    : { label: "Release", gates: [["check:ship:full"]], dryRun },
).catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});
