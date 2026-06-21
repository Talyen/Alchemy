import { expect } from "@playwright/test";
import { injectSaveState, makeHighDamageCard, SAVE_KEY, skipBattleAndClaimReward, startBattleWithDeck } from "./helpers";
import { DestinationPage } from "./pages/destination-page";
import { RewardPage } from "./pages/reward-page";
import { test } from "./fixtures/e2e";
import { critical, prepush } from "./playwright-tags";

test.describe("Reward Flow", critical, () => {
  test("card reward: selecting and adding card works", prepush, async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeHighDamageCard()),
    );
    await skipBattleAndClaimReward(page);
    await new DestinationPage(page).expectVisible();
  });

  test("trinket reward: trinket appears in runTrinkets after claiming", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await injectSaveState(page, {
      runDeck: Array.from({ length: 6 }, () => makeHighDamageCard()),
      currentScreen: "reward",
      pendingReward: {
        rewardType: "trinket",
        choiceIds: ["tattered-pages", "companions-collar"],
        selectedId: null,
        gold: 0,
        materials: {},
        destinations: [],
        selectedBossId: null,
        lastVictoryEnemyType: "normal",
        lastVictoryContentSystem: "campaign",
      },
    });
    await page.goto("/");

    const reward = new RewardPage(page);
    const addRewardBtn = reward.addRewardBtn;
    await expect(addRewardBtn).toBeDisabled();
    await reward.selectFirstReward();
    await expect(addRewardBtn).toBeEnabled();
    await addRewardBtn.click();

    const trinkets = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return save.activeRun?.runTrinkets ?? [];
    }, SAVE_KEY);
    expect(trinkets).toContain("tattered-pages");
  });

  test("gear reward: claiming gear adds it to gearInventory", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await injectSaveState(page, {
      runDeck: Array.from({ length: 6 }, () => makeHighDamageCard()),
      currentScreen: "reward",
      pendingReward: {
        rewardType: "gear",
        gearChoices: [
          { instanceId: "reward-gear", definitionId: "leather-armor-basic", affixes: [] },
        ],
        selectedId: null,
        gold: 0,
        materials: {},
        destinations: [],
        selectedBossId: null,
        lastVictoryEnemyType: "normal",
        lastVictoryContentSystem: "campaign",
      },
    });
    await page.goto("/");

    const reward = new RewardPage(page);
    const addRewardBtn = reward.addRewardBtn;
    await expect(addRewardBtn).toBeDisabled();
    await reward.selectFirstReward();
    await expect(addRewardBtn).toBeEnabled();
    await addRewardBtn.click();

    const gearInventory = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return save.gearInventory ?? [];
    }, SAVE_KEY);
    expect(gearInventory.some((g: { instanceId: string }) => g.instanceId === "reward-gear")).toBe(true);
  });

  test("reward selection persists across page reload", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await injectSaveState(page, {
      runDeck: Array.from({ length: 6 }, () => makeHighDamageCard()),
      currentScreen: "reward",
      pendingReward: {
        rewardType: "trinket",
        choiceIds: ["tattered-pages", "companions-collar"],
        selectedId: null,
        gold: 0,
        materials: {},
        destinations: [],
        selectedBossId: null,
        lastVictoryEnemyType: "normal",
        lastVictoryContentSystem: "campaign",
      },
    });
    await page.goto("/");

    const reward = new RewardPage(page);
    await reward.selectFirstReward();
    await expect(reward.addRewardBtn).toBeEnabled();

    await page.reload();
    await expect(reward.addRewardBtn).toBeEnabled();
  });
});
