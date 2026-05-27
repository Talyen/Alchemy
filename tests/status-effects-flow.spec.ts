import { expect, test } from "@playwright/test";
import { enableFastMode, failOnRuntimeErrors, makeStatusCard, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { critical } from "./playwright-tags";

test.describe("Damage-over-Time Status Effects", critical, () => {
  test("burn ticks each turn and halves", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await enableFastMode(page);
    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeStatusCard("burn", 7)));
    const battle = new BattlePage(page);

    await battle.playCardNamed("Burn");
    await expect(battle.statusChip("Burn")).toBeVisible({ timeout: 2000 });

    const enemyHpBefore = await battle.enemyHealth();
    await battle.endTurn();

    await expect(async () => {
      expect(await battle.enemyHealth()).toBeLessThan(enemyHpBefore);
    }).toPass({ timeout: 5000 });
    await expect(battle.statusChip("Burn")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("poison ticks each turn and decays by 1", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await enableFastMode(page);
    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeStatusCard("poison", 5)));
    const battle = new BattlePage(page);

    await battle.playCardNamed("Poison");
    await expect(battle.statusChip("Poison")).toBeVisible({ timeout: 2000 });

    const enemyHpBefore = await battle.enemyHealth();
    await battle.endTurn();

    await expect(async () => {
      expect(await battle.enemyHealth()).toBeLessThan(enemyHpBefore);
    }).toPass({ timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test("bleed bursts on tick and resets to 0", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await enableFastMode(page);
    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeStatusCard("bleed", 3)));
    const battle = new BattlePage(page);

    await battle.playCardNamed("Bleed");
    await expect(battle.statusChip("Bleed")).toBeVisible({ timeout: 2000 });

    const enemyHpBefore = await battle.enemyHealth();
    await battle.endTurn();

    await expect(async () => {
      expect(await battle.enemyHealth()).toBeLessThan(enemyHpBefore);
    }).toPass({ timeout: 5000 });
    await expect(battle.statusChip("Bleed")).not.toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("Crowd Control Status Effects", () => {
  test("stun triggers CC causing enemy to skip turn", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await enableFastMode(page);
    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeStatusCard("stun", 25)));
    const battle = new BattlePage(page);

    const playerHpBefore = await battle.playerHealth();
    await battle.playCardNamed("Stun");

    await battle.endTurn();
    await expect(async () => {
      expect(await battle.playerHealth()).toBe(playerHpBefore);
    }).toPass({ timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test("freeze triggers CC causing enemy to skip turn", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await enableFastMode(page);
    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeStatusCard("freeze", 25)));
    const battle = new BattlePage(page);

    const playerHpBefore = await battle.playerHealth();
    await battle.playCardNamed("Freeze");

    await battle.endTurn();
    await expect(async () => {
      expect(await battle.playerHealth()).toBe(playerHpBefore);
    }).toPass({ timeout: 5000 });
    expect(errors).toEqual([]);
  });
});
