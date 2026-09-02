#!/usr/bin/env node
// Slow ESLint smoke: lint representative files and verify their effective stacked rules.
// Kept in the static-analysis tier because cold ESLint startup does not belong in Vitest.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";
import { isMainModule } from "./lib/is-main-module.mjs";

export const ARCHITECTURE_SMOKE_FILES = Object.freeze([
  "src/features/alchemy/meta/screens/menu-screen.tsx",
  "src/features/alchemy/meta/screens/armory/use-armory-controller.ts",
  "src/features/alchemy/run-loop/screens/destination-screen.tsx",
  "src/features/alchemy/run-loop/shop/create-shop-actions.ts",
]);

export function assertArchitectureSmokeFiles(rootDir = process.cwd()) {
  const missing = ARCHITECTURE_SMOKE_FILES.filter((file) => !existsSync(path.join(rootDir, file)));
  if (missing.length > 0) throw new Error(`Architecture smoke fixtures are missing: ${missing.join(", ")}`);
}

assertArchitectureSmokeFiles();

const eslint = new ESLint();

function restrictedImports(config) {
  const rule = config.rules?.["no-restricted-imports"];
  return Array.isArray(rule) && rule[1] && typeof rule[1] === "object" ? rule[1] : null;
}

function restrictedSyntax(config) {
  const rule = config.rules?.["no-restricted-syntax"];
  return Array.isArray(rule) ? rule.slice(1) : [];
}

function patternGroups(options) {
  return (options?.patterns ?? []).flatMap((pattern) =>
    Array.isArray(pattern.group) ? pattern.group : typeof pattern.group === "string" ? [pattern.group] : [],
  );
}

function assertImportGroup(options, needle, file) {
  assert.ok(
    patternGroups(options).some((group) => group.includes(needle)),
    `${file} must restrict ${needle}`,
  );
}

const configCache = new Map();

async function getConfig(file) {
  if (!configCache.has(file)) {
    configCache.set(file, eslint.calculateConfigForFile(file));
  }
  return configCache.get(file);
}

async function calculateImports(file) {
  return restrictedImports(await getConfig(file));
}

const filesToPreload = [
  "src/lib/battle/card-play.ts",
  "src/features/alchemy/run-loop/battle/battle-presentation-store.ts",
  "src/features/alchemy/meta/screens/menu-screen.tsx",
  "src/features/alchemy/meta/talents/talent-tree.tsx",
  "src/features/alchemy/shared/ui/game-menu.tsx",
  "src/app/screen-routes/index.tsx",
  "src/features/alchemy/run-setup/run/content-system-navigation.ts",
  "src/features/alchemy/run-loop/battle/battle-init.ts",
  "src/features/alchemy/run-loop/screens/destination-screen.tsx",
  "src/features/alchemy/run-loop/shop/create-shop-actions.ts",
];

function alchemyRule(config, ruleId) {
  return config.rules?.[`alchemy/${ruleId}`];
}

function ruleIsError(setting) {
  return (
    setting === "error" || setting === 2 || (Array.isArray(setting) && (setting[0] === "error" || setting[0] === 2))
  );
}

