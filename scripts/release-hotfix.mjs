// Hotfix release wrapper: lighter gate, patch bump, push, and workflow watch.
import { runRelease } from "./lib/release-runner.mjs";

runRelease({
  label: "Hotfix",
  gates: [["check:ship"], ["test:e2e:prepush"]],
  bumpArgs: ["--release-as", "patch"],
}).catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});
