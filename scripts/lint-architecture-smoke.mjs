#!/usr/bin/env node
// Cross-language presentation contracts; lint policies are exercised by Oxlint fixtures.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
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

export async function main() {
  assertArchitectureSmokeFiles();
  const themeCss = readFileSync(path.join(process.cwd(), "src/styles/theme.css"), "utf8");
  const uiColors = readFileSync(path.join(process.cwd(), "src/lib/game-constants/ui-colors.ts"), "utf8");
  for (const shade of ["base", "light", "deep", "pale"]) {
    const hex = uiColors.match(new RegExp(shade + ': "(#[a-f0-9]{6})"'))?.[1];
    assert.ok(hex, "UI_GOLD must define " + shade);
    assert.ok(themeCss.includes("--color-gold-" + shade + ": " + hex + ";"), "CSS gold must match UI_GOLD." + shade);
  }
  assert.ok(themeCss.includes("--color-primary: var(--color-gold-base)"), "Primary must use the shared gold");
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
  const tooltipFadeMatch = uiMotion.match(/TOOLTIP_FADE_MS[^=]*=\s*(\d+)/);
  const cssTooltipExitMatch = themeCss.match(/--tooltip-exit-duration:\s*(\d+)ms/);
  assert.ok(tooltipFadeMatch, "ui-motion.ts must define TOOLTIP_FADE_MS");
  assert.ok(cssTooltipExitMatch, "theme.css must define --tooltip-exit-duration");
  assert.equal(
    Number(tooltipFadeMatch[1]),
    Number(cssTooltipExitMatch[1]),
    "TOOLTIP_FADE_MS must equal --tooltip-exit-duration",
  );
  assert.ok(
    !uiMotion.includes("TOOLTIP_FADE_OUT_MS"),
    "TOOLTIP_FADE_OUT_MS alias must stay removed; use TOOLTIP_FADE_MS directly",
  );
  const loadingWordJsMatch = uiMotion.match(/LOADING_WORD_FADE_MS[^=]*=\s*(\d+)/);
  assert.ok(loadingWordJsMatch, "ui-motion.ts must define LOADING_WORD_FADE_MS");
  const loadingWordCssMatch = componentsCss.match(/loadingWordFade\s+(\d+)ms/);
  assert.ok(loadingWordCssMatch, "components.css must define loadingWordFade duration");
  assert.equal(
    Number(loadingWordJsMatch[1]),
    Number(loadingWordCssMatch[1]),
    "LOADING_WORD_FADE_MS must equal loadingWordFade duration",
  );
  assert.ok(!uiMotion.includes("PAGE_EXIT_MS"), "PAGE_EXIT_MS alias must stay removed; use MOTION_FADE_MS directly");

  const constantsDir = path.join(process.cwd(), "src/lib/game-constants");
  const seenExports = new Map();
  for (const file of readdirSync(constantsDir).filter((name) => name.endsWith(".ts") && name !== "index.ts")) {
    const source = readFileSync(path.join(constantsDir, file), "utf8");
    for (const match of source.matchAll(/export\s+(?:const|function|class|enum|interface|type)\s+([A-Za-z0-9_]+)/g)) {
      const name = match[1];
      assert.ok(
        !seenExports.has(name),
        `game-constants export collision: ${name} defined in both ${seenExports.get(name)} and ${file}`,
      );
      seenExports.set(name, file);
    }
  }

  console.log("Architecture presentation contracts clean.");
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
