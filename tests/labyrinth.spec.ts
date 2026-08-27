import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { productionHexLabyrinthMapFixture } from "./fixtures/labyrinth-hex-map";
import { critical } from "./playwright-tags";
import { injectLabyrinthRun, makeHighDamageCard } from "./helpers";

test.describe("Labyrinth Mode", critical, () => {
  test.beforeEach(async ({ runtimeErrors }) => {
    void runtimeErrors;
  });

  test("labyrinth map pins chamber details on a hex", critical, async ({ page }) => {
    await injectLabyrinthRun(page, { deck: Array.from({ length: 6 }, () => makeHighDamageCard()), resume: true });

    await expect(page.getByRole("heading", { name: /Labyrinth|Map/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("region", { name: "Labyrinth map" })).toBeVisible();

    const combatNodes = page.getByRole("button", { name: /Combat chamber/ });
    await expect(combatNodes.first()).toBeVisible({ timeout: 5000 });
    await combatNodes.first().click();
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fight", exact: true })).toBeVisible();

    const restNodes = page.getByRole("button", { name: /Rest chamber/ });
    await restNodes.first().click();
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fight", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Rest", exact: true })).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Main Menu" })).toHaveCount(0);
  });

  test("switching floors dismisses the chamber inspector", critical, async ({ page }) => {
    await injectLabyrinthRun(page, { labyrinthMap: productionHexLabyrinthMapFixture(), resume: true });

    await expect(page.getByRole("heading", { name: /Labyrinth|Map/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Floor 1" })).toBeVisible();
    const chamber = page.getByRole("button", { name: /chamber/i, disabled: false }).first();
    await chamber.click();
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeVisible();

    await page.getByRole("button", { name: "Floor 1" }).click();
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Main Menu" })).toBeVisible();
  });
});
