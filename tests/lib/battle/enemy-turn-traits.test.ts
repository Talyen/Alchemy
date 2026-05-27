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
} from "@/lib/battle/enemy-turn-traits";
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
