import { describe, expect, it } from "vitest";
import { enemyBestiary } from "@/lib/game-data";
import {
  collectUncoveredDifficultyModifierKinds,
  collectUncoveredEnemyTraitIds,
  DIFFICULTY_TURN_START_MODIFIER_KINDS,
  ENEMY_TRAIT_TURN_START_HANDLER_IDS,
  PASSIVE_ONLY_DIFFICULTY_MODIFIER_KINDS,
  PASSIVE_ONLY_ENEMY_TRAIT_IDS,
  processEnemyRegeneration,
  processEnemyTraits,
} from "@/lib/battle/enemy-turn-traits";
import {
  DIFFICULTY_FORGE_PER_TURN,
  IRON_HIDE_ARMOR_PER_TURN,
  IRON_HIDE_BURN_BONUS_PER_TURN,
  TRAIT_FORGE_PER_TURN,
  TRAIT_FREEZE_BONUS_PER_TURN,
} from "@/lib/game-constants";
import { createTestBattleState } from "./test-state";

describe("enemy turn trait coverage", () => {
  it("documents every active trait handler and passive-only allowlist entry", () => {
    const bestiaryTraitIds = enemyBestiary.flatMap((enemy) => enemy.traits.map((trait) => trait.id));
    const uncoveredTraits = collectUncoveredEnemyTraitIds(bestiaryTraitIds);
    expect(uncoveredTraits, `Missing handler or PASSIVE_ONLY entry for: ${uncoveredTraits.join(", ")}`).toEqual(
      [],
    );
  });

  it("documents every difficulty modifier kind with handler or passive-only entry", () => {
    const uncoveredKinds = collectUncoveredDifficultyModifierKinds();
    expect(uncoveredKinds, `Missing handler or PASSIVE_ONLY entry for: ${uncoveredKinds.join(", ")}`).toEqual([]);
  });

  it("keeps handler and passive allowlists disjoint", () => {
    const traitOverlap = ENEMY_TRAIT_TURN_START_HANDLER_IDS.filter((id) =>
      PASSIVE_ONLY_ENEMY_TRAIT_IDS.includes(id),
    );
    const modifierOverlap = DIFFICULTY_TURN_START_MODIFIER_KINDS.filter((kind) =>
      PASSIVE_ONLY_DIFFICULTY_MODIFIER_KINDS.includes(kind),
    );
    expect(traitOverlap).toEqual([]);
    expect(modifierOverlap).toEqual([]);
  });
});

describe("processEnemyRegeneration", () => {
  it("heals enemy when regeneration is active and not frozen for regen", () => {
    const state = createTestBattleState({
      enemyHealth: 20,
      enemyMaxHealth: 30,
      enemyRegeneration: 3,
      enemyFreezeSkipTurns: 0,
    });
    const texts: Parameters<typeof processEnemyRegeneration>[1] = [];
    const result = processEnemyRegeneration(state, texts);
    expect(result.enemyHealth).toBe(23);
    expect(texts.some((t) => t.kind === "heal")).toBe(true);
  });

  it("no-ops when freeze blocks regen", () => {
    const state = createTestBattleState({
      enemyHealth: 20,
      enemyMaxHealth: 30,
      enemyRegeneration: 3,
      enemyFreezeSkipTurns: 1,
      talentEffects: {
        ...createTestBattleState().talentEffects,
        freezeBlocksRegen: true,
      },
    });
    const result = processEnemyRegeneration(state, []);
    expect(result.enemyHealth).toBe(20);
  });
});

