import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { seedRandom, startAtDestination } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { MysteryPage } from "./pages/mystery-page";
import { prepush } from "./playwright-tags";

test.describe("Mystery Event Flow", () => {
  test("mystery event screen shows with title and choices", prepush, async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    await startAtDestination(page, {}, { forceDestination: "Mystery" });
    await page.getByRole("button", { name: "Mystery" }).click();
    await new MenuPage(page).stage.expectRunPhase("runLoop");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("mystery completes and returns to destination choices", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await seedRandom(page, 42);
    await startAtDestination(page, {}, { forceDestination: "Mystery" });
    await page.getByRole("button", { name: "Mystery" }).click();

    const mystery = new MysteryPage(page);
    await mystery.pickFirstChoice();

    const continueBtn = mystery.continueBtn;

    const addCardBtn = page.getByRole("button", { name: "Add Card" });
    const removeCardBtn = page.getByRole("button", { name: /^Remove Card$/ });
    const cardChoice = page.locator("button[aria-label^='Select']");

    await expect(async () => {
      const hasCardChoice = await cardChoice.isVisible().catch(() => false);

      if (hasCardChoice) {
        const isAdd = await addCardBtn.isVisible().catch(() => false);
        const isRemove = await removeCardBtn.isVisible().catch(() => false);
        if (isAdd || isRemove) {
          await cardChoice.first().click();
          if (isAdd) await addCardBtn.click();
          else await removeCardBtn.click();
        }
      }
      await expect(continueBtn).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 10000 });

    await continueBtn.click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });
});
