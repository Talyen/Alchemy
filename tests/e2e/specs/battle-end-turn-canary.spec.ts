import { expect, test } from "../../fixtures/e2e";
import { injectActiveBattle, makeCard, makeGoblinBattleState, seedRandom } from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { critical } from "../../playwright-tags";

const WEAK_DECK = Array.from({ length: 6 }, () =>
  makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] }),
);

test.describe("Battle end turn with animations", critical, () => {
  test("end turn round-trip does not hang", async ({ page }) => {
    test.setTimeout(45_000);

    await seedRandom(page, 42);
    const state = makeGoblinBattleState({ hand: WEAK_DECK.slice(0, 4), deck: WEAK_DECK.slice(4) });
    state.currentEnemy = { ...state.currentEnemy, abilityIds: ["slash", "sunder", "burning-blade"] };
    await injectActiveBattle(page, state);
    const battle = new BattlePage(page);

    const healthBefore = await battle.playerHealth();
    await battle.playFirstCard();
    await expect(battle.hand).toHaveCount(3);
    await battle.endTurn();
    await expect.poll(() => battle.playerHealth()).toBeLessThan(healthBefore);
    await expect(battle.hand).toHaveCount(4);
    await expect(battle.endTurnBtn).toBeEnabled({ timeout: 15_000 });
  });
});