describe("processEnemyTraits", () => {
  const forgeGolem = enemyBestiary.find((e) => e.id === "forge-golem")!;
  const ironBear = enemyBestiary.find((e) => e.id === "iron-bear")!;
  const frostwarden = enemyBestiary.find((e) => e.id === "frostwarden")!;
  const skeleton = enemyBestiary.find((e) => e.id === "skeleton")!;

  it("applies rusting-carapace forge scaled by room multiplier", () => {
    const state = createTestBattleState({
      currentEnemy: forgeGolem,
      roomScalingMultiplier: 2,
      enemyMitigation: { ...createTestBattleState().enemyMitigation, forge: 0 },
    });
    const result = processEnemyTraits(state, [], { traitRoll: 0 });
    expect(result.enemyMitigation.forge).toBe(TRAIT_FORGE_PER_TURN * 2);
  });

  it("iron-hide chooses armor when traitRoll is 0", () => {
    const state = createTestBattleState({
      currentEnemy: ironBear,
      roomScalingMultiplier: 1,
    });
    const texts: Parameters<typeof processEnemyRegeneration>[1] = [];
    const result = processEnemyTraits(state, texts, { traitRoll: 0 });
    expect(result.enemyMitigation.armor).toBe(IRON_HIDE_ARMOR_PER_TURN);
    expect(texts).toContainEqual({
      target: "enemy",
      kind: "status",
      stat: "armor",
      amount: IRON_HIDE_ARMOR_PER_TURN,
    });
  });

  it("iron-hide chooses forge when traitRoll is in the middle third", () => {
    const state = createTestBattleState({ currentEnemy: ironBear, roomScalingMultiplier: 1 });
    const texts: Parameters<typeof processEnemyRegeneration>[1] = [];
    const result = processEnemyTraits(state, texts, { traitRoll: 0.4 });
    expect(result.enemyMitigation.forge).toBe(TRAIT_FORGE_PER_TURN);
    expect(texts).toContainEqual({
      target: "enemy",
      kind: "status",
      stat: "forge",
      amount: TRAIT_FORGE_PER_TURN,
    });
  });

  it("iron-hide chooses burn bonus when traitRoll is in the upper third", () => {
    const state = createTestBattleState({ currentEnemy: ironBear, roomScalingMultiplier: 1 });
    const texts: Parameters<typeof processEnemyRegeneration>[1] = [];
    const result = processEnemyTraits(state, texts, { traitRoll: 0.9 });
    expect(result.enemyMitigation.burnBonus).toBe(IRON_HIDE_BURN_BONUS_PER_TURN);
    expect(texts.some((t) => t.kind === "notice" && t.stat === "burn")).toBe(true);
  });

  it("applies glacial-shell freeze bonus", () => {
    const state = createTestBattleState({ currentEnemy: frostwarden, roomScalingMultiplier: 1 });
    const result = processEnemyTraits(state, [], { traitRoll: 0 });
    expect(result.enemyMitigation.freezeBonus).toBe(TRAIT_FREEZE_BONUS_PER_TURN);
  });

  it("applies enemy-gains-forge-each-turn difficulty modifier", () => {
    const state = createTestBattleState({
      currentEnemy: skeleton,
      difficultyModifiers: [{ kind: "enemy-gains-forge-each-turn", amount: 1 }],
    });
    const texts: Parameters<typeof processEnemyRegeneration>[1] = [];
    const result = processEnemyTraits(state, texts);
    expect(result.enemyMitigation.forge).toBe(DIFFICULTY_FORGE_PER_TURN);
    expect(texts).toContainEqual({
      target: "enemy",
      kind: "status",
      stat: "forge",
      amount: DIFFICULTY_FORGE_PER_TURN,
    });
  });

  it("skips scaling traits when freeze prevents enemy scaling", () => {
    const state = createTestBattleState({
      currentEnemy: forgeGolem,
      enemyFreezeSkipTurns: 1,
      enemyMitigation: { ...createTestBattleState().enemyMitigation, forge: 0 },
      talentEffects: { ...createTestBattleState().talentEffects, freezePreventsEnemyScaling: true },
    });
    const result = processEnemyTraits(state, [], { traitRoll: 0 });
    expect(result.enemyMitigation.forge).toBe(0);
  });

  it("does not run handlers for passive-only regeneration trait", () => {
    const blightTreant = enemyBestiary.find((e) => e.id === "blight-treant")!;
    const state = createTestBattleState({
      currentEnemy: blightTreant,
      enemyMitigation: { ...createTestBattleState().enemyMitigation, forge: 0 },
    });
    const result = processEnemyTraits(state, [], { traitRoll: 0 });
    expect(result.enemyMitigation.forge).toBe(0);
  });

  it("applies trait and difficulty handlers in one pass", () => {
    const state = createTestBattleState({
      currentEnemy: forgeGolem,
      roomScalingMultiplier: 1,
      difficultyModifiers: [{ kind: "enemy-gains-forge-each-turn", amount: 1 }],
      enemyMitigation: { ...createTestBattleState().enemyMitigation, forge: 0 },
    });
    const result = processEnemyTraits(state, [], { traitRoll: 0 });
    expect(result.enemyMitigation.forge).toBe(TRAIT_FORGE_PER_TURN + DIFFICULTY_FORGE_PER_TURN);
  });
});
