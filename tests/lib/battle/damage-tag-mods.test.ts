import { describe, expect, it, vi, afterEach } from "vitest";
import { dealDamageToEnemy } from "@/lib/battle/damage";
import type { BattleCardEffect } from "@/lib/game-data";
import { patchBattleState } from "../../fixtures/battle";
import { defaultEnemyStatusValues, defaultTalentEffects, defaultCcState } from "../../fixtures/default-battle-state";
import { makeCombatTexts, makeEffect, makeTestCard } from "../../fixtures/battle";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("computeBaseDamage — archery tag", () => {
  it("adds flatArrowDamage to cards with the archery tag", () => {
    const state = patchBattleState({
      talentEffects: { ...defaultTalentEffects, flatArrowDamage: 3 },
    });
    const card = makeTestCard({
      tags: ["archery"],
      effects: [makeEffect("physical", 5)],
    });
    const texts = makeCombatTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(25);
  });

  it("triggers extra hit once without infinite recursion when archeryPlayTwiceChance is 100%", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      talentEffects: { ...defaultTalentEffects, archeryPlayTwiceChance: 100 },
    });
    const card = makeTestCard({
      tags: ["archery"],
      effects: [makeEffect("physical", 20)],
    });
    const texts = makeCombatTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // Initial hit = 20 damage, extra hit = Math.round(20 / 2) = 10 damage. Total = 30 damage dealt.
    expect(result.enemyHealth).toBe(70);
  });
});

describe("computeBaseDamage — stun damage", () => {
  it("adds flatStunDamage to stun damage type", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      talentEffects: { ...defaultTalentEffects, flatStunDamage: 2 },
    });
    const card = makeTestCard({ effects: [makeEffect("stun", 5)] });
    const texts = makeCombatTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(23);
  });
});

describe("computeBaseDamage — physical vs statuses", () => {
  it("adds poisonPhysicalBonus against poisoned enemies", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      enemyStatuses: defaultEnemyStatusValues({ poison: 5 }),
      talentEffects: { ...defaultTalentEffects, poisonPhysicalBonus: 3 },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeCombatTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(22);
  });

  it("adds bleedPhysicalBonus against bleeding enemies", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      enemyStatuses: defaultEnemyStatusValues({ bleed: 5 }),
      talentEffects: { ...defaultTalentEffects, bleedPhysicalBonus: 2 },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeCombatTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(23);
  });

  it("amplifies physical damage against stunned enemies", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      enemyCC: defaultCcState({ stunSkipTurns: 1 }),
      talentEffects: { ...defaultTalentEffects, physicalDoubledVsStunned: true },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeCombatTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(10);
  });

  it("amplifies physical damage against frozen enemies", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      enemyCC: defaultCcState({ freezeSkipTurns: 1 }),
      talentEffects: { ...defaultTalentEffects, physicalDoubledVsFrozen: true },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeCombatTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(10);
  });
});
