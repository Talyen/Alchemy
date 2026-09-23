import { expect, test } from "../../fixtures/e2e";
import { SAVE_KEY } from "../../browser-helpers";
import { MenuPage } from "../../pages/menu-page";
import { BattlePage } from "../../pages/battle-page";
import { critical } from "../../playwright-tags";
import { SAVE_RECOVERY_KEY } from "@/lib/game-constants";
import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation/metadata";

test.describe("Save Error Paths", () => {
  test(
    "corrupted JSON in localStorage falls back to defaults gracefully",
    critical,
    async ({ page, runtimeErrors }) => {
      await page.addInitScript((saveKey) => {
        localStorage.setItem(saveKey, "not-valid-json{{{");
      }, SAVE_KEY);

      await page.goto("/");
      const menu = new MenuPage(page);
      await menu.expectMainMenu();
      expect(runtimeErrors.splice(0)).toEqual([
        expect.stringMatching(/^\[storage\] Save candidate JSON parse failed, trying next candidate\s+SyntaxError:/),
      ]);
    },
  );

  test("fresh storage without a save opens the main menu", critical, async ({ page }) => {
    test.setTimeout(60_000);

    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.removeItem("alchemy-skip-loading-screen");
    });
    await page.goto("/", { waitUntil: "load" });
    const menu = new MenuPage(page);
    await menu.expectMainMenuAfterColdStart(30_000);
    await expect(menu.collectionBtn).toBeVisible();
    await expect(menu.optionsBtn).toBeVisible();
  });

  test("future schema save remains protected while new play stays available", critical, async ({ page }) => {
    await page.addInitScript(
      (data) => {
        localStorage.setItem(
          data.saveKey,
          JSON.stringify({
            saveSchemaVersion: data.schemaVersion,
            contentVersion: data.contentVersion,
            discoveredCardIds: ["slash"],
          }),
        );
      },
      {
        saveKey: SAVE_KEY,
        schemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
        contentVersion: CURRENT_CONTENT_VERSION,
      },
    );

    await page.goto("/");

    const menu = new MenuPage(page);
    await menu.expectMainMenu();
    await menu.openGameModeSelect();
    await page.getByRole("button", { name: "The Campaign", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();
    await menu.selectCharacterAndContinue("Knight");
    await new BattlePage(page).waitForOpeningHand();
    await expect
      .poll(() =>
        page.evaluate((saveKey) => JSON.parse(localStorage.getItem(saveKey) ?? "{}").saveSchemaVersion, SAVE_KEY),
      )
      .toBe(CURRENT_SAVE_SCHEMA_VERSION + 1);
    await expect
      .poll(() =>
        page.evaluate(
          (saveKey) => JSON.parse(localStorage.getItem(saveKey) ?? "{}").activeRun?.characterId,
          SAVE_RECOVERY_KEY,
        ),
      )
      .toBe("knight");
  });
});
