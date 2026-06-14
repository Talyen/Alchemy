import { expect, test } from "@playwright/test";
import { SAVE_KEY } from "./helpers";
import { critical } from "./playwright-tags";
import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation/metadata";

test.describe("Unsupported save version UI", critical, () => {
  test("blocks gameplay when save schema is newer than this build", async ({ page }) => {
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
