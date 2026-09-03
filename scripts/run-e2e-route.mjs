#!/usr/bin/env node
import { spawnSync } from "node:child_process";

export const E2E_ROUTES = Object.freeze({
  audio: Object.freeze({
    label: "audio Playwright flow",
    args: ["playwright", "test", "tests/audio-sfx.spec.ts", "--project", "chromium"],
  }),
  gear: Object.freeze({
    label: "gear Playwright flows",
    args: ["playwright", "test", "tests/armory.spec.ts", "--project", "chromium"],
  }),
  mystery: Object.freeze({
    label: "mystery Playwright flow",
    args: ["playwright", "test", "tests/destination-progression.spec.ts", "-g", "Mystery", "--project", "chromium"],
  }),
  homestead: Object.freeze({
    label: "homestead Playwright flow",
    args: ["playwright", "test", "tests/homestead-flow.spec.ts", "--project", "chromium"],
  }),
  collection: Object.freeze({
    label: "collection Playwright flow",
    args: ["playwright", "test", "tests/collection.spec.ts", "--project", "chromium"],
  }),
  talents: Object.freeze({
    label: "talents Playwright flow",
    args: ["playwright", "test", "tests/menu-navigation.spec.ts", "-g", "Talents", "--project", "chromium"],
  }),
  options: Object.freeze({
    label: "options Playwright flow",
    args: ["playwright", "test", "tests/menu-navigation.spec.ts", "-g", "Options|Auto-End", "--project", "chromium"],
  }),
  locks: Object.freeze({
    label: "progression locks Playwright flow",
    args: ["playwright", "test", "tests/progression-locks.spec.ts", "--project", "chromium"],
  }),
  "shop-screen": Object.freeze({
    label: "shop Playwright flow",
    args: ["playwright", "test", "tests/shop-and-rewards.spec.ts", "--project", "chromium"],
  }),
  battle: Object.freeze({
    label: "battle Playwright flows",
    args: [
      "playwright",
      "test",
      "tests/core-gameplay.spec.ts",
      "tests/combat-mechanics.spec.ts",
      "--project",
      "chromium",
    ],
  }),
  save: Object.freeze({
    label: "save Playwright flows",
    args: [
      "playwright",
      "test",
      "tests/save-persistence.spec.ts",
      "tests/save-error-paths.spec.ts",
      "--project",
      "chromium",
    ],
  }),
  labyrinth: Object.freeze({
    label: "labyrinth Playwright flow",
    args: ["playwright", "test", "tests/labyrinth.spec.ts", "--project", "chromium"],
  }),
  wildwood: Object.freeze({
    label: "wildwood Playwright flow",
    args: ["playwright", "test", "tests/wildwood.spec.ts", "--project", "chromium"],
  }),
  outcomes: Object.freeze({
    label: "run-outcome Playwright flows",
    args: ["playwright", "test", "tests/run-outcomes.spec.ts", "--project", "chromium"],
  }),
});

const E2E_ROUTE_ALIASES = Object.freeze({
  shop: "shop-screen",
  "homestead-screen": "homestead",
});

function canonicalRouteNames() {
  return Object.keys(E2E_ROUTES);
}

function printHelp() {
  console.log(`Usage: node scripts/run-e2e-route.mjs <route> [extra playwright args]

Routes: ${canonicalRouteNames().join(", ")}
  shop aliases to shop-screen

Examples:
  npm run test:e2e:route -- shop
  node scripts/run-e2e-route.mjs battle --headed
`);
}

export function resolveE2eRoute(route) {
  const normalized = E2E_ROUTE_ALIASES[route] ?? route;
  return E2E_ROUTES[normalized];
}

const invokedAsCli = (process.argv[1] ?? "").includes("run-e2e-route.mjs");

if (invokedAsCli) {
  const route = process.argv[2];
  if (!route || route === "--help" || route === "-h") {
    printHelp();
    process.exit(route ? 0 : 1);
  }

  const resolved = resolveE2eRoute(route);
  if (!resolved) {
    console.error(`Unknown E2E route: ${route}`);
    console.error(`Known routes: ${canonicalRouteNames().join(", ")}`);
    process.exit(1);
  }

  const extra = process.argv.slice(3);
  const result = spawnSync("npx", [...resolved.args, ...extra], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  process.exit(result.status ?? 1);
}
