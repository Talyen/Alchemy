import { describe, expect, it, vi } from "vitest";
import { computeHomesteadEffects, mergeIntoManifest } from "@/lib/homestead/effects";
import { buildings } from "@/lib/homestead/data";
import { createEmptyTalentEffectManifest, createEffectDescription, withCardDescription } from "@/lib/game-data";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { getBattleCardDescriptionInspection } from "@/lib/battle/card-damage-inspection";
import { dealDamage, makeCombatTexts, makeEffect, makeTestCard, patchBattleState } from "../../fixtures/battle";

const manifest = (tier: number) =>
  mergeIntoManifest(createEmptyTalentEffectManifest(), computeHomesteadEffects({ "sparring-grounds": tier }, {}, {}));

describe("Sparring Grounds Physical critical damage", () => {
  it.each([1, 2, 3, 4])("tier %i grants the total percentage, retains Iron and changes one critical packet", (tier) => {
    const homestead = computeHomesteadEffects({ "sparring-grounds": tier }, {}, {});
    expect(homestead.homesteadPhysicalCritDamagePercent).toBe(10 * tier);
    expect(homestead.ironFindBonus).toBeCloseTo(0.1 * tier);
    expect(homestead.startBlock).toBe(0);
    expect(buildings.find((b) => b.id === "sparring-grounds")!.tiers[tier - 1]!.benefitDescription).toBe(
      `Physical Critical Hits deal ${10 * tier}% more damage`,
    );
    const effect = makeEffect("physical", 5);
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyMitigation: { block: 0, armor: 0 },
      flags: { nextPhysicalCrit: true },
      talentEffects: manifest(tier),
      rng: () => 0.99,
    });
    const events = makeCombatTexts();
    const result = dealDamage(state, makeTestCard({ effects: [effect] }), events);
    const damage = 10 + tier;
    expect(result.enemyHealth).toBe(100 - damage);
    expect(events).toEqual([
      expect.objectContaining({ target: "enemy", kind: "damage", stat: "physical", amount: damage, critical: true }),
    ]);
    expect(state.enemyHealth).toBe(100);
  });

  it("uses the ordinary critical roll and rounds once before enemy Block and Armor", () => {
    const rng = vi.fn(() => 0);
    const state = patchBattleState({
      talentEffects: manifest(1),
      enemyMitigation: { block: 2, armor: 1 },
      rng,
    });
    // 3 × 2 × 1.1 = 6.6, rounded to7, then2Block and1Armor:4Health damage.
    const result = computeCardDamageToEnemy(state, makeEffect("physical", 3));
    expect(result).toMatchObject({ modifiedDamage: 4, critical: true });
    expect(result.nextState.enemyMitigation.block).toBe(0);
    expect(rng).toHaveBeenCalledTimes(1);
  });

  it("does not increase noncritical Physical hits or critical hits of another damage type", () => {
    const state = patchBattleState({ talentEffects: manifest(4), rng: () => 0.99 });
    expect(computeCardDamageToEnemy(state, makeEffect("physical", 3)).modifiedDamage).toBe(3);
    for (const type of ["stun", "burn", "holy", "bleed"] as const) {
      expect(
        computeCardDamageToEnemy(state, makeEffect(type, 3), undefined, { manaAtStart: 3, guaranteedCrit: true }),
      ).toMatchObject({ modifiedDamage: 6, critical: true });
    }
  });

  it("retains noncritical preview numbers without consuming RNG or a prepared critical", () => {
    const effect = makeEffect("physical", 3);
    const card = withCardDescription(makeTestCard({ effects: [effect] }), createEffectDescription([effect]));
    const rng = vi.fn(() => {
      throw new Error("Preview consumed live RNG");
    });
    const state = patchBattleState({ talentEffects: manifest(4), flags: { nextPhysicalCrit: true }, rng });
    const before = JSON.stringify(state);
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual(["Deal 3 Physical damage"]);
    expect(JSON.stringify(state)).toBe(before);
    expect(rng).not.toHaveBeenCalled();
    expect(computeCardDamageToEnemy(state, effect).modifiedDamage).toBe(8);
  });
});
