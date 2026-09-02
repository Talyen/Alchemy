#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { E2E_ESCALATIONS } from "./lib/test-commands.mjs";

function printHelp() {
  console.log(`Usage: node scripts/run-e2e-route.mjs <route> [extra playwright args]

Routes: ${Object.keys(E2E_ESCALATIONS)
    .filter((k) => k !== "shop-screen")
    .join(", ")}
  shop aliases to shop-screen

Examples:
  npm run test:e2e:route -- shop
  node scripts/run-e2e-route.mjs gear --headed
`);
}

const route = process.argv[2];
if (!route || route === "--help" || route === "-h") {
  printHelp();
  process.exit(route ? 0 : 1);
}

const normalized = route === "shop" ? "shop-screen" : route;
const commandKey = E2E_ESCALATIONS[normalized];
if (!commandKey) {
  console.error(`Unknown E2E route: ${route}`);
  console.error(
    `Known routes: ${Object.keys(E2E_ESCALATIONS)
      .filter((k) => k !== "shop-screen")
      .join(", ")}`,
  );
  process.exit(1);
}

const { COMMANDS } = await import("./lib/test-commands.mjs");
const command = COMMANDS[commandKey];
if (!command) {
  console.error(`No command for route: ${route} (${commandKey})`);
  process.exit(1);
}

const extra = process.argv.slice(3);
const result = spawnSync(command.command, [...command.args, ...extra], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
