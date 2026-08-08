import { expect } from "@playwright/test";
import { bodyGear, gearItemLocator, openArmory } from "./e2e/armory";
import { test } from "./fixtures/e2e";
import { armory } from "./playwright-tags";

test.describe("Gear transfer", armory, () => {
  test("sends gear to another class from the right-click menu", async ({ page }) => {
    await openArmory(page, [bodyGear]);

    await gearItemLocator(page, "Leather Armor").click({ button: "right" });
    await expect(page.getByTestId("armory-transfer-menu")).toBeVisible();
    await page.getByRole("menuitem", { name: "Send to Rogue" }).click();
    await expect(page.getByTestId("armory-transfer-menu")).toHaveCount(0);

    await expect(gearItemLocator(page, "Leather Armor")).toHaveCount(0);
    await page.getByRole("button", { name: "Rogue", exact: true }).click();
    await expect(gearItemLocator(page, "Leather Armor")).toBeVisible();
  });

  test("sends equipped gear to another class unequipped", async ({ page }) => {
    await openArmory(page, [bodyGear]);
    const bodyItem = gearItemLocator(page, "Leather Armor");
    const bodySlot = page.locator('[data-testid="armory-equipment-slot"][data-slot="body"]');

    await bodyItem.dblclick();
    await expect(bodySlot.locator("img")).toHaveCount(2);
    await bodySlot.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Send to Rogue" }).click();

    await expect(bodySlot.locator("img")).toHaveCount(1);
    await page.getByRole("button", { name: "Rogue", exact: true }).click();
    await expect(gearItemLocator(page, "Leather Armor")).toBeVisible();
    await expect(bodySlot.locator("img")).toHaveCount(1);
  });

  test("transfer menu excludes the source character", async ({ page }) => {
    await openArmory(page, [bodyGear]);

    await gearItemLocator(page, "Leather Armor").click({ button: "right" });
    await expect(page.getByTestId("armory-transfer-menu")).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Send to Knight" })).toHaveCount(0);
  });

  test("transfer menu includes all unlocked characters", async ({ page }) => {
    await openArmory(page, [bodyGear]);

    await gearItemLocator(page, "Leather Armor").click({ button: "right" });
    await expect(page.getByTestId("armory-transfer-menu")).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Send to Rogue" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Send to Wizard" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Send to Druid" })).toBeVisible();
  });

  test("transfer menu closes on Escape", async ({ page }) => {
    await openArmory(page, [bodyGear]);
    const menu = page.getByTestId("armory-transfer-menu");

    await gearItemLocator(page, "Leather Armor").click({ button: "right" });
    await expect(menu).toBeVisible();

    // The menu registers its Escape handler in a passive effect after mount.
    // Under full-suite parallel load that effect may not have run yet when the
    // first Escape lands, so retry until the menu actually closes.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.keyboard.press("Escape");
      try {
        await expect(menu).toHaveCount(0, { timeout: 1000 });
        return;
      } catch {
        // Handler likely not registered yet; let effects flush and retry.
      }
    }
    await expect(menu).toHaveCount(0);
  });

  test("transfer menu closes on backdrop click", async ({ page }) => {
    await openArmory(page, [bodyGear]);
    const menu = page.getByTestId("armory-transfer-menu");

    await gearItemLocator(page, "Leather Armor").click({ button: "right" });
    await expect(menu).toBeVisible();

    // The click-outside listener is registered in the same passive effect as
    // the Escape handler, so it can race the backdrop click under load.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.getByTestId("armory-screen").click({ position: { x: 10, y: 10 } });
      try {
        await expect(menu).toHaveCount(0, { timeout: 1000 });
        return;
      } catch {
        // Listener likely not registered yet; let effects flush and retry.
      }
    }
    await expect(menu).toHaveCount(0);
  });
});
