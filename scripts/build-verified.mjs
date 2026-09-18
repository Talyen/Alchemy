#!/usr/bin/env node
/** Non-mutating verified build: validate generated outputs then invoke Vite directly without lifecycle preparation. */
import { syncGenerated } from "./sync-generated.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { resolveViteBin } from "./lib/command-invocation.mjs";
import { runStreamCommand } from "./lib/run-command.mjs";
import { UsageError } from "./lib/script-run.mjs";
import { validateDesktopBuildConfig } from "./lib/desktop-build-config.mjs";

async function main(argv = process.argv.slice(2)) {
  const modes = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mode" || arg === "-m") {
      const mode = argv[++index];
      if (!mode || mode.startsWith("-")) throw new UsageError("Build mode requires a value.");
      modes.push(mode);
    } else if (arg.startsWith("--mode=") || arg.startsWith("-m=")) {
      const mode = arg.slice(arg.indexOf("=") + 1);
      if (!mode) throw new UsageError("Build mode requires a value.");
      modes.push(mode);
    }
  }
  const isDesktop = argv.includes("--desktop") || modes.includes("desktop");
  if (new Set(modes).size > 1 || (isDesktop && modes.some((mode) => mode !== "desktop"))) {
    throw new UsageError("Conflicting build modes: desktop builds require mode desktop.");
  }
  // Strip our own --desktop selector plus only leading vite/build positionals
  // (e.g. `npm run build -- vite build`). Filtering every occurrence would drop
  // legitimate user args such as `--mode build-preview`; the exact-match break
  // this guards against is a user `--mode build` value colliding with positionals.
  const viteForward = argv.filter((a) => a !== "--desktop");
  while (viteForward.length > 0 && (viteForward[0] === "vite" || viteForward[0] === "build")) {
    viteForward.shift();
  }

  if (isDesktop) validateDesktopBuildConfig();

  // Validate all generated outputs without mutating. Throws if stale.
  await syncGenerated({ check: true });

  const viteArgs = [resolveViteBin(), "build"];
  if (isDesktop && modes.length === 0) {
    viteArgs.push("--mode", "desktop");
  }
  if (viteForward.length > 0) {
    viteArgs.push(...viteForward);
  }

  // Streams intentionally: builds run for minutes and operators need live
  // progress. Resolved through the shared streaming runner so CLI resolution
  // stays in command-invocation.mjs instead of raw spawnSync.
  const result = runStreamCommand(process.execPath, viteArgs, { env: { ...process.env } });
  if (result.error) {
    console.error(`Failed to run ${["node", ...viteArgs].join(" ")}:`, result.error.message);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = error instanceof UsageError ? 2 : 1;
  });
}
