import { describe, expect, it } from "vitest";
import { applyEnemyDotDamage, detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { BATTLE_CONFIG } from "@/lib/game-constants";
import { makeCombatTexts as makeTexts, makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("applyEnemyDotDamage", () => {
  it("pays burn-defeat gear before stack decay so a lethal last stack still counts", () => {
    const state = patchBattleState({
      enemyHealth: 1,
      playerHealth: 20,
      enemyStatuses: { burn: 1 },
      gearEffects: { healOnBurnEnemyDefeated: 6 },
    });
    const next = applyEnemyDotDamage(state, [{ status: "burn", finalDamage: 1, nextStacks: 0 }], makeTexts());
    expect(next.enemyHealth).toBe(0);
    expect(next.enemyStatuses.burn).toBe(0);
    expect(next.playerHealth).toBe(26);
  });

  it("sums pulses into one hit, decays Armor once, and commits all remaining stacks", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMitigation: { armor: 3 },
      enemyStatuses: { burn: 4, poison: 2 },
    });
    const next = applyEnemyDotDamage(
      state,
      [
        { status: "burn", finalDamage: 4, nextStacks: 2 },
        { status: "poison", finalDamage: 2, nextStacks: 1 },
      ],
      makeTexts(),
    );
    expect(next.enemyHealth).toBe(24);
    expect(next.enemyMitigation.armor).toBe(3 - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT);
    expect(next.enemyStatuses).toMatchObject({ burn: 2, poison: 1 });
    expect(state.enemyStatuses).toMatchObject({ burn: 4, poison: 2 });
  });

  it.each([4, 6, 8])("attributes ordered pulse rewards only to Health actually lost from %i Health", (health) => {
    const state = patchBattleState({
      enemyHealth: health,
      mana: 0,
      maxMana: 3,
      gearEffects: { elementalDamageManaChance: 100 },
      trinketEffects: { cutpurseGoldOnBleed: 2 },
    });
    const next = applyEnemyDotDamage(
      state,
      [
        { status: "poison", finalDamage: 4, nextStacks: 0 },
        { status: "burn", finalDamage: 2, nextStacks: 0 },
        { status: "bleed", finalDamage: 3, nextStacks: 0 },
      ],
      makeTexts(),
    );
    expect(next.enemyHealth).toBe(0);
    expect(next.mana).toBe(health > 4 ? 1 : 0);
    expect(next.gold).toBe(state.gold + (health > 6 ? 2 : 0));
  });
});

describe("detonateEnemyStatuses", () => {
  it("limits Septic Shock to Poison in a combined detonation", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { burn: 10, bleed: 10, poison: 10 },
      talentEffects: { bleedPoisonDamageTakenPercent: 10 },
    });
    const texts = makeTexts();
    const next = detonateEnemyStatuses(state, ["burn", "bleed", "poison"], texts);
    expect(next.enemyHealth).toBe(69);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "poison", amount: 11 });
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 10 });
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "bleed", amount: 10 });
  });

  it("applies the Burn bonus against a bleeding enemy to Burn detonation", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: { burn: 8, bleed: 2 },
      gearEffects: { burnDamageBonusToBleedingPercent: 50 },
    });
    const texts = makeTexts();
    const next = detonateEnemyStatuses(state, ["burn"], texts);
    expect(next.enemyHealth).toBe(18);
    expect(next.enemyStatuses.burn).toBe(0);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 12 });
  });

  it.each(["burn", "poison"] as const)("keeps queued Bleed leech when detonating only %s", (status) => {
    const state = patchBattleState({
      enemyHealth: 30,
      playerHealth: 20,
      enemyStatuses: { [status]: 8, bleed: 6 },
      pendingBleedLeechHealing: 6,
    });
    const next = detonateEnemyStatuses(state, [status], makeTexts());
    expect(next.playerHealth).toBe(20);
    expect(next.pendingBleedLeechHealing).toBe(6);
    expect(next.enemyStatuses.bleed).toBe(6);
  });

  it("does not count Poison damage toward Bleed leech in a combined detonation", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      playerHealth: 20,
      enemyStatuses: { poison: 8, bleed: 2 },
      pendingBleedLeechHealing: 6,
    });
    const next = detonateEnemyStatuses(state, ["bleed", "poison"], makeTexts());
    expect(next.playerHealth).toBe(21);
    expect(next.pendingBleedLeechHealing).toBe(0);
  });

  it("bursts remaining bleed and poison in one health transition", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: { bleed: 6, poison: 4 },
    });
    const texts = makeTexts();
    const next = detonateEnemyStatuses(state, ["bleed", "poison"], texts);
    expect(next.enemyHealth).toBe(20);
    expect(next.enemyStatuses.bleed).toBe(0);
    expect(next.enemyStatuses.poison).toBe(0);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "bleed", amount: 6 });
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "poison", amount: 4 });
  });

  it("pays pending bleed leech against actual health lost, then clears the pending amount", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      playerHealth: 20,
      enemyStatuses: { bleed: 6 },
      pendingBleedLeechHealing: 3,
    });
    const texts = makeTexts();
    const next = detonateEnemyStatuses(state, ["bleed"], texts);
    expect(next.enemyHealth).toBe(24);
    expect(next.pendingBleedLeechHealing).toBe(0);
    expect(next.playerHealth).toBe(22);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 2 });
  });
});

