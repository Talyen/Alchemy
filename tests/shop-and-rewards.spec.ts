import { expect } from "@playwright/test";
import { SHOP_CARD_PRICE } from "@/lib/game-constants";
import { test } from "./fixtures/e2e";
import { ShopPage } from "./pages/shop-page";
import { RewardPage } from "./pages/reward-page";
import { DestinationPage } from "./pages/destination-page";
import { enterPrimaryRewardScreen, SAVE_KEY } from "./helpers";
import { critical } from "./playwright-tags";

test.describe("Merchant Shop", () => {
  test.describe("with sufficient gold", () => {
    test.beforeEach(async ({ page }) => {
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

    test("card removal deducts gold and removes card from deck", async ({ page }) => {
      const shop = new ShopPage(page);
      const goldBefore = await shop.gold();

      await shop.startCardRemoval();
      await shop.selectCardInGrid();
      await shop.confirmRemoval();

      expect(await shop.gold()).toBeLessThan(goldBefore);
    });

    test("shop refresh changes displayed cards and deducts gold", async ({ page }) => {
      const shop = new ShopPage(page);
      await expect(shop.inspectButtons.first()).toBeVisible();
      const cardNamesBefore = await shop.getInspectLabels();
      expect(cardNamesBefore.length).toBeGreaterThan(0);

      const goldBefore = await shop.gold();
      await shop.refresh();

      await expect(async () => {
        expect(await shop.gold()).toBeLessThan(goldBefore);
      }).toPass({ timeout: 3000 });

      await expect(async () => {
        const cardNamesAfter = await shop.getInspectLabels();
        const sameCards =
          cardNamesBefore.length === cardNamesAfter.length &&
          cardNamesBefore.every((name, i) => name === cardNamesAfter[i]);
        expect(sameCards).toBe(false);
      }).toPass({ timeout: 3000 });
    });
  });

  test("buy is disabled when gold is below the card price", async ({ page }) => {
    const shop = new ShopPage(page);
    await shop.enterFromDestination(SHOP_CARD_PRICE - 1, "Merchant's Shop");
    await expect(shop.buyBtn.first()).toBeDisabled();
  });
});

test.describe("Alchemist Shop", () => {
  test("buy potions and mix them", async ({ page }) => {
    const shop = new ShopPage(page);
    await shop.enterFromDestination(9999, "Alchemist's Shop");

    for (let i = 0; i < 2; i++) {
      await shop.buyCard(i);
    }
    await expect(page.getByText("Purchased").first()).toBeVisible();

    await shop.mixPotions();
    await expect(page.getByLabel("Mixed Potion")).toBeVisible();
    await shop.continueBtn.click();
  });
});

test.describe("Reward Flow", () => {
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

  test(
    "trinket reward: trinket appears in runTrinkets after claiming",
    critical,
    async ({ page, fastBattle, runtimeErrors }) => {
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
    },
  );

  test("gear reward: claiming gear adds it to gearInventory", critical, async ({ page, fastBattle, runtimeErrors }) => {
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
