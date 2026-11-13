import { makeDamageCard } from "../../fixtures/cards";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { cardById, enemyById } from "@/lib/game-data";
import { describe, expect, it } from "vitest";
import { makeCombatTexts as makeTexts, patchBattleState } from "../../fixtures/battle";

describe("applyEnemyAbility: reactions", () => {
  it("applies the Fire Imp follow-up to each landed hit", () => {
    const state = patchBattleState({
      currentEnemy: enemyById["fire-imp"],
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
      rng: () => 0.99,
    });
    const result = applyEnemyAbility(state, makeDamageCard("physical", [2, 2]), makeTexts());

    expect(result.playerHealth).toBeLessThan(state.playerHealth - 2);
    expect(result.playerStatuses.burn).toBe(2);
  });

  it.each([1, 10])("settles Banshee Purge retaliation before queued Bleed (Health: %s)", (playerHealth) => {
    const state = patchBattleState({
      playerHealth,
      playerMaxHealth: 30,
      deathsDoorUsed: true,
      playerStatuses: { block: 1, armor: 1 },
      enemyHealth: 20,
      enemyMaxHealth: 20,
      enemyStatuses: { onAttackBleed: 30 },
      currentEnemy: {
        traits: [
          { id: "banshee", title: "Banshee", description: "" },
          { id: "cinder-skin", title: "Cinder Skin", description: "" },
        ],
      },
      gearEffects: { stunOnArmorLostToAttack: 1 },
      rng: () => 0.99,
    });
    const next = applyEnemyAbility(state, makeDamageCard("physical", 1), []);
    expect(next.playerHealth).toBe(playerHealth - 1);
    expect(next.enemyHealth).toBe(playerHealth === 1 ? 19 : 0);
    expect(next.enemyStatuses.onAttackBleed).toBe(playerHealth === 1 ? 30 : 0);
  });

  it.each(["block", "armor", "forge", "haste", "phoenixFeather", "thorns"] as const)(
    "Banshee purges the remaining %s before retaliation",
    (status) => {
      const state = patchBattleState({
        currentEnemy: enemyById.banshee,
        playerStatuses: { [status]: 3 },
        rng: () => 0.99,
      });
      const texts = makeTexts();
      const result = applyEnemyAbility(state, makeDamageCard("physical", 1), texts);
      expect(result.playerStatuses[status]).toBe(0);
      expect(result.enemyHealth).toBe(state.enemyHealth);
      expect(texts.filter((text) => text.kind === "notice" && text.signal === "purge")).toEqual([
        { target: "player", kind: "notice", stat: status, text: "Purged", signal: "purge" },
      ]);
      expect(state.playerStatuses[status]).toBe(3);
    },
  );
});

describe("player Thorns", () => {
  it.each([1, 10])("settles queued Bleed retaliation before Thorns (Health: %s)", (playerHealth) => {
    const state = patchBattleState({
      playerHealth,
      playerMaxHealth: 30,
      deathsDoorUsed: true,
      playerStatuses: { block: 1, thorns: 30 },
      enemyHealth: 20,
      enemyMaxHealth: 20,
      enemyStatuses: { onAttackBleed: 1 },
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      rng: () => 0.99,
    });
    const next = applyEnemyAbility(state, makeDamageCard("physical", 1), []);
    expect(next.playerHealth).toBe(playerHealth - 1);
    expect(next.enemyHealth).toBe(playerHealth === 1 ? 19 : 0);
    expect(next.playerStatuses.thorns).toBe(playerHealth === 1 ? 30 : 0);
  });

  it.each([
    { block: 0, roll: 0.99, health: 25, enemyHealth: 27, thorns: 0 },
    { block: 10, roll: 0.99, health: 30, enemyHealth: 27, thorns: 0 },
    { block: 0, roll: 0.01, health: 30, enemyHealth: 30, thorns: 3 },
  ])(
    "Thorns reacts to contact, including blocked hits: $block/$roll",
    ({ block, roll, health, enemyHealth, thorns }) => {
      const state = patchBattleState({
        playerHealth: 30,
        enemyHealth: 30,
        playerStatuses: { block, thorns: 3 },
        rng: () => roll,
      });
      const result = applyEnemyAbility(state, makeDamageCard("physical", 5), makeTexts());
      expect(result.playerHealth).toBe(health);
      expect(result.enemyHealth).toBe(enemyHealth);
      expect(result.playerStatuses).toMatchObject({ thorns, block: block ? 5 : 0 });
    },
  );

  it("reports Cold Snap Freeze buildup added by doubling, rather than the multiplier", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 100,
      playerMaxHealth: 100,
      playerStatuses: { freeze: 4 },
    });
    const texts = makeTexts();
    const result = applyEnemyAbility(state, cardById["cold-snap"]!, texts);
    expect(result.playerStatuses.freeze).toBe(10);
    expect(texts).toContainEqual({ target: "player", kind: "multiply", stat: "freeze", amount: 5 });
  });
});
