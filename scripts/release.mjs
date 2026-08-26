// Full release wrapper: shared pre-flight gate, bump, push, and workflow watch.
import { parseReleaseArgs, runRelease } from "./lib/release-runner.mjs";

const { dryRun } = parseReleaseArgs(process.argv.slice(2));

runRelease({ label: "Release", gates: [["check:ship:full"]], dryRun }).catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});
