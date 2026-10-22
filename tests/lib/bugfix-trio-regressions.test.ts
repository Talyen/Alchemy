import { describe, expect, it } from "vitest";
import { SaveDataSchema, isCombatGoldOverride } from "@/lib/validation";
import { defaultBattleState } from "@/lib/battle";
import { makeMinimalActiveRunInput } from "../fixtures/active-run";
import { savedActivityFixture } from "../fixtures/run-activity";
import { scoreAvailableReactions } from "@/lib/battle/reaction-score";
import { patchBattleState, makeTestCard } from "../fixtures/battle";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";

describe("bugfix trio regressions", () => {
  it("rounds fractional live-combat gold instead of flooring it", () => {
    expect(isCombatGoldOverride(10.9, 11)).toBe(true);
    expect(isCombatGoldOverride(10.9, 10)).toBe(false);
    const result = SaveDataSchema.safeParse({
      gold: 0,
      activeRun: makeMinimalActiveRunInput({
        activity: savedActivityFixture("battle", { battleState: { ...defaultBattleState(), gold: 10.9 } }),
      }),
    });
    expect(result.success, JSON.stringify(result.success ? "" : result.error?.issues)).toBe(true);
    if (result.success) expect(result.data.gold).toBe(11);
  });

  it("averages reaction payoffs across integer random hits before lethal cutoffs", () => {
    const base = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      playerHealth: 100,
      playerMaxHealth: 100,
      appliesFightPacing: false,
      encounterBenefits: ["wildheart"],
      currentEnemy: { abilityIds: ["slash", "stab"] },
      deck: Array.from({ length: 8 }, (_, i) =>
        makeTestCard({ id: `deck-${i}`, effects: [{ kind: "player-status", status: "block", amount: 1 }] }),
      ),
      enemyStatuses: { burn: 8 },
    });
    const state = { ...endPlayerTurn(endPlayerTurn(base).state).state, enemyHealth: 6 };
    const random = makeTestCard({
      effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 4, damageTypePool: ["nature", "holy"] }],
    });
    const expected = [1, 2, 3, 4].reduce(
      (sum, amount) =>
        sum +
        (["nature", "holy"] as const).reduce(
          (subtotal, damageType) =>
            subtotal +
            scoreAvailableReactions(
              makeTestCard({
                effects: [{ kind: "damage", damageType, amount }],
              }),
              state,
            ),
          0,
        ) /
          8,
      0,
    );
    expect(expected).toBe(0.625);
    expect(scoreAvailableReactions(random, state)).toBe(expected);
  });

  it("clears detonated Bleed before a conditional follow-up and reaction finisher", () => {
    const state = patchBattleState({
      enemyHealth: 20,
      enemyMaxHealth: 20,
      enemyStatuses: { bleed: 10, burn: 1 },
      reactions: { wildfireDamage: 3 },
    });
    const card = makeTestCard({
      effects: [
        { kind: "damage", damageType: "bleed", amount: 2, detonateAllBleed: true },
        { kind: "damage", damageType: "physical", amount: 4, doubleIfEnemyBleeding: true },
        { kind: "damage", damageType: "nature", amount: 1 },
      ],
    });
    // 2 direct + 12 detonation + 4 Physical + 1 Nature leaves 1 for Wildfire.
    expect(scoreAvailableReactions(card, state)).toBe(1);
  });

  it("carries fresh Bleed into a conditional lethal hit before a reaction finisher", () => {
    const state = patchBattleState({
      enemyHealth: 13,
      enemyMaxHealth: 13,
      enemyStatuses: { burn: 1 },
      reactions: { wildfireDamage: 3 },
    });
    const card = makeTestCard({
      effects: [
        { kind: "damage", damageType: "bleed", amount: 4 },
        { kind: "damage", damageType: "physical", amount: 5, doubleIfEnemyBleeding: true },
        { kind: "damage", damageType: "nature", amount: 1 },
      ],
    });
    expect(scoreAvailableReactions(card, state)).toBe(0);
  });

  it("deducts DoT detonation damage from enemy health so lethal detonations stop subsequent hits", () => {
    const state = patchBattleState({
      enemyHealth: 10,
      enemyMaxHealth: 10,
      enemyStatuses: { burn: 20 },
      reactions: { wildfireDamage: 10 },
    });
    const lethalCombustion = makeTestCard({
      effects: [
        { kind: "damage", damageType: "burn", amount: 1, detonateAllBurn: true },
        { kind: "damage", damageType: "nature", amount: 2 },
      ],
    });
    // Hit 1 deals 1 damage + detonates 20 Burn, killing the 10-HP enemy.
    // Hit 2 (Nature, which would otherwise trigger Wildfire) does not land on a defeated enemy.
    expect(scoreAvailableReactions(lethalCombustion, state)).toBe(0);
  });

  it("distinguishes player statuses in projection keys so chance branches do not drop cleansed states", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { burn: 10 },
      playerStatuses: { burn: 5 },
      reactions: { wildfireDamage: 10 },
    });
    const multiBranch = makeTestCard({
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy" }],
          failureEffects: [{ kind: "damage", damageType: "holy", amount: 5 }],
        },
        {
          kind: "cleanse-player-status-to-damage",
          status: "burn",
          damageType: "nature",
        },
      ],
    });
    // Success branch cleanses Burn on hit 1 so hit 2 does not trigger Wildfire.
    // Failure branch keeps Burn on hit 1, so hit 2 cleanses Burn as Nature, triggering Wildfire (10 damage).
    // Distinct playerStatuses prevent false merging, yielding 0.5 * 10 = 5.
    expect(scoreAvailableReactions(multiBranch, state)).toBe(5);
  });

  it("projects remove-enemy-armor before physical hits and Shatter scoring", () => {
    const state = patchBattleState({
      enemyHealth: 20,
      enemyMaxHealth: 20,
      enemyMitigation: { armor: 10, block: 0, forge: 0 },
      enemyCC: { freezeSkipTurns: 1, stunSkipTurns: 0 },
      reactions: { shatterDamage: 5 },
    });
    const sunder = makeTestCard({
      effects: [
        { kind: "remove-enemy-armor", halve: true },
        { kind: "damage", damageType: "physical", amount: 3 },
      ],
    });
    // Armor halves from 10 to 5.
    // Physical hit 3 triggers Shatter on the 5 remaining armor.
    // Shatter scores remaining armor (5) + shatter damage (5) = 10, not 10 + 5 = 15.
    expect(scoreAvailableReactions(sunder, state)).toBe(10);
  });

  it("projects multiply-enemy-status before DoT detonation reactions", () => {
    const state = patchBattleState({
      enemyHealth: 14,
      enemyMaxHealth: 14,
      enemyStatuses: { burn: 2, bleed: 5 },
      reactions: { wildfireDamage: 3 },
    });
    const multiplyAndDetonate = makeTestCard({
      effects: [
        { kind: "multiply-enemy-status", status: "bleed", factor: 2 },
        { kind: "damage", damageType: "bleed", amount: 1, detonateAllBleed: true },
        { kind: "damage", damageType: "nature", amount: 1 },
      ],
    });
    // Doubling Bleed leaves two HP after detonation, so Wildfire can only score one.
    expect(scoreAvailableReactions(multiplyAndDetonate, state)).toBe(1);
  });

  it("clears player statuses when projecting remove-harmful-status", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      playerStatuses: { burn: 5 },
      reactions: { wildfireDamage: 10 },
    });
    const cleanseThenAttack = makeTestCard({
      effects: [
        { kind: "remove-harmful-status", removeAll: true },
        { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "nature" },
      ],
    });
    // First effect cleanses player burn to 0.
    // Second effect sees 0 burn, so deals 0 damage and triggers no Wildfire reaction.
    expect(scoreAvailableReactions(cleanseThenAttack, state)).toBe(0);
  });

  it("projects player-status block before equal-to-block attacks to trigger Shatter", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerStatuses: { block: 0 },
      enemyMitigation: { armor: 10, block: 0, forge: 0 },
      enemyCC: { freezeSkipTurns: 1, stunSkipTurns: 0 },
      reactions: { shatterDamage: 5 },
    });
    const blockThenBash = makeTestCard({
      effects: [
        { kind: "player-status", status: "block", amount: 10 },
        { kind: "damage", damageType: "physical", amount: 0, equalToBlock: true },
      ],
    });
    // First effect grants 10 Block to player.
    // Second effect deals 10 Physical damage (equal to 10 Block).
    // Enemy is frozen with 10 Armor and Shatter: Shatter triggers, scoring 10 (armor) + 5 (shatterDamage) = 15.
    expect(scoreAvailableReactions(blockThenBash, state)).toBe(15);
  });

  it("projects next-hit-poison so subsequent attacks convert to poison and trigger reactions", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { burn: 0, poison: 0 },
    });
    const poisonThenBurn = makeTestCard({
      effects: [
        { kind: "next-hit-poison" },
        { kind: "damage", damageType: "physical", amount: 3 },
        { kind: "damage", damageType: "burn", amount: 2 },
      ],
    });
    // First effect sets nextHitPoison.
    // Second effect converts physical to 3 poison damage, adding 3 poison stacks to the enemy.
    // Third effect deals 2 burn damage against the now-poisoned enemy, triggering Venomflash (1 bonus damage).
    expect(scoreAvailableReactions(poisonThenBurn, state)).toBe(1);
  });

  it("keeps equal-status branches with different mana distinct before mana-scaled attacks", () => {
    const state = patchBattleState({
      mana: 4,
      maxMana: 4,
      enemyHealth: 5,
      enemyMaxHealth: 5,
      enemyCC: { freezeSkipTurns: 1, stunSkipTurns: 0 },
      reactions: { frostfireDamage: 10 },
      talentEffects: { burnDamagePerMana: 100 },
    });
    const card = makeTestCard({
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "lose-mana", amount: 4 }],
          failureEffects: [],
        },
        { kind: "damage", damageType: "burn", amount: 1 },
      ],
    });
    expect(scoreAvailableReactions(card, state)).toBe(2);
  });

  it("converts the action's starting mana even after restoration or an earlier conversion", () => {
    const state = patchBattleState({
      mana: 1,
      maxMana: 5,
      enemyHealth: 6,
      enemyMaxHealth: 6,
      enemyMitigation: { armor: 10, block: 0, forge: 0 },
      enemyCC: { freezeSkipTurns: 1, stunSkipTurns: 0 },
      reactions: { shatterDamage: 5 },
    });
    const card = makeTestCard({
      effects: [
        { kind: "restore-mana", amount: 3 },
        { kind: "player-status", status: "block", amount: 0, convertCurrentMana: 1 },
        { kind: "player-status", status: "block", amount: 0, convertCurrentMana: 1 },
        { kind: "damage", damageType: "physical", amount: 0, equalToBlock: true },
      ],
    });
    expect(scoreAvailableReactions(card, state)).toBe(14);
  });

  it("preserves existing mana overflow when projecting capped restoration", () => {
    const state = patchBattleState({
      mana: 6,
      maxMana: 3,
      enemyHealth: 8,
      enemyMaxHealth: 8,
      enemyCC: { freezeSkipTurns: 1, stunSkipTurns: 0 },
      reactions: { frostfireDamage: 10 },
      talentEffects: { burnDamagePerMana: 100 },
    });
    const card = makeTestCard({
      effects: [
        { kind: "restore-mana", amount: 1 },
        { kind: "damage", damageType: "burn", amount: 1 },
      ],
    });
    expect(scoreAvailableReactions(card, state)).toBe(1);
  });

  it("includes Forge and gear Block bonuses before scoring a Shield Slam", () => {
    const state = patchBattleState({
      enemyHealth: 20,
      enemyMaxHealth: 20,
      playerStatuses: { forge: 4 },
      gearEffects: { flatBlockGained: 2 },
      talentEffects: { forgeBlockPercent: 100 },
      enemyCC: { freezeSkipTurns: 1, stunSkipTurns: 0 },
      reactions: { shatterDamage: 20 },
    });
    const card = makeTestCard({
      effects: [
        { kind: "player-status", status: "block", amount: 1 },
        { kind: "damage", damageType: "physical", amount: 0, equalToBlock: true },
      ],
    });
    // Seven Block plus four Forge damage leaves nine HP for Shatter.
    expect(scoreAvailableReactions(card, state)).toBe(9);
  });
});
