import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { resolvePlayerHit } from "@/lib/battle/hit-resolution";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { defaultTalentEffects } from "@/lib/battle";
import { setEnemyStatus, type CombatTextEvent } from "@/lib/battle/types";
import { dealDamage, makeCombatTexts, makeTestCard, patchBattleState, seededRng } from "../../fixtures/battle";
import {
  defaultPlayerStatusValues,
  defaultEnemyStatusValues,
  defaultTrinketManifest,
} from "../../fixtures/default-battle-state";

describe("card hit resolution", () => {
  it("applies enemy damage and forge decay on physical hit", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerStatuses: defaultPlayerStatusValues({ forge: 3 }),
    });
    const card = makeTestCard();
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 5 };
    const texts: CombatTextEvent[] = [];
    const result = resolvePlayerHit(state, { source: "card-attack", card, effect, resolvedDamage: 5 }, texts);
    expect(result.enemyHealth).toBe(45);
    expect(result.playerStatuses.forge).toBe(2);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "physical", amount: 5 });
  });

  it("triggers forge stun rider when forge exceeds threshold", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerStatuses: defaultPlayerStatusValues({ forge: 8 }),
      trinketEffects: defaultTrinketManifest({ forgeStunThreshold: 5, forgeStunAmount: 3 }),
      rng: seededRng(99),
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 5 };
    const texts: CombatTextEvent[] = [];
    const result = resolvePlayerHit(state, { source: "card-attack", card, effect, resolvedDamage: 5 }, texts);
    expect(result.playerStatuses.forge).toBe(7);
    expect(result.enemyStatuses.stun).toBeGreaterThanOrEqual(3);
  });
});

describe("damage riders via applyCardEffects", () => {
  it("armorToPhysicalDamage adds armor to physical damage", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerStatuses: defaultPlayerStatusValues({ armor: 6 }),
      talentEffects: { ...defaultTalentEffects, armorToPhysicalDamage: true },
      rng: seededRng(99),
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(39);
  });

  it("applies the full multiplied status gain", () => {
    const state = patchBattleState({
      enemyStatuses: defaultEnemyStatusValues({ poison: 4 }),
    });
    const card = makeTestCard({ effects: [{ kind: "multiply-enemy-status", status: "poison", factor: 2 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyStatuses.poison).toBe(8);
  });

  it("applies forge on burn via talent forgeOnBurnDealt", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      talentEffects: { forgeOnBurnDealt: 3 },
      rng: () => 0.5,
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerStatuses.forge).toBeGreaterThanOrEqual(3);
  });

  it("applies Emberforged when Burn hits an unburned enemy", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      gearEffects: { forgeOnBurnVsUnburned: 2 },
      rng: () => 0.5,
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerStatuses.forge).toBeGreaterThanOrEqual(2);
  });

  it("archery play-twice ent ers the archery branch without recursion when chance is 0", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerStatuses: defaultPlayerStatusValues({ forge: 0 }),
      talentEffects: {
        ...defaultTalentEffects,
        archeryPlayTwiceChance: 0,
      },
    });
    const card = makeTestCard({
      tags: ["archery"],
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);

    expect(result.enemyHealth).toBe(45);
  });

  it("nature leech heals player when natureLeechChance procs", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, natureLeechChance: 100 },
      rng: () => 0.1,
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "nature", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerHealth).toBeGreaterThan(10);
  });

  it("holy tithe combat text shows scaled gold when goldGainPercent gear is active", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      talentEffects: { ...defaultTalentEffects, holyGoldChance: 100 },
      gearEffects: { goldGainPercent: 50 },
      rng: () => 0.5,
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "holy", amount: 10 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.gold).toBe(15);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 15 });
  });

  it("burn stun rider applies stun when talent procs on burn damage", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      talentEffects: { ...defaultTalentEffects, burnStunChance: 100 },
      rng: () => 0.99,
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyStatuses.stun).toBeGreaterThanOrEqual(5);
  });

  it("nature stun rider applies stun when Entangle procs", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      talentEffects: { ...defaultTalentEffects, natureStunChance: 100 },
      rng: () => 0.99,
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "nature", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyStatuses.stun).toBeGreaterThanOrEqual(5);
  });

  it("armorToNatureDamage adds armor to nature damage", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerStatuses: defaultPlayerStatusValues({ armor: 4 }),
      talentEffects: { ...defaultTalentEffects, armorToNatureDamage: true },
      rng: () => 0.99,
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "nature", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(41);
  });
});

