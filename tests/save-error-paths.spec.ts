import { expect, test } from "@playwright/test";

const SAVE_KEY = "alchemy-save-v1";

test.describe("Save Error Paths", () => {
  test("corrupted JSON in localStorage falls back to defaults gracefully", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(SAVE_KEY, "not-valid-json{{{");
    });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 5000 });
  });

  test("missing save key still shows main menu", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem(SAVE_KEY);
    });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Collection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Options" })).toBeVisible();
  });

  test("save with null activeRun does not crash", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        materialInventory: {},
        activeRun: null,
        discoveredCardIds: [],
        encounteredEnemyIds: [],
        discoveredTrinketIds: [],
        talentXP: {},
        unlockedTalents: {},
      }));
    });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 5000 });
  });

  test("empty save object does not crash", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(SAVE_KEY, JSON.stringify({}));
    });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 5000 });
  });

  test("fresh localStorage shows main menu without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.removeItem("alchemy-skip-loading-screen");
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    expect(errors).toEqual([]);
  });
});
