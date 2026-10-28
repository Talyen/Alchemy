import { savedActivityData } from "../../fixtures/run-activity";
import { expect, test } from "../../fixtures/e2e";
import {
  injectActiveBattle,
  makeCard,
  makeGoblinBattleState,
  readSavedGame,
  seedRandom,
  withSavedGame,
} from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { readSfxPlays, resetSfxPlays, trackSfxPlays } from "../../pages/audio-harness";
import { critical } from "../../playwright-tags";

test("rapid End Turn advances once, plays SFX, and survives resume", critical, async ({ page }) => {
  test.setTimeout(process.env.CI ? 0 : 45_000);
  await seedRandom(page, 42);
  await trackSfxPlays(page, "sword-attack-1.");
  const deck = Array.from({ length: 6 }, () =>
    makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] }),
  );
  const state = makeGoblinBattleState({ hand: deck.slice(0, 4), deck: deck.slice(4) });
  state.currentEnemy = { ...state.currentEnemy, abilityIds: ["slash", "sunder", "burning-blade"] };
  await injectActiveBattle(page, state, { runDeck: deck });
  const battle = new BattlePage(page);
  await battle.waitForOpeningHand();
  await resetSfxPlays(page);
  await battle.playFirstCard();
  await expect(battle.hand).toHaveCount(3);
  await expect.poll(() => battle.enemyHealth()).toBeLessThan(40);
  await expect.poll(() => readSfxPlays(page)).toBeGreaterThan(0);
  const health = await battle.playerHealth();
  await battle.endTurnBtn.click({ clickCount: 3, delay: 20 });
  await expect.poll(() => battle.playerHealth()).toBeLessThan(health);
  await expect(battle.hand).toHaveCount(4);
  await expect(battle.endTurnBtn).toBeEnabled({ timeout: 15_000 });
  await expect
    .poll(async () => savedActivityData((await readSavedGame(page)).activeRun, "battle")?.battleState.turn)
    .toBe(3);
  const after = await battle.playerHealth();
  await page.getByTestId("draw-pile").getByRole("button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await battle.playerHealth()).toBe(after);
  expect(savedActivityData((await readSavedGame(page)).activeRun, "battle")?.battleState.turn).toBe(3);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const acknowledged = savedActivityData((await readSavedGame(page)).activeRun!, "battle")!.battleState;
  await withSavedGame(page, async (resumed) => {
    const restored = new BattlePage(resumed);
    await expect(restored.endTurnBtn).toBeEnabled();
    await expect.poll(() => restored.playerHealth()).toBe(acknowledged.playerHealth);
    await expect.poll(() => restored.enemyHealth()).toBe(acknowledged.enemyHealth);
    await expect(restored.hand).toHaveCount(acknowledged.hand.length);
    expect(savedActivityData((await readSavedGame(resumed)).activeRun, "battle")?.battleState.turn).toBe(3);
    await restored.playFirstCard();
    await expect(restored.hand).toHaveCount(acknowledged.hand.length - 1);
  });
});
