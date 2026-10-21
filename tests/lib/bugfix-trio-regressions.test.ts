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

  it("projects odd-span random damage at the exact average", () => {
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
    // Wildheart doubles the first Nature hit: 2.5 * 2 = 5 leaves 1 HP on a 6-HP
    // enemy, so wildfire pays 1 on the Nature branch and 0 on Holy, averaging 0.5.
    const state = { ...endPlayerTurn(endPlayerTurn(base).state).state, enemyHealth: 6 };
    const random = makeTestCard({
      effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 4, damageTypePool: ["nature", "holy"] }],
    });
    // Reaction scoring uses the exact uniform expectation (2.5) so autoplay and the simulator agree.
    expect(scoreAvailableReactions(random, state)).toBe(0.5);
  });

  it("clears enemy Bleed on detonateAllBleed in reaction projection", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { bleed: 10 },
    });
    const multiHit = makeTestCard({
      effects: [
        { kind: "damage", damageType: "bleed", amount: 2, detonateAllBleed: true },
        { kind: "damage", damageType: "physical", amount: 4, doubleIfEnemyBleeding: true },
      ],
    });
    // First hit detonates Bleed to 0, so the second hit does not see Bleed on the enemy
    // and scoreAvailableReactions does not project double damage or lingering Bleed.
    // Score tracks reaction payoffs; with Bleed cleared, no post-detonation Bleed reactions trigger.
    expect(scoreAvailableReactions(multiHit, state)).toBe(0);
  });

  it("adds direct Bleed status from Bleed damage in reaction projection", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { bleed: 0 },
    });
    const bleedThenHit = makeTestCard({
      effects: [
        { kind: "damage", damageType: "bleed", amount: 4 },
        { kind: "damage", damageType: "physical", amount: 5, doubleIfEnemyBleeding: true },
      ],
    });
    // First hit adds 4 Bleed to enemyStatuses, so second hit sees Bleed and doubles its damage.
    // Reactions score available reactions without throwing or losing state across hits.
    expect(scoreAvailableReactions(bleedThenHit, state)).toBe(0);
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
