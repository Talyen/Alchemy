import { describe, expect, it, vi } from "vitest";
import { cardById } from "@/lib/game-data";
import { getBattleDamageInspectionCard } from "@/lib/battle/card-damage-inspection";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";
import { patchBattleState } from "../../fixtures/battle";
describe("damage inspection reactions", () => {
  it("includes the Burn inflicted before Phoenix revival", () => {
    const card = cardById.exorcism!;
    const initial = patchBattleState({
      hand: [card],
      rng: () => 0.99,
      playerHealth: 1,
      playerMaxHealth: 40,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      playerStatuses: { phoenixFeather: 1 },
    });
    const preview = getBattleDamageInspectionCard(card, initial);
    const result = playBattleCardResolved(initial, card.id, 0).state;
    expect(result.enemyHealth).toBe(99);
    expect(preview.effects[2]).toMatchObject({ kind: "damage", amount: 1 });
  });
  it("includes Reactive Guard Block from the self-hit breaking Armor", () => {
    const card = cardById.exorcism!;
    const rng = vi.fn(() => 0.99);
    const initial = patchBattleState({
      hand: [card],
      rng,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      playerStatuses: { armor: 1 },
      gearEffects: { flatBlockGained: 2 },
      talentEffects: { armorBreakBlock: 3, blockHolyDamagePercent: 10 },
    });
    const preview = getBattleDamageInspectionCard(card, initial);
    expect(rng).not.toHaveBeenCalled();
    const result = playBattleCardResolved(initial, card.id, 0).state;
    expect(result.enemyHealth).toBe(98);
    expect(preview.effects[2]).toMatchObject({ kind: "damage", amount: 2 });
  });
  it("includes threshold Armor granted by a corrupted card’s Health price", () => {
    const card = getCorruptionMutationGroups(cardById.slash!).find((group) => group.kind === "bargain")!.mutations[0]!
      .card;
    const rng = vi.fn(() => 0.99);
    const initial = patchBattleState({
      hand: [card],
      rng,
      playerHealth: 21,
      playerMaxHealth: 40,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      talentEffects: { healthThresholdArmor: [{ threshold: 50, amount: 3 }], armorPhysicalDamagePercent: 50 },
    });
    const preview = getBattleDamageInspectionCard(card, initial);
    expect(rng).not.toHaveBeenCalled();
    const result = playBattleCardResolved(initial, card.id, 0).state;
    expect(result.enemyHealth).toBe(90);
    expect(preview.effects[1]).toMatchObject({ kind: "damage", amount: 10 });
  });
  it("shows no outgoing damage when a Health price is fatal", () => {
    const card = getCorruptionMutationGroups(cardById.slash!).find((group) => group.kind === "bargain")!.mutations[0]!
      .card;
    const initial = patchBattleState({ hand: [card], rng: () => 0.99, playerHealth: 1, deathsDoorUsed: true });
    const preview = getBattleDamageInspectionCard(card, initial);
    expect(playBattleCardResolved(initial, card.id, 0).state.enemyHealth).toBe(initial.enemyHealth);
    expect(preview.effects[1]).toMatchObject({ kind: "damage", amount: 0 });
  });
  it("shows Opening’s separate Physical hit on a non-Physical card", () => {
    const card = cardById.fireball!;
    const initial = patchBattleState({
      hand: [card],
      rng: () => 0.99,
      flags: { nextHitPhysicalBonus: 4 },
      enemyHealth: 100,
      enemyMaxHealth: 100,
    });
    const preview = getBattleDamageInspectionCard(card, initial);
    expect(playBattleCardResolved(initial, card.id, 0).state.enemyHealth).toBe(94);
    expect(preview.effects).toEqual([
      { kind: "damage", damageType: "burn", amount: 2 },
      { kind: "damage", damageType: "physical", amount: 4 },
    ]);
    expect(initial.flags.nextHitPhysicalBonus).toBe(4);
  });
  it("accounts for Mana-gain healing before a later damage effect checks Health", () => {
    const card = getCorruptionMutationGroups(cardById["mana-crystals"]!)
      .find((group) => group.kind === "secondary")!
      .mutations.find(({ card }) =>
        card.effects.some((effect) => effect.kind === "damage" && effect.damageType === "burn"),
      )!.card;
    const initial = patchBattleState({
      hand: [card],
      rng: () => 0.99,
      playerHealth: 19,
      playerMaxHealth: 40,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      talentEffects: { healthPerMana: 1, bleedDesperateMultiplier: 1.25 },
      gearEffects: { sharedBurnBleedBonuses: 1, flatBurnDamage: 2 },
    });
    const preview = getBattleDamageInspectionCard(card, initial);
    expect(playBattleCardResolved(initial, card.id, 0).state.enemyHealth).toBe(97);
    expect(preview.effects[1]).toMatchObject({ kind: "damage", amount: 3 });
  });
  it("keeps Corruption marks on later effects when Opening inserts a hit", () => {
    const card = getCorruptionMutationGroups(cardById.tithe!)
      .find((group) => group.kind === "strengthen")!
      .mutations.find(({ card }) =>
        card.effects.some((effect) => effect.kind === "gain-gold" && effect.amount > 1),
      )!.card;
    const initial = patchBattleState({ flags: { nextHitPhysicalBonus: 4 } });
    const before = JSON.stringify({ initial, card });
    const preview = getBattleDamageInspectionCard(card, initial);
    expect(preview.corruptedValuePositions?.map((position) => position.lineIndex)).toEqual([2]);
    expect(JSON.stringify({ initial, card })).toBe(before);
  });
});
