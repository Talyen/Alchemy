import { expect, test } from "./fixtures/e2e";
import { failOnRuntimeErrors, SAVE_KEY } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { critical } from "./playwright-tags";
import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation/metadata";

test.describe("Save Error Paths", () => {
  test("corrupted JSON in localStorage falls back to defaults gracefully", critical, async ({ page }) => {
    await page.addInitScript((saveKey) => {
      localStorage.setItem(saveKey, "not-valid-json{{{");
    }, SAVE_KEY);

    await page.goto("/");
    const menu = new MenuPage(page);
    await menu.expectMainMenu();
  });

  test("missing save key still shows main menu", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await page.addInitScript((saveKey) => {
      localStorage.removeItem(saveKey);
    }, SAVE_KEY);

    await page.goto("/");
    const menu = new MenuPage(page);
    await menu.expectMainMenu();
    await expect(menu.collectionBtn).toBeVisible();
    await expect(menu.optionsBtn).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("save with null activeRun does not crash", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await page.addInitScript((saveKey) => {
      localStorage.setItem(
        saveKey,
        JSON.stringify({
          materialInventory: {},
          activeRun: null,
          discoveredCardIds: [],
          encounteredEnemyIds: [],
          discoveredTrinketIds: [],
          talentXP: {},
          unlockedTalents: {},
        }),
      );
    }, SAVE_KEY);

    await page.goto("/");
    await new MenuPage(page).expectMainMenu();
    expect(errors).toEqual([]);
  });

  test("empty save object does not crash", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await page.addInitScript((saveKey) => {
      localStorage.setItem(saveKey, JSON.stringify({}));
    }, SAVE_KEY);

    await page.goto("/");
    await new MenuPage(page).expectMainMenu();
    expect(errors).toEqual([]);
  });

  test("fresh localStorage shows main menu without errors", critical, async ({ page }) => {
    const errors = failOnRuntimeErrors(page);

    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.removeItem("alchemy-skip-loading-screen");
    });
    await page.goto("/", { waitUntil: "load" });
    await new MenuPage(page).expectMainMenuAfterColdStart();

    expect(errors).toEqual([]);
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
