import { describe, expect, it, vi, afterEach } from "vitest";
import { dealDamageToEnemy } from "@/lib/battle/damage";
import type { BattleCardEffect } from "@/lib/game-data";
import { defaultGearEffects } from "@/lib/gear";
import { patchBattleState } from "./test-state";
import { defaultPlayerStatusValues } from "../../fixtures/default-battle-state";
import { makeCard, makeEffect, makeTexts } from "./damage-test-helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dealDamageToEnemy — basic physical damage", () => {
  it("deals base damage to enemy health", () => {
    const state = patchBattleState({ enemyHealth: 30 });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      makeTexts(),
    );
    expect(result.enemyHealth).toBe(25);
  });

  it("adds gear flat physical damage separately from talents", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      gearEffects: { ...defaultGearEffects, flatPhysicalDamage: 3 },
      talentEffects: { ...patchBattleState().talentEffects, flatPhysicalDamage: 0 },
    });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      makeTexts(),
    );
    expect(result.enemyHealth).toBe(22);
  });

  it("adds gear flat bonuses for each damage type", () => {
    const damageTypes = [
      ["physical", "flatPhysicalDamage"],
      ["stun", "flatStunDamage"],
      ["holy", "flatHolyDamage"],
      ["burn", "flatBurnDamage"],
      ["poison", "flatPoisonDamage"],
      ["bleed", "flatBleedDamage"],
      ["freeze", "flatFreezeDamage"],
      ["nature", "flatNatureDamage"],
    ] as const;

    for (const [damageType, gearKey] of damageTypes) {
      const state = patchBattleState({
        enemyHealth: 30,
        gearEffects: { ...defaultGearEffects, [gearKey]: 1 },
        talentEffects: { ...patchBattleState().talentEffects },
      });
      const card = makeCard({ effects: [makeEffect(damageType, 5)] });
      const result = dealDamageToEnemy(
        state,
        card,
        card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
        makeTexts(),
      );
      expect(result.enemyHealth).toBe(24);
    }
  });

  it("produces combat text for damage", () => {
    const state = patchBattleState({ enemyHealth: 30 });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    dealDamageToEnemy(state, card, card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>, texts);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.some((t) => t.target === "enemy" && t.kind === "damage")).toBe(true);
  });
});

describe("computeBaseDamage — equalToBlock / equalToArmor", () => {
  it("damage equals block plus forge when equalToBlock", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ block: 7 }) });
    const card = makeCard({ effects: [makeEffect("physical", 0, { equalToBlock: true })] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThanOrEqual(30 - 7);
  });

  it("damage equals armor plus forge when equalToArmor", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ armor: 4 }) });
    const card = makeCard({ effects: [makeEffect("physical", 0, { equalToArmor: true })] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThanOrEqual(30 - 4);
  });
});

describe("dealDamageToEnemy — edge cases", () => {
  it("does not decrease health below 0", () => {
    const state = patchBattleState({ enemyHealth: 3 });
    const card = makeCard({ effects: [makeEffect("physical", 100)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(0);
  });

  it("handles zero damage gracefully", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMitigation: { armor: 0, forge: 0, block: 0 },
    });
    const card = makeCard({ effects: [makeEffect("physical", 0)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(30);
    expect(result.playerStatuses.forge).toBe(0);
  });
});
