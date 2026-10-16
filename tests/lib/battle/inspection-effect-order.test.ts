import { describe, expect, it, vi } from "vitest";
import { getBattleDamageInspectionCard } from "@/lib/battle/card-damage-inspection";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { cardById, type BattleCard } from "@/lib/game-data";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";
import { getTransmutationVariants } from "@/lib/alchemist/transmutation";
import { makeTestCard, patchBattleState, type BattleStatePatch } from "../../fixtures/battle";

function compare(card: BattleCard, patch: BattleStatePatch, effectIndex: number, damage: number) {
  const rng = vi.fn(() => 0.99);
  const state = patchBattleState({
    hand: [card],
    mana: 10,
    maxMana: 10,
    playerHealth: 40,
    playerMaxHealth: 100,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    ...patch,
    rng,
  });
  const before = JSON.stringify({ card, state });
  const preview = getBattleDamageInspectionCard(card, state);
  expect(rng).not.toHaveBeenCalled();
  expect(JSON.stringify({ card, state })).toBe(before);
  const result = playBattleCardResolved(state, card.id, 0);
  const hit = result.combatTexts.find(
    (text) => text.target === "enemy" && text.kind === "damage" && text.stat !== "armor" && text.stat !== "block",
  );
  expect(hit).toMatchObject({ amount: damage });
  expect(preview.effects[effectIndex]).toMatchObject({ kind: "damage", amount: damage });
}

function corruptedWithBurn(id: string): BattleCard {
  return getCorruptionMutationGroups(cardById[id]!)
    .find((group) => group.kind === "secondary")!
    .mutations.find(({ card }) =>
      card.effects.some((effect) => effect.kind === "damage" && effect.damageType === "burn"),
    )!.card;
}

describe("inspection respects effects before damage", () => {
  it("halves Armor before displaying Kingbreaker's Stun damage", () => {
    const card = getTransmutationVariants(cardById["acid-potion"]!, "stun", [])[0]!.result;
    compare(card, { enemyMitigation: { armor: 8 }, gearEffects: { armorIncreasesStun: 1 } }, 1, 6);
  });

  it("removes Armor Siphon's stolen Armor from Kingbreaker's damage source", () => {
    const card = getTransmutationVariants(cardById["venom-fangs"]!, "stun", [])[0]!.result;
    compare(
      card,
      {
        enemyMitigation: { armor: 8 },
        gearEffects: { armorIncreasesStun: 1 },
        talentEffects: { armorStealOnLeechCard: 2 },
      },
      0,
      7,
    );
  });

  it("includes cleanse Block before Cauterize's hit", () => {
    const card = getTransmutationVariants(cardById.cauterize!, "physical", [])[0]!.result;
    compare(
      card,
      {
        playerStatuses: { poison: 2 },
        gearEffects: { blockOnCleanse: 4 },
        talentEffects: { blockToPhysicalDamageMultiplier: 1 },
      },
      1,
      5,
    );
  });

  it("includes Exorcism's cleanse Block before converting Burn to Holy damage", () => {
    compare(
      cardById.exorcism!,
      { gearEffects: { blockOnCleanse: 4 }, talentEffects: { blockHolyDamagePercent: 100 } },
      2,
      5,
    );
  });

  it("includes Gold-gain healing before Golden Plate's corrupted Burn hit", () => {
    const card = corruptedWithBurn("golden-plate");
    compare(
      card,
      {
        playerHealth: 49,
        gearEffects: { healOnCombatGoldGain: 2, sharedBurnBleedBonuses: 1 },
        talentEffects: { bleedDesperateMultiplier: 2 },
      },
      2,
      1,
    );
  });

  it("clamps current Mana after losing a Crystal before Freeze damage", () => {
    const card = makeTestCard({
      cost: 0,
      effects: [
        { kind: "lose-max-mana", amount: 1 },
        { kind: "damage", damageType: "freeze", amount: 1 },
      ],
    });
    compare(card, { mana: 3, maxMana: 3, talentEffects: { freezeDamagePerMana: 100 } }, 1, 3);
  });

  it("includes specific-status cleansing before a corrupted card's hit", () => {
    const card = corruptedWithBurn("smelling-salts");
    compare(
      card,
      {
        mana: 1,
        maxMana: 5,
        playerStatuses: { stun: 2, freeze: 2 },
        gearEffects: { manaOnCleanse: 1 },
        talentEffects: { burnDamagePerMana: 100 },
      },
      2,
      3,
    );
  });

  it("keeps Combustion and Hemorrhage's detonation rules visible", () => {
    for (const [id, status] of [
      ["combustion", "burn"],
      ["hemorrhage", "bleed"],
    ] as const) {
      const card = cardById[id]!;
      const rng = vi.fn(() => 0.99);
      const state = patchBattleState({
        hand: [card],
        rng,
        enemyHealth: 100,
        enemyMaxHealth: 100,
        enemyStatuses: { [status]: 4 },
      });
      const before = JSON.stringify({ card, state });
      const preview = getBattleDamageInspectionCard(card, state);
      expect(rng).not.toHaveBeenCalled();
      expect(JSON.stringify({ card, state })).toBe(before);
      const result = playBattleCardResolved(state, card.id, 0);
      expect(result.state.enemyStatuses[status]).toBe(0);
      expect(result.state.enemyHealth).toBeLessThan(96);
      expect(preview.descriptionLines).toContain(`Detonate all ${status === "burn" ? "Burn" : "Bleed"}`);
    }
  });

  it("includes Overflow's cleanse rewards before Sunburst's damage", () => {
    compare(
      cardById.sunburst!,
      {
        playerHealth: 99,
        mana: 1,
        maxMana: 5,
        playerStatuses: { poison: 2 },
        gearEffects: { manaOnCleanse: 2 },
        talentEffects: { cleanseOnCardOverheal: true, burnDamagePerMana: 100 },
      },
      1,
      3,
    );
  });

  it("includes threshold cleansing before a corrupted card's damage", () => {
    const card = getCorruptionMutationGroups(cardById.slash!).find((group) => group.kind === "bargain")!.mutations[0]!
      .card;
    compare(
      card,
      {
        playerHealth: 26,
        playerStatuses: { poison: 2 },
        gearEffects: { blockOnCleanse: 4 },
        talentEffects: { cleanseBelowHealthPercent: 25, blockToPhysicalDamageMultiplier: 1 },
      },
      1,
      12,
    );
  });
});
