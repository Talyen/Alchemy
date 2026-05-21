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

    const inspectBtn = page.getByRole("button", { name: /Inspect Slash/ });
    if (await inspectBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await inspectBtn.hover();
      await expect(page.getByText("Deal 5")).toBeVisible();
    }
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
