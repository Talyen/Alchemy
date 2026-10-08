#!/usr/bin/env node
import path from "node:path";
import { runTaskCommand } from "./lib/run-command.mjs";
import { existsSync } from "node:fs";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

function e2eRoute(label, specs, grep) {
  return Object.freeze({
    label,
    args: Object.freeze([
      "playwright",
      "test",
      ...specs.map((spec) => `tests/e2e/specs/${spec}.spec.ts`),
      ...(grep ? ["--grep", grep] : []),
      "--project=chromium",
    ]),
  });
}

export const E2E_ROUTES = Object.freeze({
  audio: e2eRoute("audio Playwright flow", ["audio-sfx"]),
  gear: e2eRoute("gear Playwright flows", ["armory"]),
  mystery: e2eRoute("mystery Playwright flow", ["destination-progression"], "Mystery"),
  homestead: e2eRoute("homestead Playwright flow", ["homestead-flow"]),
  collection: e2eRoute("collection Playwright flow", ["collection"]),
  talents: e2eRoute("talents Playwright flow", ["talents-flow"]),
  options: e2eRoute("options Playwright flow", ["menu-navigation"], "controller-equivalent options"),
  locks: e2eRoute("progression locks Playwright flow", ["menu-navigation"], "Progression Locks"),
  shop: e2eRoute("shop Playwright flow", ["shop-and-rewards"]),
  battle: e2eRoute("battle Playwright flows", ["core-gameplay"]),
  save: e2eRoute("save Playwright flows", ["save-persistence", "save-error-paths"]),
  labyrinth: e2eRoute("labyrinth Playwright flow", ["labyrinth"]),
  wildwood: e2eRoute("wildwood Playwright flow", ["wildwood"]),
  outcomes: e2eRoute("run-outcome Playwright flows", ["run-outcomes"]),
});

const E2E_ROUTE_ALIASES = Object.freeze({
  "shop-screen": "shop",
  "homestead-screen": "homestead",
});

function canonicalRouteNames() {
  return Object.keys(E2E_ROUTES);
}

function printHelp() {
  const aliases = Object.entries(E2E_ROUTE_ALIASES)
    .map(([alias, route]) => `${alias} aliases to ${route}`)
    .join(", ");
  console.log(`Usage: node scripts/run-e2e-route.mjs <route> [extra playwright args]

Routes: ${canonicalRouteNames().join(", ")}
  ${aliases}

Examples:
  npm run test:e2e:route -- shop
  node scripts/run-e2e-route.mjs battle --headed
`);
}

export function resolveE2eRoute(route) {
  const normalized = Object.hasOwn(E2E_ROUTE_ALIASES, route) ? E2E_ROUTE_ALIASES[route] : route;
  return Object.hasOwn(E2E_ROUTES, normalized) ? E2E_ROUTES[normalized] : undefined;
}

if (isMainModule(import.meta.url)) {
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
  const live = extra.includes("--live") || extra.includes("--verbose");
  const playwrightArgs = extra.filter((arg) => arg !== "--live" && arg !== "--verbose");
  const missingSpecs = resolved.args.filter(
    (arg) => arg.endsWith(".spec.ts") && !existsSync(path.isAbsolute(arg) ? arg : path.join(ROOT, arg)),
  );
  if (missingSpecs.length > 0) {
    console.error(
      `The ${route} E2E route matches no spec files for:\n${missingSpecs.map((m) => `  - ${m}`).join("\n")}`,
    );
    process.exit(1);
  }
  const result = await runTaskCommand(
    process.execPath,
    ["scripts/run-compact.mjs", ...resolved.args, ...playwrightArgs],
    {
      cwd: ROOT,
      label: resolved.label,
      live,
      env: { ...process.env, ...(live ? { ALCHEMY_OUTPUT_CAPTURED: "1" } : {}) },
    },
  );
  process.exit(result.status ?? 1);
}
