#!/usr/bin/env node
import { isMainModule } from "./lib/is-main-module.mjs";

function printHelp() {
  console.log(`Usage: node scripts/verify.mjs [command]
  --changed [args]     Route smallest verification for changed paths (default)
  --bundle             Check bundle budget
  --routing            Check CI routing
  --arch               Lint architecture smoke
  --help               Show this help

  Pass-through: any args after --changed are forwarded to verify-changed.mjs
  Example: node scripts/verify.mjs --changed --diff --plan`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }
  const hasBundle = args.includes("--bundle");
  const hasRouting = args.includes("--routing");
  const hasArch = args.includes("--arch");
  const hasChanged = args.includes("--changed") || (!hasBundle && !hasRouting && !hasArch);

  if (hasBundle) {
    const { default: checkBundle } = await import("./check-bundle-budget.mjs");
    if (typeof checkBundle === "function") await checkBundle();
    return;
  }
  if (hasRouting) {
    const mod = await import("./check-ci-routing.mjs");
    if (typeof mod.main === "function") mod.main();
    return;
  }
  if (hasArch) {
    const mod = await import("./lint-architecture-smoke.mjs");
    if (typeof mod.main === "function") await mod.main();
    return;
  }
  if (hasChanged) {
    const idx = args.indexOf("--changed");
    const forwarded = idx !== -1 ? args.slice(idx + 1) : args;
    const mod = await import("./verify-changed.mjs");
    const code = mod.main(forwarded);
    if (code !== 0) process.exitCode = code;
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
