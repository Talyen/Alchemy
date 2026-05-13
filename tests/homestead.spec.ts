import { expect, test } from "@playwright/test";

test.describe("Homestead Screen", () => {
  test("all tabs render items with disabled buttons from main menu", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Homestead" }).click();
    await expect(page.getByRole("heading", { name: "Homestead" })).toBeVisible();

    // Materials bar: 5 resource types visible
    await expect(page.getByText("0 Wood")).toBeVisible();
    await expect(page.getByText("0 Iron")).toBeVisible();
    await expect(page.getByText("0 Herbs")).toBeVisible();
    await expect(page.getByText("0 Food")).toBeVisible();
    await expect(page.getByText("0 Crystal")).toBeVisible();

    // Buildings tab (default) — first building should be Blacksmith's Forge
    const buildingsTab = page.getByRole("button", { name: "Buildings" });
    await expect(buildingsTab).toBeVisible();
    await expect(page.getByText("Blacksmith's Forge")).toBeVisible();
    await expect(page.getByText("Hunter's Lodge")).toBeVisible();
    await expect(page.getByText("Alchemy Lab")).toBeVisible();
    // Build buttons (with cost suffix e.g. "Build 20") are disabled since we have 0 materials
    const buildButtons = page.getByRole("button", { name: /^Build \d+/ });
    const buildCount = await buildButtons.count();
    expect(buildCount).toBeGreaterThanOrEqual(4);
    await expect(buildButtons.first()).toBeDisabled();

    // Farm tab
    await page.getByRole("button", { name: "Farm" }).click();
    await expect(page.getByText("Herb Garden")).toBeVisible();
    await expect(page.getByText("Wheat Field")).toBeVisible();
    await expect(page.getByText("Chicken Coop")).toBeVisible();

    // Research tab
    await page.getByRole("button", { name: "Research" }).click();
    await expect(page.getByText("Advanced Carpentry")).toBeVisible();
    await expect(page.getByText("Stone Masonry")).toBeVisible();
    await expect(page.getByText("Crop Rotation")).toBeVisible();
    const researchButtons = page.getByRole("button", { name: /^Research \d+/ });
    expect(researchButtons).not.toHaveCount(0);

    // Navigate back to main menu
    await page.getByRole("button", { name: "Main Menu" }).click();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 5000 });
  });
});
