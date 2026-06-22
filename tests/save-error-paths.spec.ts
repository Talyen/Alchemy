import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors, SAVE_KEY } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { critical } from "./playwright-tags";
import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation/metadata";

type SaveErrorSetupKind = "corrupt" | "missing" | "nullActiveRun" | "empty";

const SAVE_ERROR_SCENARIOS: {
  name: string;
  kind: SaveErrorSetupKind;
  expectNoRuntimeErrors?: boolean;
  extraAssertions?: (menu: MenuPage) => Promise<void>;
}[] = [
  {
    name: "corrupted JSON in localStorage falls back to defaults gracefully",
    kind: "corrupt",
    expectNoRuntimeErrors: false,
  },
  {
    name: "missing save key still shows main menu",
    kind: "missing",
    extraAssertions: async (menu) => {
      await expect(menu.collectionBtn).toBeVisible();
      await expect(menu.optionsBtn).toBeVisible();
    },
  },
  {
    name: "save with null activeRun does not crash",
    kind: "nullActiveRun",
  },
  {
    name: "empty save object does not crash",
    kind: "empty",
  },
];

test.describe("Save Error Paths", () => {
  for (const scenario of SAVE_ERROR_SCENARIOS) {
    test(scenario.name, critical, async ({ page }) => {
      const errors = scenario.expectNoRuntimeErrors === false ? null : failOnRuntimeErrors(page);

      await page.addInitScript(
        (data) => {
          switch (data.kind) {
            case "corrupt":
              localStorage.setItem(data.saveKey, "not-valid-json{{{");
              break;
            case "missing":
              localStorage.removeItem(data.saveKey);
              break;
            case "nullActiveRun":
              localStorage.setItem(
                data.saveKey,
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
              break;
            case "empty":
              localStorage.setItem(data.saveKey, JSON.stringify({}));
              break;
          }
        },
        { saveKey: SAVE_KEY, kind: scenario.kind },
      );

      await page.goto("/");
      const menu = new MenuPage(page);
      await menu.expectMainMenu();
      await scenario.extraAssertions?.(menu);
      if (errors) expect(errors).toEqual([]);
    });
  }

  test("fresh localStorage shows main menu without errors", async ({ page }) => {
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
