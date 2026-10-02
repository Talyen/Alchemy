import path from "node:path";
import { runStreamCommand } from "./lib/run-command.mjs";
import { resolveElectronExecutablePathWithMarker } from "./electron-path.mjs";
import { defineScript, UsageError } from "./lib/script-run.mjs";
import { REPO_ROOT } from "./lib/repository-paths.mjs";

/** Local production-renderer playtesting never uses a normal profile or Steam services. */
export function demoPlaytestLaunch(root = path.resolve(import.meta.dirname, ".."), env = process.env) {
  return {
    args: [root, `--user-data-dir=${path.join(root, "scratch", "demo-playtest-profile")}`],
    env: { ...env, ALCHEMY_EDITION: "demo", ELECTRON_FORCE_PACKAGED_RENDERER: "1" },
  };
}

export function runDemoPlaytest(argv = process.argv.slice(2)) {
  if (argv.length === 1 && argv[0] === "--help") {
    console.log(
      "Build and play the offline production demo. Progress stays in scratch/demo-playtest-profile; use Clear Save Data in Options for a fresh profile. Steam and normal player profiles are not used.",
    );
    return 0;
  }
  if (argv.length) throw new UsageError("demo:playtest accepts only --help");
  const launch = demoPlaytestLaunch();
  for (const args of [
    ["run", "ensure:electron"],
    ["run", "build:desktop"],
  ]) {
    const result = runStreamCommand("npm", args, { cwd: REPO_ROOT, env: launch.env });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
  }
  const result = runStreamCommand(resolveElectronExecutablePathWithMarker(), launch.args, {
    cwd: REPO_ROOT,
    env: launch.env,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}
defineScript(import.meta.url, () => runDemoPlaytest());
