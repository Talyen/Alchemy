import { expect, test } from "@playwright/test";

test.describe("Collection", () => {
  test("collection shows all three tabs with content and card inspection works", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Collection" }).click();

    await expect(page.getByRole("heading", { name: "Collection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cards" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bestiary" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Trinkets" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Inspect/ }).first()).toBeVisible();

    // Anvil is alphabetically first (page 0 of paginated collection).
    const inspectBtn = page.getByRole("button", { name: /Inspect Anvil/ });
    await expect(inspectBtn).toBeVisible({ timeout: 5000 });
    await inspectBtn.hover();
    await expect(page.getByText(/^Gain \d+ Forge/)).toBeVisible();
  });

  test("collection tab navigation shows bestiary and trinket undiscovered entries", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Collection" }).click();

    await page.getByRole("button", { name: "Bestiary" }).click();
    await expect(page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Trinkets" }).click();
    await expect(page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Cards" }).click();
    await expect(page.getByRole("button", { name: /Inspect/ }).first()).toBeVisible();
  });
});
