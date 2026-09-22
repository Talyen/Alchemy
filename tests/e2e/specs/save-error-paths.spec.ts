import { expect, test } from "../../fixtures/e2e";
import { SAVE_KEY } from "../../browser-helpers";
import { MenuPage } from "../../pages/menu-page";
import { critical } from "../../playwright-tags";
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

  test("blocks gameplay when save schema is newer than this build", critical, async ({ page }) => {
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

    await expect(page.getByRole("heading", { name: "Newer Save Data Detected" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0);
  });
});
