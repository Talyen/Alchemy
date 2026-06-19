import { describe, expect, it, vi, afterEach } from "vitest";
import { dealDamageToEnemy } from "@/lib/battle/damage";
import type { CombatTextEvent } from "@/lib/battle/types";
import type { BattleCardEffect, BattleCard } from "@/lib/game-data";
import { CRIT_MULTIPLIER } from "@/lib/game-constants";
import { defaultGearEffects } from "@/lib/gear";
import { patchBattleState } from "./test-state";
import {
  defaultPlayerStatusValues,
  defaultEnemyStatusValues,
  defaultTalentEffects,
  defaultTrinketManifest,
  defaultCcState,
  defaultCombatFlags,
} from "../../fixtures/default-battle-state";

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "test",
    title: "Test",
    descriptionLines: [""],
    art: "",
    cost: 1,
    effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    ...overrides,
  };
}

function makeEffect(damageType: string, amount: number, extras: Partial<BattleCardEffect> = {}): BattleCardEffect {
  return {
    kind: "damage",
    damageType: damageType as import("@/lib/game-data/types").DamageType,
    amount,
    ...extras,
  } as BattleCardEffect;
}

function makeTexts(): CombatTextEvent[] {
  return [];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dealDamageToEnemy â€” basic physical damage", () => {
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

describe("computeBaseDamage â€” forge bonus", () => {
  it("adds forge bonus to physical damage", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ forge: 3 }) });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(2); // forge consumed
  });

  it("adds forge to burn when forgeToBurn talent is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
      talentEffects: { ...defaultTalentEffects, forgeToBurn: true },
    });
    const card = makeCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(23);
    expect(result.playerStatuses.forge).toBe(1);
  });

  it("adds forge to holy when forgeToHoly talent is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
      talentEffects: { ...defaultTalentEffects, forgeToHoly: true },
    });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(23);
    expect(result.playerStatuses.forge).toBe(1);
  });

  it("adds forge to bleed when forgeToBleed talent is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
      talentEffects: { ...defaultTalentEffects, forgeToBleed: true },
    });
    const card = makeCard({ effects: [makeEffect("bleed", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(1);
  });
});

describe("computeBaseDamage â€” equalToBlock / equalToArmor", () => {
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

describe("computeBaseDamage â€” holy damage", () => {
  it("scales holy damage with gold when holyGoldPercent is active", () => {
    const state = patchBattleState({
      gold: 50,
      talentEffects: { ...defaultTalentEffects, holyGoldPercent: 10 },
    });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("scales holy damage with block when holyBlockPercent is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ block: 10 }),
      talentEffects: { ...defaultTalentEffects, holyBlockPercent: 20 },
    });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("amplifies holy damage against burning enemies with holyVsBurnMultiplier", () => {
    const state = patchBattleState({
      enemyStatuses: defaultEnemyStatusValues({ burn: 5 }),
      talentEffects: { ...defaultTalentEffects, holyVsBurnMultiplier: 0.5 },
    });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(30);
  });
});

describe("computeBaseDamage â€” bleed damage", () => {
  it("applies bleed desperate multiplier when player below half health", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, bleedDesperateMultiplier: 1.5 },
    });
    const card = makeCard({ effects: [makeEffect("bleed", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("applies bleed execute threshold multiplier", () => {
    const state = patchBattleState({
      enemyHealth: 5,
      enemyMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, bleedExecuteThreshold: 25 },
    });
    const card = makeCard({ effects: [makeEffect("bleed", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(0);
  });
});

describe("computeBaseDamage â€” archery tag", () => {
  it("adds flatArrowDamage to cards with the archery tag", () => {
    const state = patchBattleState({
      talentEffects: { ...defaultTalentEffects, flatArrowDamage: 3 },
    });
    const card = makeCard({
      tags: ["archery"],
      effects: [makeEffect("physical", 5)],
    });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(25);
  });
});

describe("computeBaseDamage â€” stun damage", () => {
  it("adds flatStunDamage to stun damage type", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      talentEffects: { ...defaultTalentEffects, flatStunDamage: 2 },
    });
    const card = makeCard({ effects: [makeEffect("stun", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // 5 base + 2 flat = 7 damage, no armor for stun
    expect(result.enemyHealth).toBe(23);
  });
});

describe("computeBaseDamage â€” physical vs statuses", () => {
  it("adds poisonPhysicalBonus against poisoned enemies", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      enemyStatuses: defaultEnemyStatusValues({ poison: 5 }),
      talentEffects: { ...defaultTalentEffects, poisonPhysicalBonus: 3 },
    });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // 5 base + 3 poison bonus = 8 damage, no armor
    expect(result.enemyHealth).toBe(22);
  });

  it("adds bleedPhysicalBonus against bleeding enemies", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      enemyStatuses: defaultEnemyStatusValues({ bleed: 5 }),
      talentEffects: { ...defaultTalentEffects, bleedPhysicalBonus: 2 },
    });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // 5 base + 2 bleedPhysicalBonus = 7 damage, no armor
    expect(result.enemyHealth).toBe(23);
  });

  it("amplifies physical damage against stunned enemies", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      enemyCC: defaultCcState({ stunSkipTurns: 1 }),
      talentEffects: { ...defaultTalentEffects, physicalDoubledVsStunned: true },
    });
    const card = makeCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // 10 * 2 = 20, no armor, health = 10
    expect(result.enemyHealth).toBe(10);
  });

  it("amplifies physical damage against frozen enemies", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      enemyCC: defaultCcState({ freezeSkipTurns: 1 }),
      talentEffects: { ...defaultTalentEffects, physicalDoubledVsFrozen: true },
    });
    const card = makeCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // 10 * 2 = 20, no armor, health = 10
    expect(result.enemyHealth).toBe(10);
  });
});

