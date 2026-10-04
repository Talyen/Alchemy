import { describe, expect, it } from "vitest";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { patchBattleState } from "../../fixtures/battle";

describe("Block protections on Sundered Guard attacks", () => {
  it("keeps Grounding for the Stun hit that strips the last Block", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerStatuses: { block: 2 },
      talentEffects: { blockPreventsStun: true },
      currentEnemy: { traits: [{ id: "sundered-guard", title: "Sundered Guard", description: "" }] },
    });
    const result = resolveEnemyAttackHit(state, { kind: "damage", damageType: "stun", amount: 4 }, [], {
      canDodge: true,
    });
    expect(result.state.playerStatuses.block).toBe(0);
    expect(result.state.playerStatuses.stun).toBe(0);
    expect(state.playerStatuses.block).toBe(2);
  });
  it.each(["poison", "bleed"] as const)("keeps %s resistance for the hit that removes the last Block", (damageType) => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { block: 2 },
      talentEffects: { blockHalvesPoisonDamage: true, blockHalvesBleedDamage: true },
      currentEnemy: { traits: [{ id: "sundered-guard", title: "Sundered Guard", description: "" }] },
    });
    const result = resolveEnemyAttackHit(state, { kind: "damage", damageType, amount: 4 }, [], { canDodge: true });
    expect(result.state.playerStatuses.block).toBe(0);
    expect(result.state.playerHealth).toBe(28);
  });
});
