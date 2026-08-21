// Full release wrapper: shared pre-flight gate, bump, push, and workflow watch.
import { runRelease } from "./lib/release-runner.mjs";

runRelease({ label: "Release", gates: [["check:ship:full"]] }).catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});
