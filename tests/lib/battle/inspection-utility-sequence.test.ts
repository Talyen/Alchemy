import { describe, expect, it, vi } from "vitest";
import { inspectedAttackAmounts } from "../../fixtures/inspection";
import { getBattleCardDescriptionInspection } from "@/lib/battle/card-damage-inspection";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";
import { cardById, type BattleCardEffect } from "@/lib/game-data";
import { makeTestCard, patchBattleState, type BattleStatePatch } from "../../fixtures/battle";

function compare(
  effects: BattleCardEffect[],
  patch: BattleStatePatch,
  expected: number[],
  healthDamage = expected.reduce((total, amount) => total + amount, 0),
) {
  const card = makeTestCard({ effects });
  const rng = vi.fn(() => 0.99);
  const initial = patchBattleState({
    hand: [card],
    mana: 3,
    maxMana: 10,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    ...patch,
    rng,
  });
  const before = JSON.stringify(initial);
  const projected = inspectedAttackAmounts(card, initial);
  expect(rng).not.toHaveBeenCalled();
  expect(JSON.stringify(initial)).toBe(before);
  const actual = playBattleCardResolved(initial, card.id, 0);
  expect(actual.state.enemyHealth).toBe(100 - healthDamage);
  expect(projected).toEqual(expected);
}

describe("damage inspection follows utility effect execution", () => {
  it.each([0, 1])("carries the certain Chance branch at probability %s into the following hit", (probability) => {
    compare(
      [
        {
          kind: "chance",
          probability,
          successEffects:
            probability === 1 ? [{ kind: "restore-mana", amount: 2 }] : [{ kind: "lose-mana", amount: 9 }],
          failureEffects:
            probability === 0 ? [{ kind: "restore-mana", amount: 2 }] : [{ kind: "lose-mana", amount: 9 }],
        },
        { kind: "damage", damageType: "burn", amount: 1 },
      ],
      { talentEffects: { burnDamagePerMana: 100 } },
      [5],
    );
  });

  it("arms Leech before projecting healing and later low-Health damage", () => {
    compare(
      [
        { kind: "next-hit-leech" },
        { kind: "damage", damageType: "physical", amount: 2 },
        { kind: "damage", damageType: "physical", amount: 2 },
      ],
      { playerHealth: 19, playerMaxHealth: 40, talentEffects: { physicalDoubledBelowHalfHealth: true } },
      [4, 2],
    );
  });

  it("carries Thunderstone's guaranteed Mana refund into the following hit", () => {
    compare(
      [
        { kind: "damage", damageType: "stun", amount: 50 },
        { kind: "damage", damageType: "burn", amount: 1 },
      ],
      {
        trinketEffects: { thunderstoneDamageOnStun: 2 },
        gearEffects: { manaOnNatureDamageChance: 100 },
        talentEffects: { burnDamagePerMana: 100 },
      },
      [50, 4],
      56,
    );
  });

  it("settles Mana Crystal loss damage before the next hit", () => {
    compare(
      [
        { kind: "lose-max-mana", amount: 1 },
        { kind: "damage", damageType: "physical", amount: 2, tripleIfEnemyNotBurning: true },
      ],
      { maxMana: 4, talentEffects: { burnDamageOnManaCrystalLoss: 4 } },
      [2],
      6,
    );
  });

  it.each([false, true])("uses the summoned Companion for later actions and Eager Pack (enabled: %s)", (eagerPack) => {
    compare(
      [
        { kind: "summon-companion", companionId: "mana-moth" },
        { kind: "companion-action", amount: 1 },
        { kind: "damage", damageType: "burn", amount: 1 },
      ],
      { talentEffects: { burnDamagePerMana: 100 }, encounterBenefits: eagerPack ? ["eager-pack"] : [] },
      [eagerPack ? 6 : 4],
    );
  });

  it("projects Wish rewards, Sunder Armor removal, and self-damage thresholds before later attacks", () => {
    compare(
      [
        { kind: "wish", amount: 1 },
        { kind: "remove-enemy-armor", halve: true },
        { kind: "damage", damageType: "stun", amount: 2, ignoreArmor: true },
      ],
      {
        enemyMitigation: { armor: 8 },
        gearEffects: { armorIncreasesStun: 1, manaOnWish: 2 },
      },
      [6],
    );
    // Sunder strips half of Forge as enemy Armor once per card after a Physical hit.
    compare(
      [
        { kind: "damage", damageType: "physical", amount: 2 },
        { kind: "damage", damageType: "physical", amount: 2 },
        { kind: "damage", damageType: "stun", amount: 2, ignoreArmor: true },
      ],
      {
        playerStatuses: { forge: 4 },
        enemyMitigation: { armor: 5 },
        talentEffects: { physicalStripArmorByForge: true },
        gearEffects: { armorIncreasesStun: 1 },
      },
      [6, 6, 7],
      12,
    );
    compare(
      [
        { kind: "lose-health", amount: 2 },
        { kind: "damage", damageType: "physical", amount: 6 },
      ],
      {
        playerHealth: 21,
        playerMaxHealth: 40,
        talentEffects: { healthThresholdArmor: [{ threshold: 50, amount: 3 }], armorPhysicalDamagePercent: 50 },
      },
      [8],
    );
  });

  it("projects Exorcism self-damage reactions, fatal Health bargains, and Corruption marks", () => {
    const exorcism = cardById.exorcism!;
    const phoenixState = patchBattleState({
      hand: [exorcism],
      rng: () => 0.99,
      playerHealth: 1,
      playerMaxHealth: 40,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      playerStatuses: { phoenixFeather: 1 },
    });
    expect(playBattleCardResolved(phoenixState, exorcism.id, 0).state.enemyHealth).toBe(99);
    expect(inspectedAttackAmounts(exorcism, phoenixState)[0]).toBe(1);

    const guardState = patchBattleState({
      hand: [exorcism],
      rng: () => 0.99,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      playerStatuses: { armor: 1 },
      gearEffects: { flatBlockGained: 2 },
      talentEffects: { armorBreakBlock: 3, blockHolyDamagePercent: 10 },
    });
    expect(playBattleCardResolved(guardState, exorcism.id, 0).state.enemyHealth).toBe(98);
    expect(inspectedAttackAmounts(exorcism, guardState)[0]).toBe(2);

    const bargainSlash = getCorruptionMutationGroups(cardById.slash!).find((group) => group.kind === "bargain")!
      .mutations[0]!.card;
    const fatalState = patchBattleState({
      hand: [bargainSlash],
      rng: () => 0.99,
      playerHealth: 1,
      deathsDoorUsed: true,
    });
    expect(playBattleCardResolved(fatalState, bargainSlash.id, 0).state.enemyHealth).toBe(fatalState.enemyHealth);
    expect(inspectedAttackAmounts(bargainSlash, fatalState)[0]).toBe(0);

    const strengthenedTithe = getCorruptionMutationGroups(cardById.tithe!)
      .find((group) => group.kind === "strengthen")!
      .mutations.find(({ card }) =>
        card.effects.some((effect) => effect.kind === "gain-gold" && effect.amount > 1),
      )!.card;
    const tithePreview = getBattleCardDescriptionInspection(
      strengthenedTithe,
      patchBattleState({ flags: { nextHitPhysicalBonus: 4 } }),
    );
    expect(tithePreview.description!.flatMap((line) => line.parts)).toContainEqual(
      expect.objectContaining({
        corrupted: true,
        references: expect.arrayContaining([expect.objectContaining({ kind: "gain-gold" })]),
      }),
    );
  });
});
