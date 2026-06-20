import { expect } from "@playwright/test";
import { injectTalentUnlocks, makeCard, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";

test.describe("Talents in Battle", () => {
  test("block-start talent gives starting block in combat", async ({ page, fastBattle }) => {
    void fastBattle;

    await injectTalentUnlocks(page, { block: ["block-start"] });
    const SLASH = makeCard();
    await startBattleWithDeck(
      page,
      Array.from({ length: 8 }, () => SLASH),
    );

    await expect(page.getByRole("button", { name: "Block 5" })).toBeVisible({ timeout: 3000 });
  });

  test("physical-brute-force talent increases physical damage dealt", async ({ page, fastBattle }) => {
    void fastBattle;

    await injectTalentUnlocks(page, { physical: ["physical-brute-force"] });
    const SLASH = makeCard();
    await startBattleWithDeck(
      page,
      Array.from({ length: 8 }, () => SLASH),
    );
    const battle = new BattlePage(page);

    await battle.playCardNamed("Slash");
    const enemyHpAfter = await battle.enemyHealth();
    expect(enemyHpAfter).toBeLessThan(30 - 6);
  });
});
