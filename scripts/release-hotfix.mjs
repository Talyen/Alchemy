// Hotfix release wrapper: lighter gate, patch bump, push, and workflow watch.
import { parseReleaseArgs, runRelease } from "./lib/release-runner.mjs";

const { dryRun } = parseReleaseArgs(process.argv.slice(2));

runRelease({
  label: "Hotfix",
  gates: [["check:ship"], ["test:e2e:prepush"]],
  bumpArgs: ["--release-as", "patch"],
  dryRun,
}).catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});
