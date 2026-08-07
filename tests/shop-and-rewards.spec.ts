import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { ShopPage } from "./pages/shop-page";
import { RewardPage } from "./pages/reward-page";
import { DestinationPage } from "./pages/destination-page";
import {
  injectSaveState,
  primaryRewardInterruptedFlow,
  makeHighDamageCard,
  SAVE_KEY,
  skipBattleAndClaimReward,
  startBattleWithDeck,
} from "./helpers";
import { critical, prepush } from "./playwright-tags";

test.describe("Merchant Shop", () => {
  test.describe("with sufficient gold", () => {
    test.beforeEach(async ({ page }) => {
      await new ShopPage(page).enterFromDestination(9999, "Merchant's Shop");
    });

    test("buying a card deducts gold and marks as purchased", { ...critical, ...prepush }, async ({ page }) => {
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

      const cardNamesAfter = await shop.getInspectLabels();
      const sameCards =
        cardNamesBefore.length === cardNamesAfter.length &&
        cardNamesBefore.every((name, i) => name === cardNamesAfter[i]);
      expect(sameCards).toBe(false);
    });

    test("remove card button is visible with sufficient gold", async ({ page }) => {
      const shop = new ShopPage(page);
      await expect(shop.removeCardBtn).toBeVisible();
      await expect(shop.removeCardBtn).toBeEnabled();
    });
  });

  test.describe("with insufficient gold", () => {
    test.beforeEach(async ({ page }) => {
      await new ShopPage(page).enterFromDestination(40, "Merchant's Shop");
    });

    test("buying a card deducts gold and reflects balance", async ({ page }) => {
      const shop = new ShopPage(page);
      const goldBefore = await shop.gold();

      await shop.buyCard();
      await shop.waitForPurchase();

      expect(await shop.gold()).toBeLessThan(goldBefore);
    });
  });
});

test.describe("Alchemist Shop", () => {
  test.describe("with sufficient gold", () => {
    test.beforeEach(async ({ page }) => {
      await new ShopPage(page).enterFromDestination(9999, "Alchemist's Shop");
    });

    test("buy potions and mix them", async ({ page }) => {
      const shop = new ShopPage(page);

      for (let i = 0; i < 2; i++) {
        await shop.buyCard(i);
      }
      await expect(page.getByText("Purchased").first()).toBeVisible();

      await shop.mixPotions();
      await expect(page.getByLabel("Mixed Potion")).toBeVisible();
      await shop.continueBtn.click();
    });
  });

  test.describe("with insufficient gold", () => {
    test.beforeEach(async ({ page }) => {
      await new ShopPage(page).enterFromDestination(40, "Alchemist's Shop");
    });

    test("buying potions deducts gold and purchased state is shown", async ({ page }) => {
      const shop = new ShopPage(page);
      const goldBefore = await shop.gold();

      await shop.buyCard();
      await shop.waitForPurchase();

      expect(await shop.gold()).toBeLessThan(goldBefore);
    });
  });
});

test.describe("Reward Flow", () => {
  test(
    "card reward: selecting and adding card works",
    { ...critical, ...prepush },
    async ({ page, fastBattle, runtimeErrors }) => {
      void fastBattle;
      void runtimeErrors;
      await startBattleWithDeck(
        page,
        Array.from({ length: 6 }, () => makeHighDamageCard()),
      );
      await skipBattleAndClaimReward(page);
      await new DestinationPage(page).expectVisible();
    },
  );

  test(
    "trinket reward: trinket appears in runTrinkets after claiming",
    critical,
    async ({ page, fastBattle, runtimeErrors }) => {
      void fastBattle;
      void runtimeErrors;
      await injectSaveState(page, {
        runDeck: Array.from({ length: 6 }, () => makeHighDamageCard()),
        currentScreen: "rewards",
        interruptedFlow: primaryRewardInterruptedFlow({
          rewardType: "trinket",
          choiceIds: ["tattered-pages", "companions-collar"],
          selectedId: null,
          gold: 0,
          materials: {},
          destinations: [],
          selectedBossId: null,
          lastVictoryEnemyType: "normal",
          lastVictoryContentSystem: "campaign",
        }),
      });
      await page.goto("/");

      const reward = new RewardPage(page);
      const addRewardBtn = reward.addRewardBtn;
      await expect(addRewardBtn).toBeDisabled();
      await reward.selectFirstReward();
      await expect(addRewardBtn).toBeEnabled();
      await addRewardBtn.click();
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
    await injectSaveState(page, {
      runDeck: Array.from({ length: 6 }, () => makeHighDamageCard()),
      currentScreen: "rewards",
      interruptedFlow: primaryRewardInterruptedFlow({
        rewardType: "gear",
        gearChoices: [{ instanceId: "reward-gear", definitionId: "leather-armor-basic", affixes: [] }],
        selectedId: null,
        gold: 0,
        materials: {},
        destinations: [],
        selectedBossId: null,
        lastVictoryEnemyType: "normal",
        lastVictoryContentSystem: "campaign",
      }),
    });
    await page.goto("/");

    const reward = new RewardPage(page);
    const addRewardBtn = reward.addRewardBtn;
    await expect(addRewardBtn).toBeDisabled();
    await reward.selectFirstReward();
    await expect(addRewardBtn).toBeEnabled();
    await addRewardBtn.click();
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
    await injectSaveState(page, {
      runDeck: Array.from({ length: 6 }, () => makeHighDamageCard()),
      currentScreen: "rewards",
      interruptedFlow: primaryRewardInterruptedFlow({
        rewardType: "trinket",
        choiceIds: ["tattered-pages", "companions-collar"],
        selectedId: null,
        gold: 0,
        materials: {},
        destinations: [],
        selectedBossId: null,
        lastVictoryEnemyType: "normal",
        lastVictoryContentSystem: "campaign",
      }),
    });
    await page.goto("/");

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
