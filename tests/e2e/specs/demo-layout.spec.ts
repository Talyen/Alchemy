import { controllerInput } from "../controller-input";
import { mkdirSync } from "node:fs";
import { test, expect } from "../../fixtures/e2e";
import {
  injectActiveBattle,
  makeGoblinBattleState,
  assertStageFitsViewport,
  assertNoOverflow,
} from "../../browser-helpers";
import { spawnSync } from "node:child_process";
import type { BattleCard } from "@/lib/game-data/types";
let starterDeck: BattleCard[] = [];

test.beforeAll(() => {
  if (process.env.ALCHEMY_EDITION !== "demo") return;
  const source = `import { withReportServer } from './scripts/lib/vite-report-server.mjs';
    await withReportServer(async (server) => {
      const { getStartingDeck } = await server.ssrLoadModule('/src/lib/game-data/characters.ts');
      console.log(JSON.stringify(getStartingDeck('knight')));
    });`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
    cwd: process.cwd(),
    env: { ...process.env },
    encoding: "utf8",
    timeout: 20000,
  });
  expect(result.status, result.stderr).toBe(0);
  starterDeck = JSON.parse(result.stdout.split("\n").find((line) => line.startsWith("[{"))!);
});

test("reduced motion preserves card inspection and playable hand settlement", async ({ page }) => {
  // eslint-disable-next-line playwright/no-skipped-test -- needs the demo renderer used by this acceptance file
  test.skip(process.env.ALCHEMY_EDITION !== "demo", "Demo renderer required");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await injectActiveBattle(page, makeGoblinBattleState({ hand: structuredClone(starterDeck), mana: 10, maxMana: 10 }), {
    runDeck: starterDeck,
  });
  const cards = page.locator('[aria-label^="Play "]');
  await expect(cards).toHaveCount(7);
  await controllerInput(page).activate(cards.first());
  await expect(cards).toHaveCount(6);
  await controllerInput(page).activate(cards.first());
  await expect(cards).toHaveCount(5);
  await page.getByRole("button", { name: /^View Deck/ }).click();
  await expect(page.getByRole("heading", { name: "Deck", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "End Turn", exact: true })).toBeEnabled();
});

for (const height of [720, 800]) {
  for (const size of [80, 100, 120]) {
    test(`demo battle and inspection remain usable at 1280x${height}, Game Size ${size}`, async ({ page }) => {
      // eslint-disable-next-line playwright/no-skipped-test -- tests the supported demo viewports against its edition
      test.skip(process.env.ALCHEMY_EDITION !== "demo", "Demo renderer required");
      await page.setViewportSize({ width: 1280, height });
      await page.addInitScript(
        (gameSizePercent) =>
          localStorage.setItem(
            "alchemy-device-display-v1",
            JSON.stringify({ version: 1, gameSizePercent, tooltipSizePercent: gameSizePercent === 80 ? 75 : 125 }),
          ),
        size,
      );
      const hand = structuredClone(starterDeck);
      await injectActiveBattle(page, makeGoblinBattleState({ hand, deck: [], maxMana: 10, mana: 10 }), {
        runDeck: hand,
      });
      await assertStageFitsViewport(page);
      await expect(page.getByRole("combobox", { name: "Card Animations · Temporary" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "End Turn", exact: true })).toBeInViewport({ ratio: 0.99 });
      await expect(page.locator('[aria-label^="Play "]')).toHaveCount(7);
      await page.getByRole("button", { name: "Play Anvil", exact: true }).focus();
      const cardTooltip = page.locator(".hover-popup-panel[data-visible]");
      await expect(cardTooltip).toContainText("Anvil");
      await expect(cardTooltip).toBeInViewport({ ratio: 0.99 });
      await expect.poll(() => cardTooltip.evaluate((element) => Number(getComputedStyle(element).opacity))).toBe(1);
      mkdirSync("reports/demo-acceptance/ui", { recursive: true });
      await page.screenshot({ path: `reports/demo-acceptance/ui/tooltip-${height}-${size}.png` });
      await page.getByTestId("battle-enemy-art-panel").click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Abilities", exact: true })).toBeVisible();
      await assertNoOverflow(page, "enemy inspection");
      await expect
        .poll(() =>
          dialog.evaluate((element) => {
            let opacity = 1;
            for (let node: Element | null = element; node; node = node.parentElement)
              opacity *= Number(getComputedStyle(node).opacity);
            return opacity;
          }),
        )
        .toBe(1);
      mkdirSync("reports/demo-acceptance/ui", { recursive: true });
      await page.screenshot({ path: `reports/demo-acceptance/ui/enemy-${height}-${size}.png` });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await page.getByRole("button", { name: /^View Deck/ }).click();
      await expect(page.getByRole("heading", { name: "Deck", exact: true })).toBeVisible();
      await assertNoOverflow(page, "run deck");
      await page.keyboard.press("Escape");
      await page.screenshot({ path: `reports/demo-acceptance/ui/battle-${height}-${size}.png` });
    });
  }
}
