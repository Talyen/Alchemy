#!/usr/bin/env node
/** Non-mutating verified build: validate generated outputs then invoke Vite directly without lifecycle preparation. */
import { spawnSync } from "node:child_process";

import { syncGenerated } from "./sync-generated.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

async function main(argv = process.argv.slice(2)) {
  const isDesktop =
    argv.includes("--desktop") || (argv.includes("--mode") && argv[argv.indexOf("--mode") + 1] === "desktop");
  const viteForward = argv.filter((a) => a !== "--desktop");

  // Validate all generated outputs without mutating. Throws if stale.
  await syncGenerated({ check: true });

  const viteArgs = ["vite", "build"];
  if (isDesktop && !viteForward.includes("--mode")) viteArgs.push("--mode", "desktop");
  if (viteForward.length > 0) {
    viteArgs.push(...viteForward.filter((a) => a !== "vite" && a !== "build"));
  }

  const result = spawnSync("npx", viteArgs, {
    stdio: "inherit",
    env: { ...process.env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
