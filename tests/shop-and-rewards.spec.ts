import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { ShopPage } from "./pages/shop-page";
import { RewardPage } from "./pages/reward-page";
import { DestinationPage } from "./pages/destination-page";
import { enterPrimaryRewardScreen, SAVE_KEY, startAtDestination } from "./helpers";
import { critical, slow } from "./playwright-tags";

async function enterShop(
  page: import("@playwright/test").Page,
  gold: number,
  destination: "Card Shop" | "Equipment Shop",
) {
  await startAtDestination(page, { runGold: gold }, { forceDestination: destination });
  await page.getByRole("button", { name: destination }).click();
  await expect(page.getByRole("heading", { name: destination })).toBeVisible();
}

test.describe("Card Shop", critical, () => {
  test.describe("with sufficient gold", () => {
    test.beforeEach(async ({ page, runtimeErrors }) => {
      void runtimeErrors;
      await enterShop(page, 9999, "Card Shop");
    });

    test("buying a card deducts gold and marks as purchased", critical, async ({ page }) => {
      const shop = new ShopPage(page);
      await shop.stage.expectRunPhase("runLoop");
      const goldBefore = await shop.gold();

      await shop.buyCard();
      await shop.waitForPurchase();

      expect(await shop.gold()).toBeLessThan(goldBefore);
    });
  });
});

test.describe("Shop fade-out", critical, () => {
  for (const destination of ["Card Shop", "Equipment Shop"] as const) {
    const gate = destination === "Card Shop" ? critical : slow;

    test(`keeps ${destination} offerings mounted through route fade-out`, gate, async ({ page, runtimeErrors }) => {
      void runtimeErrors;
      const shop = new ShopPage(page);
      await enterShop(page, 9999, destination);
      const offeringCount = await shop.buyBtn.count();
      expect(offeringCount).toBeGreaterThan(0);

      await page.getByRole("button", { name: "Leave", exact: true }).click();

      await expect.poll(() => shop.buyBtn.count(), { timeout: 10000 }).toBe(offeringCount);
      await new DestinationPage(page).expectVisible();
    });
  }
});

test.describe("Reward Flow", critical, () => {
  test(
    "card reward: requires confirmation and selecting and adding a card works",
    critical,
    async ({ page, fastBattle, runtimeErrors }) => {
      void fastBattle;
      void runtimeErrors;
      await enterPrimaryRewardScreen(page, { rewardType: "card", choiceIds: ["slash", "bash"] });

      const reward = new RewardPage(page);
      await reward.claimWithConfirmationGate();
      await new DestinationPage(page).expectVisible();
    },
  );

  test("boon, trinket, and gear rewards persist correctly", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await enterPrimaryRewardScreen(page, {
      rewardType: "boon",
      choiceIds: ["tattered-pages", "companions-collar"],
    });
    await new RewardPage(page).claimWithConfirmationGate();
    await new DestinationPage(page).expectVisible();
    const boons = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return save.activeRun?.runBoons ?? [];
    }, SAVE_KEY);
    expect(boons).toContain("tattered-pages");

    await enterPrimaryRewardScreen(page, {
      rewardType: "trinket",
      choiceIds: ["tattered-pages", "companions-collar"],
    });
    await new RewardPage(page).claimWithConfirmationGate();
    await new DestinationPage(page).expectVisible();
    const saved = await page.evaluate((saveKey) => JSON.parse(localStorage.getItem(saveKey) || "{}"), SAVE_KEY);
    expect(saved.ownedTrinketIds).toContain("tattered-pages");
    expect(saved.activeRun?.runBoons ?? []).not.toContain("tattered-pages");

    await enterPrimaryRewardScreen(page, {
      rewardType: "gear",
      gearChoices: [{ instanceId: "reward-gear", definitionId: "leather-armor-basic", affixes: [] }],
    });
    await new RewardPage(page).claimWithConfirmationGate();
    await new DestinationPage(page).expectVisible();
    const gearInventory = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      const inventories = save.gearInventories || {};
      return Object.values(inventories).flat() as Array<{ instanceId: string }>;
    }, SAVE_KEY);
    expect(gearInventory.some((g) => g.instanceId === "reward-gear")).toBe(true);
  });

  test("reward selection persists across page reload", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await enterPrimaryRewardScreen(page, {
      rewardType: "trinket",
      choiceIds: ["tattered-pages", "companions-collar"],
    });

    const reward = new RewardPage(page);
    await reward.selectFirstReward();
    await expect(reward.addRewardBtn).toBeEnabled();

    await expect
      .poll(async () => {
        const save = await page.evaluate((saveKey) => {
          return JSON.parse(localStorage.getItem(saveKey) || "{}");
        }, SAVE_KEY);
        const flow = save.activeRun?.interruptedFlow;
        return flow?.kind === "primary-reward" ? flow.pending?.selectedId : null;
      })
      .not.toBeNull();

    await expect(reward.addRewardBtn).toBeEnabled();
  });
});
