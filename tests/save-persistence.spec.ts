import { expect, test } from "@playwright/test";
import { injectSaveState } from "./helpers";

test.describe("Save Persistence", () => {
  test("resume run restores mid-act state after reload", async ({ page }) => {
    await injectSaveState(page, {
      runGold: 50,
      runPlayerHealth: 20,
      runMaxHealth: 30,
      roomsEncountered: 3,
      destinationIndexInAct: 3,
      completedDestinations: ["Normal Combat", "Normal Combat", "Normal Combat"],
    });
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Resume Run" })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Resume Run" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
  });
});
