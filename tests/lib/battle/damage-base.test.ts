import { describe, expect, it, vi, afterEach } from "vitest";
import { defaultGearEffects } from "@/lib/gear";
import { patchBattleState } from "../../fixtures/battle";
import { defaultPlayerStatusValues } from "../../fixtures/default-battle-state";
import { dealDamage, makeCombatTexts, makeEffect, makeTestCard } from "../../fixtures/battle";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dealDamageToEnemy — basic physical damage", () => {
  it("deals base damage to enemy health", () => {
    const state = patchBattleState({ enemyHealth: 30 });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(25);
  });

  it("adds gear flat physical damage separately from talents", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      gearEffects: { ...defaultGearEffects, flatPhysicalDamage: 3 },
      talentEffects: { ...patchBattleState().talentEffects, flatPhysicalDamage: 0 },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
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
      const card = makeTestCard({ effects: [makeEffect(damageType, 5)] });
      const result = dealDamage(state, card);
      expect(result.enemyHealth).toBe(24);
    }
  });

  it("produces combat text for damage", () => {
    const state = patchBattleState({ enemyHealth: 30 });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeCombatTexts();
    dealDamage(state, card, texts);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.some((t) => t.target === "enemy" && t.kind === "damage")).toBe(true);
  });
});

describe("computeBaseDamage — equalToBlock / equalToArmor", () => {
  it("damage equals block plus forge when equalToBlock", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ block: 7 }) });
    const card = makeTestCard({ effects: [makeEffect("physical", 0, { equalToBlock: true })] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBeLessThanOrEqual(30 - 7);
  });

  it("damage equals armor plus forge when equalToArmor", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ armor: 4 }) });
    const card = makeTestCard({ effects: [makeEffect("physical", 0, { equalToArmor: true })] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBeLessThanOrEqual(30 - 4);
  });
});

describe("dealDamageToEnemy — edge cases", () => {
  it("does not decrease health below 0", () => {
    const state = patchBattleState({ enemyHealth: 3 });
    const card = makeTestCard({ effects: [makeEffect("physical", 100)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(0);
  });

  it("handles zero damage gracefully", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMitigation: { armor: 0, forge: 0, block: 0 },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 0)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(30);
    expect(result.playerStatuses.forge).toBe(0);
  });
});
