import { expect } from "@playwright/test";
import {
  bodyGear,
  createEmptyGearLoadouts,
  gearItemLocator,
  openArmory,
} from "./e2e/armory";
import { test } from "./fixtures/e2e";

test.describe("Gear transfer", () => {
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

    await gearItemLocator(page, "Leather Armor").click({ button: "right" });
    await expect(page.getByTestId("armory-transfer-menu")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("armory-transfer-menu")).toHaveCount(0);
  });

  test("transfer menu closes on backdrop click", async ({ page }) => {
    await openArmory(page, [bodyGear]);

    await gearItemLocator(page, "Leather Armor").click({ button: "right" });
    await expect(page.getByTestId("armory-transfer-menu")).toBeVisible();

    await page.getByTestId("armory-screen").click({ position: { x: 10, y: 10 } });
    await expect(page.getByTestId("armory-transfer-menu")).toHaveCount(0);
  });
});
