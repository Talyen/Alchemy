import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle/apply-effects";
import { applyDamageRiders } from "@/lib/battle/damage-riders";
import { defaultTalentEffects } from "@/lib/battle";
import type { CombatTextEvent } from "@/lib/battle/types";
import { makeTestBattleState, makeTestCard, seededRng } from "../../fixtures/battle";
import {
  defaultPlayerStatusValues,
  defaultEnemyStatusValues,
  defaultTrinketManifest,
} from "../../fixtures/default-battle-state";

function makeState(overrides: Parameters<typeof makeTestBattleState>[0] = {}) {
  return makeTestBattleState(overrides);
}

describe("applyDamageRiders", () => {
  it("applies enemy damage and forge decay on physical hit", () => {
    const state = makeState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerStatuses: defaultPlayerStatusValues({ forge: 3 }),
    });
    const card = makeTestCard();
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 5 };
    const texts: CombatTextEvent[] = [];
    const result = applyDamageRiders(state, card, effect, 5, texts);
    expect(result.enemyHealth).toBe(45);
    expect(result.playerStatuses.forge).toBe(2);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "physical", amount: 5 });
  });

  it("triggers forge stun rider when forge exceeds threshold", () => {
    const state = makeState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerStatuses: defaultPlayerStatusValues({ forge: 8 }),
      trinketEffects: defaultTrinketManifest({ forgeStunThreshold: 5, forgeStunAmount: 3 }),
      rng: seededRng(99),
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 5 };
    const texts: CombatTextEvent[] = [];
    const result = applyDamageRiders(state, card, effect, 5, texts);
    expect(result.playerStatuses.forge).toBe(7);
    expect(result.enemyStatuses.stun).toBeGreaterThanOrEqual(3);
  });
});

describe("damage riders via applyCardEffects", () => {
  it("holy burn chance applies burn on holy damage", () => {
    const state = makeState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      talentEffects: { ...defaultTalentEffects, holyBurnChance: 50 },
      rng: () => 0.01,
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "holy", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyStatuses.burn).toBeGreaterThanOrEqual(5);
  });

  it("bleed desperate multiplier applies when player is below half health", () => {
    const state = makeState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, bleedDesperateMultiplier: 1.5 },
      rng: seededRng(99),
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "bleed", amount: 10 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(35);
  });

  it("bleed execute threshold doubles damage when enemy is low", () => {
    const state = makeState({
      enemyHealth: 8,
      enemyMaxHealth: 50,
      talentEffects: { ...defaultTalentEffects, bleedExecuteThreshold: 25 },
      rng: seededRng(99),
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "bleed", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(0);
  });

  it("holy gold percent adds bonus from gold", () => {
    const state = makeState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      gold: 20,
      talentEffects: { ...defaultTalentEffects, holyGoldPercent: 25 },
      rng: seededRng(99),
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "holy", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(40);
  });

  it("armorToPhysicalDamage adds armor to physical damage", () => {
    const state = makeState({
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
    const state = makeState({
      enemyStatuses: defaultEnemyStatusValues({ poison: 4 }),
    });
    const card = makeTestCard({ effects: [{ kind: "multiply-enemy-status", status: "poison", factor: 2 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyStatuses.poison).toBe(8);
  });

  it("applies forge on burn via talent forgeOnBurnDealt", () => {
    const state = makeState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      talentEffects: { ...makeState().talentEffects, forgeOnBurnDealt: 3 },
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

  it("applies forge on burn via gear forgeOnBurnDealt", () => {
    const state = makeState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      gearEffects: { ...makeState().gearEffects, forgeOnBurnDealt: 2 },
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

  it("lifesteal effect heals player proportionally", () => {
    const state = makeState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerHealth: 10,
      playerMaxHealth: 30,
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10, lifesteal: true }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(40);
    expect(result.playerHealth).toBeGreaterThan(10);
  });
});
