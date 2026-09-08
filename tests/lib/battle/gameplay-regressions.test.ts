import { describe, expect, it } from "vitest";
import { dealPlayerTypedHit } from "@/lib/battle/player-typed-hit";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { companionLibrary } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { checkHealthThresholds } from "@/lib/battle/enemy-attack-damage";
import { applyWishEffect } from "@/lib/battle/wish";
import { dealDamage, makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("gameplay regressions", () => {
  it.each([19, 20, 21])("Kill Shot respects the strict 20 percent boundary at %i Health", (health) => {
    const card = makeTestCard({ tags: ["archery"], effects: [{ kind: "damage", damageType: "physical", amount: 4 }] });
    const state = patchBattleState({
      rng: () => 0.99,
      enemyHealth: health,
      enemyMaxHealth: 100,
      talentEffects: { archeryDoubledVsLowHealth: true },
    });
    expect(dealDamage(state, card).enemyHealth).toBe(health - (health < 20 ? 8 : 4));
  });

  it.each([29, 30, 31])("Desperate Wish respects the strict 30 percent boundary at %i Health", (health) => {
    const state = patchBattleState({
      playerHealth: health,
      playerMaxHealth: 100,
      playerStatuses: { block: 0 },
      talentEffects: { wishBlockBelowHealthPct: 30, wishBlockAmount: 6 },
    });
    expect(applyWishEffect(state, makeTestCard(), 1, []).playerStatuses.block).toBe(health < 30 ? 6 : 0);
  });

  it.each([
    { previous: 51, current: 50, block: 0, armor: 0 },
    { previous: 50, current: 49, block: 6, armor: 5 },
    { previous: 49, current: 48, block: 0, armor: 0 },
    { previous: 26, current: 25, block: 0, armor: 0 },
    { previous: 25, current: 24, block: 0, armor: 3 },
  ])("defensive threshold rewards for $previous → $current Health", ({ previous, current, block, armor }) => {
    const state = patchBattleState({
      playerHealth: current,
      playerMaxHealth: 100,
      playerStatuses: { block: 0, armor: 0 },
      talentEffects: {
        healthThresholdBlock: { threshold: 50, amount: 6 },
        healthThresholdArmor: [
          { threshold: 50, amount: 5 },
          { threshold: 25, amount: 3 },
        ],
      },
    });
    const result = checkHealthThresholds(previous, current, state, []);
    expect(result.playerStatuses.block).toBe(block);
    expect(result.playerStatuses.armor).toBe(armor);
  });

  it.each([
    { label: "dodged", roll: 0, block: 0, amount: 5, mana: 0 },
    { label: "blocked", roll: 0.99, block: 10, amount: 5, mana: 0 },
    { label: "zero", roll: 0.99, block: 0, amount: 0, mana: 0 },
    { label: "landed", roll: 0.99, block: 0, amount: 5, mana: 1 },
  ])("Bloomwoven only rewards damage: $label", ({ roll, block, amount, mana }) => {
    const card = makeTestCard({ cost: 0, effects: [{ kind: "damage", damageType: "nature", amount }] });
    const state = patchBattleState({
      rng: () => roll,
      mana: 0,
      hand: [card],
      enemyMitigation: { block },
      gearEffects: { manaOnNatureDamageChance: 100 },
    });
    expect(playBattleCardResolved(state, card.id, 0).state.mana).toBe(mana);
  });

  it("Bloomwoven rolls for each Nature damage packet", () => {
    const card = makeTestCard({
      cost: 0,
      effects: [
        { kind: "damage", damageType: "nature", amount: 1 },
        { kind: "damage", damageType: "nature", amount: 1 },
      ],
    });
    const state = patchBattleState({
      rng: () => 0.99,
      mana: 0,
      hand: [card],
      gearEffects: { manaOnNatureDamageChance: 100 },
    });
    expect(playBattleCardResolved(state, card.id, 0).state.mana).toBe(2);
  });
  it("Bloomwoven ignores Nature damage in an unselected chance branch", () => {
    const card = makeTestCard({
      cost: 0,
      effects: [
        {
          kind: "chance",
          probability: 0,
          successEffects: [{ kind: "damage", damageType: "nature", amount: 5 }],
          failureEffects: [],
        },
      ],
    });
    const state = patchBattleState({
      rng: () => 0.99,
      mana: 0,
      hand: [card],
      gearEffects: { manaOnNatureDamageChance: 100 },
    });
    expect(playBattleCardResolved(state, card.id, 0).state.mana).toBe(0);
  });

  it("Bloomwoven rewards Companion Nature damage", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      mana: 0,
      activeCompanion: {
        ...companionLibrary.wolf,
        turnStartEffects: [{ kind: "damage", damageType: "nature", amount: 1 }],
      },
      gearEffects: { manaOnNatureDamageChance: 100 },
    });
    expect(processCompanionTurnStart(state, []).mana).toBeGreaterThan(0);
  });
  it.each(["second-wind", "divine-aegis"] as const)(
    "Thunderstone respects %s when multiplied buildup Stuns",
    (trait) => {
      const state = patchBattleState({
        rng: () => 0.99,
        enemyHealth: 60,
        enemyMaxHealth: 100,
        currentEnemy: { traits: [{ id: trait, title: trait, description: "" }] },
        enemyStatuses: { stun: 20 },
        trinketEffects: { thunderstoneDamageOnStun: 15 },
      });
      const card = makeTestCard({ effects: [{ kind: "multiply-enemy-status", status: "stun", factor: 2 }] });
      const result = applyCardEffects(state, card, []);
      if (trait === "second-wind") {
        expect(result.flags.secondWindTriggered).toBe(true);
        expect(result.enemyHealth).toBeGreaterThan(45);
      } else {
        expect(result.flags.divineAegisTriggered).toBe(true);
        expect(result.enemyMitigation.armor).toBeGreaterThan(0);
        expect(result.enemyMitigation.block).toBeGreaterThan(0);
      }
    },
  );
  it("Bloomwoven rewards Nature retaliation damage", () => {
    const state = patchBattleState({ mana: 0, gearEffects: { manaOnNatureDamageChance: 100 } });
    expect(dealPlayerTypedHit(state, "nature", 5, []).mana).toBe(1);
  });

  it("Bloomwoven rewards Thunderstone Nature damage", () => {
    const state = patchBattleState({
      mana: 0,
      enemyHealth: 60,
      enemyMaxHealth: 100,
      enemyStatuses: { stun: 20 },
      trinketEffects: { thunderstoneDamageOnStun: 5 },
      gearEffects: { manaOnNatureDamageChance: 100 },
    });
    const card = makeTestCard({ effects: [{ kind: "multiply-enemy-status", status: "stun", factor: 2 }] });
    expect(applyCardEffects(state, card, []).mana).toBe(1);
  });
});
