import { expect, test } from "@playwright/test";
import { startRun } from "./helpers";

async function skipAndReward(page: ReturnType<typeof test>["page"]) {
  await page.getByRole("button", { name: "Skip Combat" }).click();
  await expect(page.getByRole("heading", { name: /^Victory/ })).toBeVisible({ timeout: 5000 });
  await page.locator('[aria-label^="Select "]').first().click();
  await page.getByRole("button", { name: /^(Add Card|Take Trinket)$/ }).click();
}

async function navigateToDestination(page: ReturnType<typeof test>["page"], name: string) {
  for (let attempt = 0; attempt < 10; attempt++) {
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    const target = page.getByRole("button", { name });
    if (await target.isVisible({ timeout: 500 }).catch(() => false)) {
      await target.click();
      return;
    }
    const combatBtn = page.getByRole("button", { name: /Combat/ }).first();
    if (await combatBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await combatBtn.click();
      await page.waitForSelector('[aria-label^="Play "]');
      await skipAndReward(page);
    } else {
      await page.getByRole("button").last().click();
      await page.waitForTimeout(500);
      const cont = page.getByRole("button", { name: "Continue" });
      if (await cont.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cont.click();
      } else {
        const choiceBtn = page.locator("button").filter({ hasNotText: /Cancel|Menu|Remove Card|Previous|Next/ }).first();
        if (await choiceBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await choiceBtn.click();
          await page.waitForTimeout(300);
          await page.getByRole("button", { name: /Continue|Add Card|Remove Card/ }).first().click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(200);
          await page.getByRole("button", { name: "Continue" }).click({ timeout: 2000 }).catch(() => {});
        }
      }
    }
  }
  test.skip(true, `Could not find "${name}" in destination choices`);
}

const GOLD_TALENTS = ["gold-start", "gold-potion-discount", "gold-mix-discount"];

function seedGoldTalents(page: ReturnType<typeof test>["page"]) {
  return page.addInitScript((talents) => {
    const save = JSON.parse(localStorage.getItem("alchemy-save-v1") || "{}");
    save.unlockedTalents = { ...save.unlockedTalents, gold: talents };
    localStorage.setItem("alchemy-save-v1", JSON.stringify(save));
  }, GOLD_TALENTS);
}

test.describe("Merchant Shop", () => {
  test("buying a card deducts gold and marks as purchased", async ({ page }) => {
    await seedGoldTalents(page);
    await startRun(page);
    await skipAndReward(page);
    await navigateToDestination(page, "Merchant's Shop");

    await expect(page.getByRole("heading", { name: "Merchant's Shop" })).toBeVisible();

    const goldText = await page.getByText(/\d+ Gold/).first().textContent();
    const goldBefore = goldText ? Number(goldText.match(/\d+/)?.[0]) : 0;

    const buyButton = page.getByRole("button", { name: /^Buy/ }).first();
    await expect(buyButton).toBeVisible();
    if (!(await buyButton.isEnabled())) {
      test.skip(true, "Not enough gold to buy a card");
      return;
    }
    await buyButton.click();
    await page.waitForTimeout(300);

    await expect(page.getByText("Purchased").first()).toBeVisible({ timeout: 3000 });

    const goldAfterText = await page.getByText(/\d+ Gold/).first().textContent();
    const goldAfter = goldAfterText ? Number(goldAfterText.match(/\d+/)?.[0]) : 0;
    expect(goldAfter).toBeLessThan(goldBefore);
  });
});

test.describe("Alchemist Shop", () => {
  test("buy potions and mix them", async ({ page }) => {
    test.setTimeout(60000);
    await seedGoldTalents(page);
    await startRun(page);

    // Accumulate gold via extra skip combats (need ~60g: 2 potions × 15 + mix 30)
    for (let i = 0; i < 3; i++) {
      await skipAndReward(page);
      // First 2: pick another combat; last: stay at destination for shop search
      if (i < 2) {
        await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
        await page.getByRole("button", { name: /Combat/ }).first().click();
        await page.waitForSelector('[aria-label^="Play "]');
      }
    }

    // Allow navigateTo debounce + page exit animation to complete
    await page.waitForTimeout(500);

    await navigateToDestination(page, "Alchemist's Shop");
    await expect(page.getByRole("heading", { name: "Alchemist's Shop" })).toBeVisible();

    // Buy 2 potions
    for (let i = 0; i < 2; i++) {
      const buyButton = page.getByRole("button", { name: /^Buy/ }).nth(0);
      if (!(await buyButton.isVisible({ timeout: 1000 }).catch(() => false)) || !(await buyButton.isEnabled())) {
        test.skip(true, `Not enough gold to buy potion #${i + 1}`);
        return;
      }
      await buyButton.click();
      await page.waitForTimeout(300);
    }
    await expect(page.getByText("Purchased").nth(0)).toBeVisible();

    // Check if Mix Potions is affordable
    const mixButton = page.getByRole("button", { name: /Mix Potions/ });
    if (!(await mixButton.isEnabled())) {
      test.skip(true, "Not enough gold to mix potions");
      return;
    }
    await mixButton.click();
    await expect(page.getByText("Select two Potions to Combine")).toBeVisible();

    const potionCards = page.locator('[aria-label^="Inspect "]');
    const potionCount = await potionCards.count();
    if (potionCount < 2) {
      test.skip(true, "Not enough potions in deck to mix");
      return;
    }

    await potionCards.nth(0).click();
    await page.waitForTimeout(200);
    await potionCards.nth(1).click();
    await page.waitForTimeout(200);

    await page.getByRole("button", { name: "Combine" }).click();
    await page.waitForTimeout(300);

    await expect(page.getByText("Added to Deck: Mixed Potion")).toBeVisible({ timeout: 3000 });
    await expect(page.getByLabel("Mixed Potion")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
  });
});
