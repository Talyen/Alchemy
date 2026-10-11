import { describe, expect, it } from "vitest";
import { createBattleState, getEffectiveDamageScore, type BattleSnapshot } from "@/lib/battle";
import { cardById, cloneBattleCard, enemyById } from "@/lib/game-data";
import { createCombatProgress, scoreCombatCards } from "@/app/playthrough/combat-policy";

const shield = cloneBattleCard(cardById["mana-shield"]!);
const attack = cloneBattleCard(cardById["caustic-jab"]!);
function snapshot(health = 23): BattleSnapshot {
  return {
    ...createBattleState({
      runDeck: [shield, attack],
      currentEnemy: enemyById.seraph!,
      playerHealth: health,
      maxHealth: 86,
      totalRooms: 24,
      rng: () => 0.5,
    }),
    hand: [shield, attack],
    deck: [],
    discard: [],
    mana: 7,
    maxMana: 7,
    turn: 101,
    enemyHealth: 1242,
    enemyMaxHealth: 1242,
  };
}

describe("simulation combat policy", () => {
  it("breaks the captured Mana Shield preference after two defensive turns while preserving live scoring", () => {
    const state = snapshot();
    expect(getEffectiveDamageScore(shield, state)).toBeGreaterThan(getEffectiveDamageScore(attack, state));
    const emergency = scoreCombatCards([shield, attack], state, "greedy-effective-damage", 0);
    expect(emergency[0]).toBeGreaterThan(emergency[1]!);
    const progressed = scoreCombatCards([shield, attack], state, "greedy-effective-damage", 2);
    expect(progressed[1]).toBeGreaterThan(progressed[0]!);
    expect(scoreCombatCards([shield, attack], state, "greedy-effective-damage")).toEqual(emergency);
  });

  it.each(["greedy-effective-damage", "defensive-random"] as const)(
    "%s reserves an attack at healthy Health and preserves initial emergency defense",
    (policy) => {
      const healthy = scoreCombatCards([shield, attack], snapshot(86), policy, 0);
      expect(healthy[1]).toBeGreaterThan(healthy[0]!);
      const emergency = scoreCombatCards([shield, attack], snapshot(1), policy, 0);
      expect(emergency[0]).toBeGreaterThan(emergency[1]!);
      const stalled = scoreCombatCards([shield, attack], snapshot(1), policy, 2);
      expect(stalled[1]).toBeGreaterThan(stalled[0]!);
    },
  );

  it("retains defense with spare Mana or no attack, and leaves random play unchanged", () => {
    const block = cloneBattleCard(cardById.block!);
    const state = snapshot(86);
    const spare = scoreCombatCards([block, attack], state, "greedy-effective-damage", 0);
    expect(spare[0]).toBe(getEffectiveDamageScore(block, state));
    const lastMana = scoreCombatCards([block, attack], { ...state, mana: 1 }, "greedy-effective-damage", 0);
    expect(lastMana[1]).toBeGreaterThan(lastMana[0]!);
    expect(scoreCombatCards([shield], state, "greedy-effective-damage", 20)).toEqual([
      getEffectiveDamageScore(shield, state),
    ]);
    expect(scoreCombatCards([shield, attack], state, "random-playable", 20)).toEqual([1, 1]);
  });

  it("tracks committed defensive turns, resets on attack or damage-over-time progress, and resets between battles", () => {
    const progress = createCombatProgress();
    const state = snapshot();
    const end = { kind: "end-turn", id: "turn", score: 0 };
    for (let turn = 0; turn < 2; turn++) {
      progress.committed(state, state, { kind: "play", id: shield.id, score: 10.5, index: 0 });
      progress.committed(state, state, end);
    }
    expect(progress.defenseOnlyTurns()).toBe(2);
    expect(progress.defenseOnlyTurns()).toBe(2);
    progress.committed(state, state, { kind: "play", id: attack.id, score: 2, index: 1 });
    progress.committed(state, state, end);
    expect(progress.defenseOnlyTurns()).toBe(0);
    progress.committed(state, state, end);
    progress.committed(state, { ...state, enemyHealth: state.enemyHealth - 1 }, end);
    expect(progress.defenseOnlyTurns()).toBe(0);
    progress.committed(state, state, end);
    progress.committed(state, state, { kind: "settle", id: "victory", score: 1 });
    expect(progress.defenseOnlyTurns()).toBe(0);
  });
});
