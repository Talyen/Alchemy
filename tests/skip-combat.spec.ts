import { expect, test } from "@playwright/test";
import { injectSaveState, resumeGameMode } from "./helpers";

test.describe("Skip Combat", () => {
  test("skip combat button resolves battle without playing cards", async ({ page }) => {
    await injectSaveState(page);
    await page.goto("/");
    await resumeGameMode(page, "campaign");
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /Combat/ }).first().click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const skipBtn = page.getByRole("button", { name: /Skip Combat/ });
    await expect(skipBtn).toBeVisible({ timeout: 3000 });
    await skipBtn.click();

    await expect(page.getByRole("heading", { name: /^Victory/ })).toBeVisible({ timeout: 5000 });
  });
});