export async function main() {
  assertArchitectureSmokeFiles();
  await Promise.all(filesToPreload.map((f) => getConfig(f)));

  const battleConfig = await getConfig("src/lib/battle/card-play.ts");
  const battleImports = restrictedImports(battleConfig);
  const battleSyntax = restrictedSyntax(battleConfig);
  assert.ok(
    battleImports?.paths?.some((entry) => entry.name === "react"),
    "battle must restrict React",
  );
  assert.ok(
    battleImports?.paths?.some((entry) => entry.name === "zustand"),
    "battle must restrict Zustand",
  );
  assert.ok(
    battleImports?.paths?.some((entry) => entry.name === "react-dom"),
    "battle must restrict React DOM",
  );
  assert.ok(
    battleImports?.paths?.some((entry) => entry.name === "react-dom/client"),
    "battle must restrict React DOM subpath",
  );
  assertImportGroup(battleImports, "features", "src/lib/battle/card-play.ts");
  assert.ok(
    battleSyntax.some((entry) => entry.selector?.includes("random")),
    "battle must restrict Math.random",
  );
  assert.ok(
    battleSyntax.some((entry) => entry.selector?.includes("floor")),
    "battle must restrict Math.floor",
  );
  assert.ok(
    battleSyntax.some((entry) => entry.selector?.includes("ceil")),
    "battle must restrict Math.ceil",
  );
  assert.ok(
    battleSyntax.some((entry) => entry.selector?.includes("trunc")),
    "battle must restrict Math.trunc",
  );
  assert.ok(
    battleSyntax.some((entry) => entry.selector?.includes('property.name="rng"') || entry.selector?.includes("rng")),
    "battle must restrict direct rng access",
  );

  const runLoopBattleImports = await calculateImports(
    "src/features/alchemy/run-loop/battle/battle-presentation-store.ts",
  );
  for (const restriction of [
    "run-lifecycle",
    "gameplay-state-store",
    "write-port-run",
    "assets/optimized",
    "screens",
  ]) {
    assertImportGroup(runLoopBattleImports, restriction, "run-loop/battle");
  }

  const metaScreenImports = await calculateImports("src/features/alchemy/meta/screens/menu-screen.tsx");
  for (const restriction of [
    "gameplay-state-store",
    "write-port-run",
    "assets/optimized",
    "run-loop",
    "@/lib/battle/*",
    "run-loop/run",
  ]) {
    assertImportGroup(metaScreenImports, restriction, "meta screen");
  }
  const metaNonScreenImports = await calculateImports("src/features/alchemy/meta/talents/talent-tree.tsx");
  assertImportGroup(metaNonScreenImports, "run-loop", "meta non-screen");
  assert.ok(
    !patternGroups(metaNonScreenImports).some((group) => group.includes("run-loop/run")),
    "screen-only run-loop/run restriction must not leak into non-screen meta files",
  );

  const sharedUiImports = await calculateImports("src/features/alchemy/shared/ui/game-menu.tsx");
  assertImportGroup(sharedUiImports, "battle-store", "shared UI");
  assertImportGroup(sharedUiImports, "@/lib/battle/*", "shared UI");
  assertImportGroup(sharedUiImports, "write-port-run", "shared UI");
  assertImportGroup(sharedUiImports, "assets/optimized", "shared UI");

  const routeImports = await calculateImports("src/app/screen-routes/index.tsx");
  assert.ok(
    routeImports?.paths?.some((entry) => entry.name === "react" && entry.importNames?.includes("lazy")),
    "screen routes must restrict React.lazy",
  );
  assertImportGroup(routeImports, "gameplay-state-store", "screen routes");
  assertImportGroup(routeImports, "write-port-run", "screen routes");
  assertImportGroup(routeImports, "assets/optimized", "screen routes");

  const runSetupImports = await calculateImports("src/features/alchemy/run-setup/run/content-system-navigation.ts");
  assertImportGroup(runSetupImports, "run-loop", "run setup");
  assertImportGroup(runSetupImports, "gameplay-state-store", "run setup");

  const runLoopImports = await calculateImports("src/features/alchemy/run-loop/battle/battle-init.ts");
  for (const restriction of ["run-setup", "screens", "gameplay-state-store"]) {
    assertImportGroup(runLoopImports, restriction, "run-loop battle");
  }

  const runLoopScreenImports = await calculateImports("src/features/alchemy/run-loop/screens/destination-screen.tsx");
  assertImportGroup(runLoopScreenImports, "run-loop/run", "run-loop screen");
  const shopImports = await calculateImports("src/features/alchemy/run-loop/shop/create-shop-actions.ts");
  assertImportGroup(shopImports, "run-setup", "run-loop shop");
  assert.ok(
    !patternGroups(shopImports).some((group) => group.includes("run-loop/run")),
    "screen-only run-loop/run restriction must not leak into shops",
  );

  const destinationConfig = await getConfig("src/features/alchemy/run-loop/screens/destination-screen.tsx");
  assert.ok(
    ruleIsError(alchemyRule(destinationConfig, "no-unowned-web-storage")),
    "screens must ban unowned localStorage",
  );
  assert.ok(
    ruleIsError(alchemyRule(destinationConfig, "no-run-earned-add-materials")),
    "screens must ban progress addMaterials",
  );
  assert.ok(ruleIsError(alchemyRule(destinationConfig, "no-comments")), "screens must ban comments");
  assert.ok(ruleIsError(alchemyRule(destinationConfig, "no-em-dash")), "screens must ban em dashes");

  const libConfig = await getConfig("src/lib/battle/card-play.ts");
  assert.ok(ruleIsError(alchemyRule(libConfig, "no-lib-fetch")), "src/lib must ban fetch");

  const themeCss = readFileSync(path.join(process.cwd(), "src/styles/theme.css"), "utf8");
  const cssFadeMatch = themeCss.match(/--motion-fade-duration:\s*(\d+)ms/);
  assert.ok(cssFadeMatch, "theme.css must define --motion-fade-duration");
  const cssFadeMs = Number(cssFadeMatch[1]);
  const uiMotion = readFileSync(path.join(process.cwd(), "src/lib/game-constants/ui-motion.ts"), "utf8");
  const jsFadeMatch = uiMotion.match(/MOTION_FADE_MS[^=]*=\s*(\d+)/);
  assert.ok(jsFadeMatch, "ui-motion.ts must define MOTION_FADE_MS");
  assert.equal(Number(jsFadeMatch[1]), cssFadeMs, "MOTION_FADE_MS must equal --motion-fade-duration");
  const componentsCss = readFileSync(path.join(process.cwd(), "src/styles/components.css"), "utf8");
  assert.ok(
    componentsCss.includes("var(--motion-fade-duration)"),
    "components.css hover-popup-panel must use var(--motion-fade-duration)",
  );
  const tooltipFadeMatch = uiMotion.match(/TOOLTIP_FADE_MS[^=]*=\s*MOTION_FADE_MS\b[^\n;]*/);
  assert.ok(tooltipFadeMatch, "TOOLTIP_FADE_MS must alias MOTION_FADE_MS");

  const componentsUiConfig = await getConfig("src/components/ui/button.tsx");
  const componentsUiImports = restrictedImports(componentsUiConfig);
  assertImportGroup(componentsUiImports, "@/features/**", "components/ui must ban features imports");

  const results = await eslint.lintFiles(ARCHITECTURE_SMOKE_FILES);
  const errors = results.flatMap((r) =>
    r.messages.filter((m) => m.severity === 2).map((m) => `${r.filePath}:${m.line}:${m.column} ${m.message}`),
  );

  if (errors.length > 0) throw new Error("Architecture ESLint smoke failed:\n" + errors.join("\n"));

  console.log(
    `Architecture ESLint smoke clean (${ARCHITECTURE_SMOKE_FILES.length} linted files plus effective-config checks).`,
  );
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
