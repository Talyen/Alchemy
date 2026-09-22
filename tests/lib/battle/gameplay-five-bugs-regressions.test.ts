import { describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { computeEffectiveCost } from "@/lib/battle/card-cost-rules";
import { resolveSecondaryAction, writeCombatFlag } from "@/lib/battle/action-context";
import { applyCleansePlayerStatusToDamageEffect } from "@/lib/battle/effect-handlers/status-handlers";
import { getEffectiveDamageScore } from "@/lib/battle/autoplay-policy";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("gameplay five bugs regressions", () => {
  describe("1. Divine Favor / Holy Card Free Handling", () => {
    it("discounts non-damage Holy-tagged cards when nextHolyCardFree is armed", () => {
      const holyUtilityCard = makeTestCard({
        cost: 2,
        tags: ["holy"],
        effects: [{ kind: "player-status", status: "block", amount: 5 }],
      });
      const state = patchBattleState({
        mana: 2,
        flags: { nextHolyCardFree: true },
      });

      const { effectiveCost, disarmedFlags } = computeEffectiveCost(state, holyUtilityCard);
      expect(effectiveCost).toBe(0);
      expect(disarmedFlags.has("nextHolyCardFree")).toBe(true);
    });

    it("prevents secondary actions from spending nextHolyCardFree", () => {
      const holyAttack = makeTestCard({
        cost: 2,
        effects: [{ kind: "damage", damageType: "holy", amount: 5 }],
      });
      const state = patchBattleState({
        mana: 2,
        flags: { nextHolyCardFree: true },
      });

      resolveSecondaryAction(state, "repeat", (secondaryState) => {
        const { effectiveCost, disarmedFlags } = computeEffectiveCost(secondaryState, holyAttack);
        // Secondary action cannot see or spend nextHolyCardFree
        expect(effectiveCost).toBe(2);
        expect(disarmedFlags.has("nextHolyCardFree")).toBe(false);
        return secondaryState;
      });
    });
  });

  describe("2. Secondary Actions Arming Combat Flags", () => {
    it("allows secondary actions to arm future combat flags", () => {
      const state = patchBattleState({
        flags: { nextHitCrit: false },
      });

      const next = resolveSecondaryAction(state, "repeat", (secondaryState) => {
        return writeCombatFlag(secondaryState, "nextHitCrit", true);
      });

      expect(next.flags.nextHitCrit).toBe(true);
    });

    it("prevents secondary actions from clearing/spending armed combat flags", () => {
      const state = patchBattleState({
        flags: { nextHitCrit: true },
      });

      const next = resolveSecondaryAction(state, "repeat", (secondaryState) => {
        return writeCombatFlag(secondaryState, "nextHitCrit", false);
      });

      expect(next.flags.nextHitCrit).toBe(true);
    });
  });

  describe("3. Exorcism Cleanse Notice Event", () => {
    it("emits a cleanse notice event when cleansing Burn to deal damage", () => {
      const combatTexts: Array<import("@/lib/battle/types").CombatTextEvent> = [];
      const state = patchBattleState({
        playerStatuses: { burn: 4 },
        enemyHealth: 50,
        enemyMaxHealth: 50,
      });

      const card = cardById["exorcism"]!;
      const effect = card.effects.find((e) => e.kind === "cleanse-player-status-to-damage") as Extract<
        (typeof card.effects)[number],
        { kind: "cleanse-player-status-to-damage" }
      >;

      const next = applyCleansePlayerStatusToDamageEffect(state, card, effect, 1, combatTexts);
      expect(next.playerStatuses.burn).toBe(0);
      expect(next.enemyHealth).toBe(46);

      const cleanseNotice = combatTexts.find(
        (e) => e.target === "player" && e.kind === "notice" && e.stat === "burn" && e.signal === "cleanse",
      );
      expect(cleanseNotice).toBeDefined();
    });
  });

  describe("4. Autoplay & Wish Scoring for Resource-Based Damage", () => {
    it("scores equalToArmor damage according to player Armor", () => {
      const state = patchBattleState({
        playerStatuses: { armor: 12 },
      });
      const armorDamageCard = makeTestCard({
        cost: 1,
        effects: [{ kind: "damage", damageType: "holy", amount: 0, equalToArmor: true }],
      });

      const score = getEffectiveDamageScore(armorDamageCard, state);
      expect(score).toBe(12);
    });

    it("scores equalToGoldPercent damage according to player Gold", () => {
      const state = patchBattleState({
        gold: 50,
      });
      const goldDamageCard = makeTestCard({
        cost: 1,
        effects: [{ kind: "damage", damageType: "physical", amount: 0, equalToGoldPercent: 10 }],
      });

      const score = getEffectiveDamageScore(goldDamageCard, state);
      expect(score).toBe(5);
    });
  });

  describe("5. Enemy Conditional Flat Attack Trait Scaling", () => {
    it("scales dire-wolf bonus with room multiplier against Bleeding heroes", () => {
      const state = patchBattleState({
        roomScalingMultiplier: 2.0,
        playerHealth: 100,
        playerMaxHealth: 100,
        playerStatuses: { bleed: 1 },
        currentEnemy: { traits: [{ id: "dire-wolf", title: "Scent of Blood", description: "" }] },
      });
      const ability = makeTestCard({
        effects: [{ kind: "damage", damageType: "physical", amount: 3 }],
      });

      const withTrait = applyEnemyAbility(state, ability, []);
      const withoutTrait = applyEnemyAbility(
        { ...state, currentEnemy: { ...state.currentEnemy, traits: [] } },
        ability,
        [],
      );
      // With roomScalingMultiplier 2.0, CONDITIONAL_FLAT_BONUS (1) scales to 2 additional damage
      expect(withoutTrait.playerHealth - withTrait.playerHealth).toBe(2);
    });

    it("scales stone-golem bonus with room multiplier while it has Block", () => {
      const state = patchBattleState({
        roomScalingMultiplier: 2.0,
        playerHealth: 100,
        playerMaxHealth: 100,
        enemyMitigation: { block: 5 },
        currentEnemy: { traits: [{ id: "stone-golem", title: "Stoneguard", description: "" }] },
      });
      const ability = makeTestCard({
        effects: [{ kind: "damage", damageType: "physical", amount: 3 }],
      });

      const withTrait = applyEnemyAbility(state, ability, []);
      const withoutTrait = applyEnemyAbility(
        { ...state, currentEnemy: { ...state.currentEnemy, traits: [] } },
        ability,
        [],
      );
      // With roomScalingMultiplier 2.0, flat bonus scales to 2 additional damage
      expect(withoutTrait.playerHealth - withTrait.playerHealth).toBe(2);
    });

    it("scales blood-cultist bonus with room multiplier for Bleed attack against Bleeding heroes", () => {
      const state = patchBattleState({
        roomScalingMultiplier: 2.0,
        playerHealth: 100,
        playerMaxHealth: 100,
        playerStatuses: { bleed: 1 },
        currentEnemy: { traits: [{ id: "blood-cultist", title: "Blood Frenzy", description: "" }] },
      });
      const ability = makeTestCard({
        effects: [{ kind: "damage", damageType: "bleed", amount: 3 }],
      });

      const withTrait = applyEnemyAbility(state, ability, []);
      const withoutTrait = applyEnemyAbility(
        { ...state, currentEnemy: { ...state.currentEnemy, traits: [] } },
        ability,
        [],
      );
      // With roomScalingMultiplier 2.0, flat bonus scales to 2 additional damage
      expect(withoutTrait.playerHealth - withTrait.playerHealth).toBe(2);
    });
  });
});