describe("applyFirstDamageModifiers", () => {
  it("increases first burn card damage by 50% when Wildfire talent active", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // no crit
    const state = patchBattleState({ talentEffects: { ...defaultTalentEffects, firstBurnCardDoubled: true } });
    const card = makeCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.flags.firstBurnCardDoubledUsed).toBe(true);
    expect(result.enemyHealth).toBe(22);
  });

  it("does not boost second burn card when Wildfire flag is used", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      talentEffects: { ...defaultTalentEffects, firstBurnCardDoubled: true },
      flags: defaultCombatFlags({ firstBurnCardDoubledUsed: true }),
    });
    const card = makeCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.flags.firstBurnCardDoubledUsed).toBe(true);
    expect(result.enemyHealth).toBe(25);
  });

  it("doubles first burn damage via boon effect", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({ trinketEffects: defaultTrinketManifest({ firstBurnDoubled: true }) });
    const card = makeCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.flags.firstBurnTrinketDoubledUsed).toBe(true);
  });

  it("doubles first holy damage when boon effect active", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({ trinketEffects: defaultTrinketManifest({ firstHolyDamageDoubled: true }) });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.flags.firstHolyDamageBonusUsed).toBe(true);
  });
});

describe("applyCrit", () => {
  it("applies crit multiplier when random rolls below threshold", () => {
    const state = patchBattleState({
      talentEffects: { ...defaultTalentEffects, physicalCritChance: 0 },
      rng: () => 0.01,
    });
    const card = makeCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(30 - Math.floor(10 * CRIT_MULTIPLIER));
  });

  it("stacks physical crit chance with global crit chance", () => {
    // Total = 5 + 10 = 15. rng() * 100 < 15 means rng() < 0.15
    const state = patchBattleState({
      talentEffects: { ...defaultTalentEffects, physicalCritChance: 10 },
      rng: () => 0.1,
    });
    const card = makeCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(30 - Math.floor(10 * CRIT_MULTIPLIER));
  });

  it("does not crit when random is above threshold", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState();
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(25);
  });
});

describe("applyForgeStunRider", () => {
  it("stuns enemy when forge meets boon threshold", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 5 }),
      trinketEffects: defaultTrinketManifest({ forgeStunThreshold: 4, forgeStunAmount: 2 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 15 }),
    });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
  });

  it("does not stun when forge is below threshold", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
      trinketEffects: defaultTrinketManifest({ forgeStunThreshold: 4, forgeStunAmount: 2 }),
    });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyCC.stunSkipTurns).toBe(0);
  });
});

