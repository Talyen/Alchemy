#!/usr/bin/env node
/** Non-mutating verified build: validate generated outputs then invoke Vite directly without lifecycle preparation. */
import { spawnSync } from "node:child_process";

import { syncGenerated } from "./sync-generated.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { resolveViteBin } from "./lib/vite-bin.mjs";
import { validateDesktopBuildConfig } from "./lib/desktop-build-config.mjs";

async function main(argv = process.argv.slice(2)) {
  const modes = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mode" || arg === "-m") {
      const mode = argv[++index];
      if (!mode || mode.startsWith("-")) throw new Error("Build mode requires a value.");
      modes.push(mode);
    } else if (arg.startsWith("--mode=") || arg.startsWith("-m=")) {
      const mode = arg.slice(arg.indexOf("=") + 1);
      if (!mode) throw new Error("Build mode requires a value.");
      modes.push(mode);
    }
  }
  const isDesktop = argv.includes("--desktop") || modes.includes("desktop");
  if (new Set(modes).size > 1 || (isDesktop && modes.some((mode) => mode !== "desktop"))) {
    throw new Error("Conflicting build modes: desktop builds require mode desktop.");
  }
  const viteForward = argv.filter((a) => a !== "--desktop");

  if (isDesktop) validateDesktopBuildConfig();

  // Validate all generated outputs without mutating. Throws if stale.
  await syncGenerated({ check: true });

  const viteArgs = [resolveViteBin(), "build"];
  if (isDesktop && modes.length === 0) {
    viteArgs.push("--mode", "desktop");
  }
  if (viteForward.length > 0) {
    viteArgs.push(...viteForward.filter((a) => a !== "vite" && a !== "build"));
  }

  const result = spawnSync(process.execPath, viteArgs, {
    stdio: "inherit",
    env: { ...process.env },
  });
  if (result.error) {
    console.error(`Failed to run ${["node", ...viteArgs].join(" ")}:`, result.error.message);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
