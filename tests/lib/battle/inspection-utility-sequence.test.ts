import { describe, expect, it, vi } from "vitest";
import { getBattleDamageInspectionCard } from "@/lib/battle/card-damage-inspection";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { type BattleCardEffect } from "@/lib/game-data";
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
  const preview = getBattleDamageInspectionCard(card, initial);
  expect(rng).not.toHaveBeenCalled();
  expect(JSON.stringify(initial)).toBe(before);
  const actual = playBattleCardResolved(initial, card.id, 0);
  expect(actual.state.enemyHealth).toBe(100 - healthDamage);
  expect(preview.effects.flatMap((effect) => (effect.kind === "damage" ? [effect.amount] : []))).toEqual(expected);
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
  it.each([false, true])(
    "restores conditional Mana only for Freeze newly applied by this card (existing: %s)",
    (alreadyFrozen) => {
      compare(
        [
          { kind: "damage", damageType: "freeze", amount: 50 },
          { kind: "restore-mana", amount: 2, ifEnemyFrozen: true },
          { kind: "damage", damageType: "burn", amount: 1 },
        ],
        { talentEffects: { burnDamagePerMana: 100 }, enemyCC: { freezeSkipTurns: alreadyFrozen ? 1 : 0 } },
        [50, alreadyFrozen ? 3 : 5],
        // Newly applied Freeze also enables 13 Shatter damage outside the displayed packets.
        alreadyFrozen ? 53 : 68,
      );
    },
  );
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
  it("carries Thunderstone's guaranteed Gold reward into the following hit", () => {
    compare(
      [
        { kind: "damage", damageType: "stun", amount: 50 },
        { kind: "damage", damageType: "physical", amount: 0, equalToGoldPercent: 100 },
      ],
      {
        gold: 0,
        trinketEffects: { thunderstoneDamageOnStun: 2, luckyCloverGoldChance: 100 },
      },
      [50, 2],
      54,
    );
  });
  it("settles Mana Crystal loss damage before the next hit", () => {
    const effects: BattleCardEffect[] = [
      { kind: "lose-max-mana", amount: 1 },
      { kind: "damage", damageType: "physical", amount: 2, doubleIfEnemyBurning: true },
    ];
    const card = makeTestCard({ effects });
    const rng = vi.fn(() => 0.99);
    const initial = patchBattleState({
      rng,
      hand: [card],
      mana: 3,
      maxMana: 4,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      talentEffects: { burnDamageOnManaCrystalLoss: 4 },
    });
    const before = JSON.stringify(initial);
    const preview = getBattleDamageInspectionCard(card, initial);
    expect(rng).not.toHaveBeenCalled();
    expect(JSON.stringify(initial)).toBe(before);
    const actual = playBattleCardResolved(initial, card.id, 0);
    expect(actual.state.enemyStatuses.burn).toBe(4);
    expect(actual.state.enemyHealth).toBe(92);
    expect(preview.effects.at(-1)).toMatchObject({ kind: "damage", amount: 4 });
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
});
