import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./e2e/errors";
import { critical } from "./playwright-tags";

test.describe("App Boot", critical, () => {
  test("main menu renders without crashing on desktop", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 5000 });
    expect(errors).toEqual([]);
  });
});
