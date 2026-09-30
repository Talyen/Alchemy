import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect } from "../../fixtures/e2e";
import { MenuPage } from "../../pages/menu-page";
import { BattlePage } from "../../pages/battle-page";
import { SAVE_KEY, assertEndRunShowsRecap } from "../../browser-helpers";

test("fresh demo profile plays real starter cards and earns the three-hero chain", async ({ page }, testInfo) => {
  // eslint-disable-next-line playwright/no-skipped-test -- this journey's endpoint and available roster require the demo renderer
  test.skip(process.env.ALCHEMY_EDITION !== "demo", "Demo edition journey");
  test.setTimeout(90000);
  await page.addInitScript(() => localStorage.clear());
  const started = Date.now();
  await page.goto("/");
  const menu = new MenuPage(page);
  await menu.expectMainMenuAfterColdStart(30000);
  for (const hero of ["Knight", "Rogue", "Ranger"] as const) {
    await menu.openGameModeSelect();
    await page.getByRole("button", { name: "The Campaign", exact: true }).click();
    await page.getByRole("button", { name: `Select ${hero}`, exact: true }).click();
    const battle = new BattlePage(page);
    await battle.waitForOpeningHand();
    if (hero === "Knight") {
      const elapsedMs = Date.now() - started;
      expect(elapsedMs).toBeLessThan(180000);
      mkdirSync("reports/demo-acceptance", { recursive: true });
      writeFileSync(
        "reports/demo-acceptance/first-input-timing.json",
        JSON.stringify({ elapsedMs, humanReadingTimeIncluded: false }),
      );
      await testInfo.attach("cold-start-to-real-hand", {
        body: JSON.stringify({ elapsedMs, humanReadingTimeIncluded: false }),
        contentType: "application/json",
      });
    }
    await expect
      .poll(async () =>
        page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").activeRun?.runDeck?.length, SAVE_KEY),
      )
      .toBe(7);
    await battle.playFirstCard();
    await assertEndRunShowsRecap(page);
    await expect
      .poll(async () =>
        page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").finishedRunCharacters, SAVE_KEY),
      )
      .toContain(hero.toLowerCase());
    await expect(menu.talentsBtn).toBeEnabled();
    await expect(menu.homesteadBtn).toBeEnabled();
  }
});
