import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors, makeCard, seedRandom, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { critical } from "./playwright-tags";

const WEAK_DECK = Array.from({ length: 6 }, () =>
  makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] }),
);

test.describe("Battle end turn with animations", critical, () => {
  test("end turn round-trip does not hang", async ({ page }) => {
    test.setTimeout(45_000);
    const errors = failOnRuntimeErrors(page);
    await seedRandom(page, 42);
    await startBattleWithDeck(page, WEAK_DECK);
    const battle = new BattlePage(page);

    await battle.playFirstCard();
    await battle.endTurn();
    await expect(battle.endTurnBtn).toBeEnabled({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});
