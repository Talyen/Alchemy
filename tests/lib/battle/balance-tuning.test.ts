import { describe, expect, it } from "vitest";
import { cardById, computeTalentEffects } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyArmorStatusEffect } from "@/lib/battle/player-rewards";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { applyLeechHitHealing } from "@/lib/battle/damage-rider-leech";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

function resume(state: ReturnType<typeof patchBattleState>) {
  return { ...PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(state))), rng: () => 0.99 };
}

describe("balance tuning", () => {
  it("Layered survives resume and cannot amplify repeated or reactive Armor grants until the next turn", () => {
    const initial = patchBattleState({ gearEffects: { flatArmorGained: 2 }, rng: () => 0.99 });
    const empty = applyArmorStatusEffect(initial, 0, []);
    expect(empty.flags.layeredArmorUsedThisTurn).toBe(false);
    const first = applyArmorStatusEffect(empty, 1, []);
    expect(first.playerStatuses.armor).toBe(3);
    const second = applyArmorStatusEffect(resume(first), 1, []);
    expect(second.playerStatuses.armor).toBe(4);
    expect(initial.flags.layeredArmorUsedThisTurn).toBe(false);
    const nextTurn = advanceToPlayerTurn(second);
    expect(applyArmorStatusEffect(nextTurn, 1, []).playerStatuses.armor - nextTurn.playerStatuses.armor).toBe(3);
  });

  it("Ironroot and Layered each pay once across repeated Nature effects and resume, then refresh next turn", () => {
    const nature = makeTestCard({
      id: "nature-hit",
      cost: 0,
      effects: [{ kind: "damage", damageType: "nature", amount: 1 }],
    });
    const initial = patchBattleState({
      hand: [nature],
      enemyHealth: 1000,
      enemyMaxHealth: 1000,
      flags: { playNextCardTwice: true },
      gearEffects: { armorOnNatureCard: 2, flatArmorGained: 1 },
      rng: () => 0.99,
    });
    const first = playBattleCardResolved(initial, nature.id, 0).state;
    expect(first.playerStatuses.armor).toBe(3);
    const restored = resume(first);
    const second = playBattleCardResolved({ ...restored, hand: [nature] }, nature.id, 0).state;
    expect(second.playerStatuses.armor).toBe(3);
    const nextTurn = advanceToPlayerTurn(second);
    const third = playBattleCardResolved({ ...nextTurn, hand: [nature] }, nature.id, 0).state;
    expect(third.playerStatuses.armor - nextTurn.playerStatuses.armor).toBe(3);
  });

  it("Deep Siphon improves a one-Health card heal without improving incidental or zero-damage Leech", () => {
    const talentEffects = computeTalentEffects({ leech: ["leech-first-double"] });
    const initial = patchBattleState({ playerHealth: 10, playerMaxHealth: 30, talentEffects, rng: () => 0.99 });
    expect(applyLeechHitHealing(initial, 2, [], true).playerHealth).toBe(12);
    expect(applyLeechHitHealing(initial, 2, [], false).playerHealth).toBe(11);
    expect(applyLeechHitHealing(initial, 0, [], true).playerHealth).toBe(10);
  });

  it("Meteor spends temporary Mana and cannot activate Mana Flare", () => {
    const card = cardById.meteor!;
    const initial = patchBattleState({
      hand: [card],
      mana: 4,
      maxMana: 4,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      talentEffects: computeTalentEffects({ mana: ["mana-flare"] }),
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(initial, card.id, 0).state;
    expect(result.mana).toBe(2);
    expect(result.maxMana).toBe(4);
    expect(result.enemyHealth).toBe(93);
    expect(result.enemyStatuses.burn).toBe(7);
    expect(result.exhausted.map((entry) => entry.id)).toContain("meteor");
  });
});
