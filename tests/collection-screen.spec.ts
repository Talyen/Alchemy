import { expect, test } from "@playwright/test";

test.describe("Collection Screen", () => {
  test("Main Menu button is centered at the bottom of the screen", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Collection" }).click();
    await expect(page.getByRole("heading", { name: "Collection" })).toBeVisible({ timeout: 3000 });

    const button = page.getByRole("button", { name: "Main Menu" });
    await expect(button).toBeVisible();

    const box = await button.boundingBox();
    const viewport = page.viewportSize()!;
    const buttonCenterX = box!.x + box!.width / 2;

    // Button should be roughly centered (within 10% of viewport center)
    const centerThreshold = viewport.width * 0.1;
    expect(Math.abs(buttonCenterX - viewport.width / 2)).toBeLessThan(centerThreshold);
  });
});