describe("remaining-tick detonation", () => {
  it.each([
    [5, 15],
    [10, 39],
  ])("sums the full decay of %i Poison", (poison, total) => {
    const state = patchBattleState({ enemyHealth: 100, enemyMaxHealth: 100, enemyStatuses: { poison, bleed: 6 } });
    const texts = makeTexts();
    const next = detonateEnemyStatuses(state, ["bleed", "poison"], texts, "remaining-ticks");
    expect(next.enemyHealth).toBe(100 - total - 6);
    expect(next.enemyStatuses.poison).toBe(0);
    expect(next.enemyStatuses.bleed).toBe(0);
    expect(detonateEnemyStatuses(next, ["bleed", "poison"], texts, "remaining-ticks")).toBe(next);
    expect(state.enemyStatuses.poison).toBe(poison);
  });

  it("rounds each projected tick and excludes random Poison growth", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { poison: 5 },
      currentEnemy: {
        traits: [{ id: "poison-resistance", title: "Poison Resistance", description: "" }],
      },
      rng: () => {
        throw new Error("Detonation must not roll future procs");
      },
    });
    const multiplier = 0.75;
    const next = detonateEnemyStatuses(state, ["poison"], makeTexts(), "remaining-ticks");
    expect(next.enemyHealth).toBe(100 - [5, 4, 3, 2, 1].reduce((sum, tick) => sum + Math.round(tick * multiplier), 0));
  });

  it("leaves a defeated enemy untouched instead of detonating its corpse", () => {
    const state = patchBattleState({
      enemyHealth: 0,
      enemyStatuses: { burn: 8 },
    });
    const texts = makeTexts();
    const next = detonateEnemyStatuses(state, ["burn"], texts);
    expect(next).toBe(state);
    expect(texts).toEqual([]);
  });

  it("resolves enemy health thresholds before kill payouts during DoT damage", () => {
    const state = patchBattleState({
      enemyHealth: 6,
      enemyMaxHealth: 10,
      currentEnemy: { traits: [{ id: "second-wind", title: "Second Wind", description: "" }] },
      gearEffects: { healOnBurnEnemyDefeated: 6 },
      playerHealth: 20,
      playerMaxHealth: 30,
    });
    // 4 burn damage brings enemy from 6 to 2 (crosses half-health 5). Second Wind triggers.
    // The enemy is healed rather than dying, so healOnBurnEnemyDefeated must not fire prematurely.
    const next = applyEnemyDotDamage(state, [{ status: "burn", finalDamage: 4, nextStacks: 0 }], makeTexts());
    expect(next.flags.secondWindTriggered).toBe(true);
    expect(next.enemyHealth).toBeGreaterThan(2);
    expect(next.playerHealth).toBe(20);
  });

  it.each(["tick", "detonation"] as const)("Cutpurse Knife pays for a Bleed %s", (source) => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { bleed: 4 },
      trinketEffects: { cutpurseGoldOnBleed: 1 },
      rng: () => 0.99,
    });
    const next = source === "tick" ? tickEnemyStatuses(state, []) : detonateEnemyStatuses(state, ["bleed"], []);
    expect(next.enemyHealth).toBe(96);
    expect(next.gold).toBe(state.gold + 1);
  });

  it.each([
    { health: 20, bleed: 0, healed: 5 },
    { health: 6, bleed: 0, healed: 3 },
    { health: 6, bleed: 4, healed: 1 },
  ])(
    "Blackfletch's Poison Leech caps healing at Poison Health loss: $health Health, $bleed Bleed",
    ({ health, bleed, healed }) => {
      const card = makeTestCard({
        tags: ["archery"],
        effects: [{ kind: "damage", damageType: "physical", amount: 1 }],
      });
      const state = patchBattleState({
        hand: [card],
        playerHealth: 5,
        playerMaxHealth: 30,
        enemyHealth: health,
        enemyMaxHealth: 100,
        enemyStatuses: { poison: 4, bleed },
        gearEffects: { archeryDetonateBleedPoison: 1 },
        talentEffects: { poisonLeechChance: 100 },
        rng: () => 0.99,
      });
      const next = playBattleCardResolved(state, card.id, 0).state;
      expect(next.enemyStatuses.poison).toBe(0);
      expect(next.playerHealth).toBe(5 + healed);
    },
  );

  it("Blackfletch's Poison detonation can trigger Hemotoxin", () => {
    const card = makeTestCard({ tags: ["archery"], effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });
    const state = patchBattleState({
      hand: [card],
      enemyHealth: 29,
      enemyMaxHealth: 100,
      enemyStatuses: { poison: 4 },
      gearEffects: { archeryDetonateBleedPoison: 1 },
      talentEffects: { poisonBleedDamageChance: 100 },
      rng: () => 0.99,
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.enemyHealth).toBe(8);
    expect(next.enemyStatuses.bleed).toBe(10);
  });

  it("a lethal Poison detonation does not fund later Bleed rewards", () => {
    const draw = makeTestCard({ effects: [{ kind: "gain-gold", amount: 1 }] });
    const state = patchBattleState({
      deck: [draw],
      playerHealth: 5,
      playerMaxHealth: 30,
      enemyHealth: 4,
      enemyMaxHealth: 30,
      enemyStatuses: { poison: 4, bleed: 4 },
      pendingBleedLeechHealing: 4,
      talentEffects: { drawOnBleedDamageChance: 100 },
      trinketEffects: { cutpurseGoldOnBleed: 1 },
      rng: () => 0.99,
    });
    const next = detonateEnemyStatuses(state, ["poison", "bleed"], []);
    expect(next.enemyHealth).toBe(0);
    expect(next.playerHealth).toBe(5);
    expect(next.pendingBleedLeechHealing).toBe(0);
    expect(next.hand).toHaveLength(0);
    expect(next.gold).toBe(state.gold);
  });
});
