import { savedActivityFixture, savedActivityData } from "../../fixtures/run-activity";
import { expect, test } from "../../fixtures/e2e";
import {
  injectExactSave,
  injectActiveBattle,
  makeCard,
  makeGoblinBattleState,
  readSavedGame,
  seedRandom,
  enterPrimaryRewardScreen,
  withSavedGame,
} from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { DestinationPage } from "../../pages/destination-page";
import { RewardPage } from "../../pages/reward-page";
import { critical } from "../../playwright-tags";
import { currentSchemaCampaignSave } from "../../fixtures/current-saves";

test("current-format resume retains Health, Gold, and offered destinations", critical, async ({ page }) => {
  const save = currentSchemaCampaignSave();
  await injectExactSave(page, {
    ...save,
    activeRun: {
      ...(save.activeRun as unknown as Record<string, unknown>),
      activity: savedActivityFixture("destination", {
        kind: "destination",
        destinations: ["Campfire", "Mystery", "Card Shop"],
        selectedBossId: null,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      }),
    },
  });
  await page.goto("/");
  await new DestinationPage(page).expectVisible();
  await expect.poll(async () => (await readSavedGame(page)).activeRun?.runPlayerHealth).toBe(18);
  await withSavedGame(page, async (resumed) => {
    await new DestinationPage(resumed).expectVisible();
    for (const name of ["Campfire", "Mystery", "Card Shop"]) {
      await expect(resumed.getByRole("button", { name, exact: true })).toBeVisible();
    }
    const restored = await readSavedGame(resumed);
    expect(restored.gold).toBe(42);
    expect(restored.activeRun?.runPlayerHealth).toBe(18);
    expect(restored.activeRun?.destinationIndexInAct).toBe(2);
  });
});

test("played cards and the next enemy turn survive a fresh-page resume", critical, async ({ page, fastBattle }) => {
  void fastBattle;
  await seedRandom(page, 42);
  const deck = Array.from({ length: 6 }, () => makeCard({ cost: 0 }));
  const state = makeGoblinBattleState({ hand: deck.slice(0, 4), deck: deck.slice(4) });
  state.currentEnemy = { ...state.currentEnemy, abilityIds: ["slash", "sunder", "burning-blade"] };
  await injectActiveBattle(page, state, { runDeck: deck, runPlayerHealth: 18 });
  const battle = new BattlePage(page);
  await battle.playFirstCard();
  await expect.poll(() => battle.enemyHealth()).toBeLessThan(40);
  await battle.endTurn();
  await expect.poll(() => battle.playerHealth()).toBeLessThan(18);
  await expect
    .poll(async () => savedActivityData((await readSavedGame(page)).activeRun, "battle")?.battleState.turn)
    .toBe(3);
  const acknowledged = savedActivityData((await readSavedGame(page)).activeRun!, "battle")!.battleState;
  await withSavedGame(page, async (resumed) => {
    const restored = new BattlePage(resumed);
    await expect(restored.endTurnBtn).toBeEnabled();
    await expect.poll(() => restored.playerHealth()).toBe(acknowledged.playerHealth);
    await expect.poll(() => restored.enemyHealth()).toBe(acknowledged.enemyHealth);
    await expect(restored.hand).toHaveCount(acknowledged.hand.length);
    expect(savedActivityData((await readSavedGame(resumed)).activeRun, "battle")?.battleState.turn).toBe(3);
    await restored.playFirstCard();
    await expect.poll(() => restored.handCount()).toBe(acknowledged.hand.length - 1);
  });
});

test(
  "a pending card reward can be resumed, claimed once, and resumed again",
  critical,
  async ({ page, fastBattle }) => {
    void fastBattle;
    await enterPrimaryRewardScreen(page, { rewardType: "card", choiceIds: ["slash", "bash"] });
    await expect.poll(async () => (await readSavedGame(page)).activeRun?.activity.kind).toBe("rewards");
    await withSavedGame(page, async (resumed) => {
      await new RewardPage(resumed).claimFirstReward();
      await new DestinationPage(resumed).expectVisible();
      await expect
        .poll(
          async () => (await readSavedGame(resumed)).activeRun?.runDeck.filter((card) => card.id === "slash").length,
        )
        .toBe(1);
      await withSavedGame(resumed, async (restored) => {
        await new DestinationPage(restored).expectVisible();
        await restored.getByRole("button", { name: "View Deck · 7 cards" }).click();
        await expect(restored.getByRole("dialog").getByRole("img", { name: "Slash", exact: true })).toBeVisible();
        expect((await readSavedGame(restored)).activeRun?.runDeck).toHaveLength(7);
      });
    });
  },
);
