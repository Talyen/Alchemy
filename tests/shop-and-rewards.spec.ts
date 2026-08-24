import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { ShopPage } from "./pages/shop-page";
import { RewardPage } from "./pages/reward-page";
import { DestinationPage } from "./pages/destination-page";
import { enterPrimaryRewardScreen, SAVE_KEY } from "./helpers";
import { critical } from "./playwright-tags";

test.describe("Merchant Shop", critical, () => {
  test.describe("with sufficient gold", () => {
    test.beforeEach(async ({ page, runtimeErrors }) => {
      void runtimeErrors;
      await new ShopPage(page).enterFromDestination(9999, "Merchant's Shop");
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

  for (const destination of ["Merchant's Shop", "Alchemist's Shop", "Trinket Shop", "Equipment Shop"] as const) {
    test(`keeps ${destination} offerings mounted through route fade-out`, async ({ page, runtimeErrors }) => {
      void runtimeErrors;
      const shop = new ShopPage(page);
      await shop.enterFromDestination(9999, destination);
      const offeringCount = await shop.buyBtn.count();
      expect(offeringCount).toBeGreaterThan(0);

      await page.getByRole("button", { name: "Leave", exact: true }).click();

      await expect(page.locator(".page-exit")).toBeAttached();
      await expect(shop.heading).toBeAttached();
      await expect.poll(() => shop.buyBtn.count()).toBe(offeringCount);
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

  test("trinket reward: trinket appears in runTrinkets after claiming", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await enterPrimaryRewardScreen(page, {
      rewardType: "trinket",
      choiceIds: ["tattered-pages", "companions-collar"],
    });

    const reward = new RewardPage(page);
    await reward.claimWithConfirmationGate();
    await new DestinationPage(page).expectVisible();

    const trinkets = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return save.activeRun?.runTrinkets ?? [];
    }, SAVE_KEY);
    expect(trinkets).toContain("tattered-pages");
  });

  test("gear reward: claiming gear adds it to gearInventory", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await enterPrimaryRewardScreen(page, {
      rewardType: "gear",
      gearChoices: [{ instanceId: "reward-gear", definitionId: "leather-armor-basic", affixes: [] }],
    });

    const reward = new RewardPage(page);
    await reward.claimWithConfirmationGate();
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

    await page.reload();
    await expect(reward.addRewardBtn).toBeEnabled();
  });
});