describe("Emberforged ignition", () => {
  it("grants Forge when Burn is absent, then waits for Burn to clear", () => {
    const state = patchBattleState({
      enemyHealth: 1000,
      enemyMaxHealth: 1000,
      playerStatuses: defaultPlayerStatusValues(),
      gearEffects: { forgeOnBurnVsUnburned: 2 },
      talentEffects: { ...defaultTalentEffects, forgeOnBurnDealt: 3 },
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 1 }] });
    const first = applyCardEffects(state, card, []);
    const second = applyCardEffects(first, card, []);
    expect(first.playerStatuses.forge).toBe(5);
    expect(second.playerStatuses.forge).toBe(8);
    const refreshed = setEnemyStatus(second, "burn", 0);
    const third = applyCardEffects(refreshed, card, []);
    expect(third.playerStatuses.forge).toBe(refreshed.playerStatuses.forge + 5);
  });
});

describe("damage rider regressions", () => {
  it("copies a resolved Physical hit once for Parting Cut and Stun even with large offensive bonuses", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      appliesFightPacing: true,
      turn: 26,
      currentEnemy: { enemyType: "boss", traits: [] },
      enemyHealth: 10000,
      enemyMaxHealth: 10000,
      playerStatuses: { forge: 7 },
      talentEffects: { physicalStunChance: 100, flatStunDamage: 50 },
      gearEffects: { flatBleedDamage: 50 },
      flags: { nextPhysicalDealsBleed: true, nextHitCrit: true },
    });
    const texts = makeCombatTexts();
    const result = dealDamage(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4 }] }),
      texts,
    );
    const damage = (stat: string) =>
      texts.reduce(
        (total, text) =>
          total + (text.kind === "damage" && text.target === "enemy" && text.stat === stat ? text.amount : 0),
        0,
      );
    expect(damage("physical")).toBeGreaterThan(20);
    expect(damage("stun")).toBe(damage("physical"));
    expect(damage("bleed")).toBe(damage("physical"));
    expect(result.enemyHealth).toBe(state.enemyHealth - damage("physical") * 3);
    expect(result.flags.nextPhysicalDealsBleed).toBe(false);
  });

  it("Wardbreaker purge alone does not cross a Health threshold", () => {
    const state = patchBattleState({
      enemyHealth: 6,
      enemyMaxHealth: 10,
      currentEnemy: { traits: [ENCOUNTER_TRAITS["divine-aegis"].enemyTrait] },
      enemyMitigation: { armor: 1 },
      gearEffects: { attackPurgeOncePerTurn: 1 },
    });
    const result = resolvePlayerHit(state, { source: "attack-purge" }, []);
    expect(result.enemyHealth).toBe(6);
    expect(result.flags.divineAegisTriggered).toBe(false);
    expect(result.enemyMitigation).toMatchObject({ armor: 0, block: 0 });
    expect(state.flags.divineAegisTriggered).toBe(false);
  });

  it("does not trigger Obsidian Hammer when Block absorbs all Physical damage", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerStatuses: { forge: 4 },
      enemyMitigation: { block: 9 },
      trinketEffects: { forgeStunThreshold: 4, forgeStunAmount: 1 },
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    const result = dealDamage(state, card);
    expect(result.enemyMitigation.block).toBe(0);
    expect(result.enemyHealth).toBe(state.enemyHealth);
    expect(result.enemyStatuses.stun).toBe(0);
    expect(result.playerStatuses.forge).toBe(4);
  });

  it("keeps the main hit after Wardbreaker purges a defense", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      playerHealth: 20,
      playerMaxHealth: 30,
      enemyMitigation: { armor: 0, block: 5, forge: 0 },
      gearEffects: { attackPurgeOncePerTurn: 1 },
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10, lifesteal: true }] });
    const texts = makeCombatTexts();
    const result = resolvePlayerHit(
      state,
      { source: "card-attack", card, effect: card.effects[0] as never, resolvedDamage: 10 },
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(30);
    expect(result.playerHealth).toBe(25);
    expect(texts.some((entry) => entry.stat === "physical")).toBe(true);
    expect(texts.some((entry) => entry.stat === "holy")).toBe(false);
  });
});
