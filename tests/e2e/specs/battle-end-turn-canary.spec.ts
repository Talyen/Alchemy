import { expect, test } from "../../fixtures/e2e";
import { injectActiveBattle, makeCard, makeGoblinBattleState, readSavedGame, seedRandom } from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { critical } from "../../playwright-tags";

test("rapid End Turn advances once, damages the player, and restores the hand", critical, async ({ page }) => {
  test.setTimeout(45_000);
  await seedRandom(page, 42);
  const deck = Array.from({ length: 6 }, () =>
    makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] }),
  );
  const state = makeGoblinBattleState({ hand: deck.slice(0, 4), deck: deck.slice(4) });
  state.currentEnemy = { ...state.currentEnemy, abilityIds: ["slash", "sunder", "burning-blade"] };
  await injectActiveBattle(page, state, { runDeck: deck });
  const battle = new BattlePage(page);
  await battle.playFirstCard();
  await expect(battle.hand).toHaveCount(3);
  const health = await battle.playerHealth();
  await battle.endTurnBtn.click({ clickCount: 3, delay: 20 });
  await expect.poll(() => battle.playerHealth()).toBeLessThan(health);
  await expect(battle.hand).toHaveCount(4);
  await expect(battle.endTurnBtn).toBeEnabled({ timeout: 15_000 });
  await expect.poll(async () => (await readSavedGame(page)).activeRun?.activeCombat?.battleState.turn).toBe(3);
  const after = await battle.playerHealth();
  await page.getByRole("button", { name: "View Deck · 6 cards" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await battle.playerHealth()).toBe(after);
  expect((await readSavedGame(page)).activeRun?.activeCombat?.battleState.turn).toBe(3);
});
