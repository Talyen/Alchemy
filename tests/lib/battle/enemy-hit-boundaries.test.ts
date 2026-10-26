import { describe, expect, it } from "vitest";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { processEnemyTraits } from "@/lib/battle/enemy-turn-traits";
import { cardById, enemyById } from "@/lib/game-data";
import { makeTestCard, regressionBattle } from "../../fixtures/battle";

describe("enemy hit boundaries", () => {
  it("keeps an ability's own Leech when Soul Harvest chooses Purge", () => {
    const state = regressionBattle({
      currentEnemy: enemyById.necromancer,
      enemyHealth: 40,
      enemyMaxHealth: 100,
      playerHealth: 100,
      playerMaxHealth: 100,
      playerStatuses: { forge: 1 },
      // Soul Harvest chooses Purge; the later Dodge roll fails.
      rng: (() => {
        let calls = 0;
        return () => (calls++ === 0 ? 0 : 0.99);
      })(),
    });
    const next = applyEnemyAbility(state, cardById.fangs!, []);
    expect(next.playerStatuses.forge).toBe(0);
    expect(next.enemyHealth).toBeGreaterThan(state.enemyHealth);
    expect(next.pendingEnemyBleedLeechHealing).toBeGreaterThan(0);
  });

  it("does not pay Self-Sacrifice for a Dodged hit, but pays for a Blocked hit", () => {
    const state = regressionBattle({
      currentEnemy: enemyById.zealot,
      enemyHealth: 10,
      enemyMaxHealth: 10,
      flags: { dodgeNextAttack: true },
    });
    const dodged = applyEnemyAbility(state, cardById.slash!, []);
    expect(dodged.playerDodgeCount).toBe(state.playerDodgeCount + 1);
    expect(dodged.enemyHealth).toBe(10);
    const blocked = applyEnemyAbility(
      {
        ...state,
        flags: { ...state.flags, dodgeNextAttack: false },
        playerStatuses: { ...state.playerStatuses, block: 100 },
      },
      cardById.slash!,
      [],
    );
    expect(blocked.enemyHealth).toBe(9);
  });

  it("does not apply Sundered Guard again to Winter's Bite bonus damage", () => {
    const state = regressionBattle({
      currentEnemy: {
        ...enemyById["winter-wolf"]!,
        traits: [
          ...enemyById["winter-wolf"]!.traits,
          { id: "sundered-guard", title: "Sundered Guard", description: "" },
        ],
      },
      playerStatuses: { block: 20 },
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });
    const withoutBite = applyEnemyAbility(
      {
        ...state,
        currentEnemy: {
          ...state.currentEnemy,
          traits: state.currentEnemy.traits.filter((trait) => trait.id !== "winter-wolf"),
        },
      },
      card,
      [],
    );
    const next = applyEnemyAbility(state, card, []);
    expect(next.playerStatuses.block).toBe(withoutBite.playerStatuses.block - 1);
  });

  it("does not apply Unbinding Strike to periodic Crimson Pulse damage", () => {
    const state = regressionBattle({
      turn: 2,
      currentEnemy: {
        ...enemyById["blood-countess"]!,
        traits: [
          ...enemyById["blood-countess"]!.traits,
          { id: "unbinding-strike", title: "Unbinding Strike", description: "" },
        ],
      },
      playerStatuses: { forge: 2 },
    });
    const next = processEnemyTraits(state, []);
    expect(next.playerHealth).toBeLessThan(state.playerHealth);
    expect(next.playerStatuses.forge).toBe(2);
    const attacked = applyEnemyAbility(state, cardById.slash!, []);
    expect(attacked.playerStatuses.forge).toBe(0);
  });
});
