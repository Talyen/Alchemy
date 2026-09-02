#!/usr/bin/env node
import { isMainModule } from "./lib/is-main-module.mjs";

function printHelp() {
  console.log(`Usage: node scripts/verify.mjs [args]
  --changed [args]     Route smallest verification for changed paths (default)
  --help               Show this help

  verify is a compatibility alias for verify:changed.
  For bundle/routing/arch checks use:
    npm run check:bundle
    npm run ci:routing
    npm run lint:architecture-smoke

  Pass-through: args after --changed are forwarded to verify-changed.mjs
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
  if (hasBundle || hasRouting || hasArch) {
    const flag = hasBundle ? "--bundle" : hasRouting ? "--routing" : "--arch";
    console.error(`Unknown option ${flag} for verify. verify is an alias for verify:changed.`);
    console.error("Use: npm run check:bundle, npm run ci:routing, or npm run lint:architecture-smoke");
    process.exitCode = 2;
    return;
  }
  const idx = args.indexOf("--changed");
  const forwarded = idx !== -1 ? args.slice(idx + 1) : args;
  const mod = await import("./verify-changed.mjs");
  const code = mod.main(forwarded);
  if (code !== 0) process.exitCode = code;
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