describe("applyHolyDamageRiders", () => {
  it("heals player with holy lifesteal", () => {
    const state = patchBattleState({
      playerHealth: 20,
      talentEffects: { ...defaultTalentEffects, holyLifestealPercent: 50 },
    });
    const card = makeCard({ effects: [makeEffect("holy", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerHealth).toBeGreaterThan(20);
  });

  it("grants block from holy damage with holyBlockPercentFromDamage", () => {
    const state = patchBattleState({
      gold: 50,
      talentEffects: {
        ...patchBattleState().talentEffects,
        holyBlockPercentFromDamage: 25,
        holyGoldPercent: 10,
        holyLifestealPercent: 0,
      },
    });
    const card = makeCard({ effects: [makeEffect("holy", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.block).toBeGreaterThan(0);
  });

  it("applies burn on holy damage with holyBurnChance", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const state = patchBattleState({
      talentEffects: { ...defaultTalentEffects, holyBurnChance: 50, holyLifestealPercent: 0, holyGoldPercent: 0 },
    });
    const card = makeCard({ effects: [makeEffect("holy", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyStatuses.burn).toBeGreaterThan(0);
  });
});

describe("consumeForgeAfterDamage", () => {
  it("consumes 1 forge after physical damage", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ forge: 3 }) });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("consumes 1 forge after stun damage", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ forge: 3 }) });
    const card = makeCard({ effects: [makeEffect("stun", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("consumes 1 forge after burn damage when forgeToBurn talent is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 3 }),
      talentEffects: { ...defaultTalentEffects, forgeToBurn: true },
    });
    const card = makeCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("consumes 1 forge after holy damage when forgeToHoly talent is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 3 }),
      talentEffects: { ...defaultTalentEffects, forgeToHoly: true },
    });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("does not consume forge for burn damage without talent", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ forge: 3 }) });
    const card = makeCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(3);
  });

  it("does not consume forge for holy damage without talent", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ forge: 3 }) });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(3);
  });
});

describe("dealDamageToEnemy â€” lifesteal", () => {
  it("heals player when effect has lifesteal", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      playerHealth: 20,
      gold: 50,
      talentEffects: { ...defaultTalentEffects, healMultiplier: 0.5 },
    });
    const card = makeCard({ effects: [makeEffect("physical", 10, { lifesteal: true })] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerHealth).toBe(23);
  });
});

describe("dealDamageToEnemy â€” enemy armor", () => {
  it("physical damage is reduced by enemy armor", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({ enemyMitigation: { armor: 3, forge: 0, freezeBonus: 0, burnBonus: 0, block: 0 } });
    const card = makeCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // 10 damage, 3 armor from enemy
    expect(result.enemyHealth).toBe(30 - 10 + 3);
  });

  it("sunderingArmorPiercing removes enemy armor", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      enemyMitigation: { armor: 5, forge: 0, freezeBonus: 0, burnBonus: 0, block: 0 },
      trinketEffects: defaultTrinketManifest({ sunderingArmorPiercing: 2 }),
    });
    const card = makeCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // Sundering removes 2 â†’ armor 3, damage 10-3=7. Decay removes 1 â†’ final armor 2.
    expect(result.enemyHealth).toBe(23);
    expect(result.enemyMitigation.armor).toBe(2);
  });

  it("non-physical damage ignores enemy armor", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({ enemyMitigation: { armor: 5, forge: 0, freezeBonus: 0, burnBonus: 0, block: 0 } });
    const card = makeCard({ effects: [makeEffect("burn", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // Enemy armor only applies to physical damage. Burn deals full 10 damage.
    expect(result.enemyHealth).toBe(20);
  });
});

describe("dealDamageToEnemy â€” boonSiphon siphoning", () => {
  it("steals armor and gains armor for the player when armor is siphoned", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // bypass crit
    const state = patchBattleState({
      enemyMitigation: { armor: 5, block: 0, forge: 0, freezeBonus: 0, burnBonus: 0 },
      talentEffects: { ...defaultTalentEffects, trinketSiphonChance: 100 },
      rng: () => 0.1,
    });
    const card = makeCard({ effects: [makeEffect("physical", 10, { lifesteal: true })] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // Base damage = 10. Armor = 5.
    // Lifesteal runs on 10 - 5 = 5 damage.
    // Siphon runs: pool contains armor (5 > 0). Siphons armor.
    // Armor becomes 4. Decays 1 on hit -> 3. Player armor becomes 1.
    expect(result.enemyMitigation.armor).toBe(3);
    expect(result.playerStatuses.armor).toBe(1);
  });

  it("steals forge and gains forge for the player when forge is siphoned", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      enemyMitigation: { armor: 0, block: 0, forge: 3, freezeBonus: 0, burnBonus: 0 },
      talentEffects: { ...defaultTalentEffects, trinketSiphonChance: 100 },
      rng: () => 0.0,
    });
    const card = makeCard({ effects: [makeEffect("nature", 10, { lifesteal: true })] });
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      makeTexts(),
    );
    // Base damage = 10. Forge = 3.
    // Pool contains forge. Forge siphoned.
    // Forge becomes 2. Player forge becomes 1 (nature doesn't consume forge).
    expect(result.enemyMitigation.forge).toBe(2);
    expect(result.playerStatuses.forge).toBe(1);
  });
});

describe("dealDamageToEnemy â€” edge cases", () => {
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
      enemyMitigation: { armor: 0, forge: 0, freezeBonus: 0, burnBonus: 0, block: 0 },
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
    expect(result.playerStatuses.forge).toBe(0); // forge not consumed
  });
});
