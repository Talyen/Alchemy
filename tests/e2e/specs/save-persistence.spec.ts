import { expect, test } from "../../fixtures/e2e";
import {
  injectExactSave,
  injectActiveBattle,
  makeCard,
  makeGoblinBattleState,
  makeHighDamageCard,
  readSavedGame,
  seedRandom,
  startBattleWithDeck,
  enterPrimaryRewardScreen,
  withSavedGame,
  SAVE_KEY,
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
      ...(save.activeRun as Record<string, unknown>),
      interruptedFlow: {
        kind: "destination",
        destinations: ["Campfire", "Mystery", "Card Shop"],
        selectedBossId: null,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      },
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
  await expect.poll(async () => (await readSavedGame(page)).activeRun?.activeCombat?.battleState.turn).toBe(3);
  const acknowledged = (await readSavedGame(page)).activeRun!.activeCombat!.battleState;
  await withSavedGame(page, async (resumed) => {
    const restored = new BattlePage(resumed);
    await expect(restored.endTurnBtn).toBeEnabled();
    await expect.poll(() => restored.playerHealth()).toBe(acknowledged.playerHealth);
    await expect.poll(() => restored.enemyHealth()).toBe(acknowledged.enemyHealth);
    await expect(restored.hand).toHaveCount(acknowledged.hand.length);
    expect((await readSavedGame(resumed)).activeRun?.activeCombat?.battleState.turn).toBe(3);
    await restored.playFirstCard();
    await expect.poll(() => restored.handCount()).toBe(acknowledged.hand.length - 1);
  });
});

test("an interrupted enemy turn resumes once with a playable hand", critical, async ({ page, fastBattle }) => {
  void fastBattle;
  await startBattleWithDeck(
    page,
    Array.from({ length: 6 }, () => makeHighDamageCard()),
  );
  await expect
    .poll(async () => (await readSavedGame(page)).activeRun?.activeCombat?.battleState.turnPhase)
    .toBe("player");
  const handSize = await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) ?? "{}");
    const run = save.activeRun;
    const combat = run.activeCombat;
    const resultState = combat.battleState;
    run.activeCombat = {
      ...combat,
      battleState: { ...resultState, turnPhase: "enemy", hand: [] },
      pendingBattleTransition: { kind: "enemy-turn", resultState, playerTurnSkipped: false },
    };
    localStorage.setItem(key, JSON.stringify(save));
    return resultState.hand.length as number;
  }, SAVE_KEY);
  expect(handSize).toBeGreaterThan(0);
  await withSavedGame(page, async (resumed) => {
    const battle = new BattlePage(resumed);
    await expect(battle.endTurnBtn).toBeEnabled();
    await expect(battle.hand).toHaveCount(handSize);
    await expect
      .poll(async () => Boolean((await readSavedGame(resumed)).activeRun?.activeCombat?.pendingBattleTransition))
      .toBe(false);
    const health = await battle.enemyHealth();
    await battle.playFirstCard();
    await expect.poll(() => battle.enemyHealth()).toBeLessThan(health);
  });
});

test(
  "a pending card reward can be resumed, claimed once, and resumed again",
  critical,
  async ({ page, fastBattle }) => {
    void fastBattle;
    await enterPrimaryRewardScreen(page, { rewardType: "card", choiceIds: ["slash", "bash"] });
    await expect.poll(async () => (await readSavedGame(page)).activeRun?.interruptedFlow?.kind).toBe("primary-reward");
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
