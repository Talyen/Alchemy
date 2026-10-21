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
});
