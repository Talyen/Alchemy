import { describe, expect, it, beforeEach, vi } from "vitest";
import { createBattleInit } from "@/features/alchemy/run-loop/battle/battle-init";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { computeTalentEffects } from "@/lib/game-data";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { enemyBestiary } from "@/lib/game-data";
import { makeRunController, makeTalentController } from "../../../../helpers/run-controller";
import {
  getBattleStoreView,
  getRunProgressStoreView,
  resetRunBattleSlice,
  resetRunProgressSlice,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";

beforeEach(() => {
  resetRunBattleSlice();
  resetRunProgressSlice();
});

import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import type { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";

describe("createBattleInit", () => {
  const resetBattleSession = vi.fn();

  function makeInit(homesteadEffects: HomesteadEffectManifest = defaultHomesteadEffects) {
    const ctx = {
      run: makeRunController(),
      talents: makeTalentController(),
      homesteadEffects,
    } as unknown as BattleControllerContext;

    const session = {
      resetBattleSession,
    } as unknown as ReturnType<typeof createBattleSession>;

    return createBattleInit(ctx, session);
  }

  it("merges talent and homestead manifests into battle state", () => {
    setRunProgress({ roomsEncountered: 0, runPlayerHealth: 30, runMaxHealth: 30 });
    const testEffects = { ...defaultHomesteadEffects, flatPhysicalDamage: 2 };

    makeInit(testEffects).startBattle(getRunProgressStoreView().runDeck, 0, "normal");

    const battle = getBattleStoreView().battleState;
    const expected = mergeIntoManifest(computeTalentEffects({}), testEffects);
    expect(battle.talentEffects.flatPhysicalDamage).toBe(expected.flatPhysicalDamage);
    expect(battle.currentEnemy.enemyType).toBe("normal");
    // createBattleInit must wire its rng into BattleState (not placeholderRng).
    expect(typeof battle.rng()).toBe("number");
  });

  it("beginBattle increments roomsEncountered and sets hasActiveBattle", () => {
    setRunProgress({ roomsEncountered: 2, runPlayerHealth: 25, runMaxHealth: 30 });

    makeInit().startBattle(getRunProgressStoreView().runDeck, 10, "normal");

    const enemyId = getBattleStoreView().battleState.currentEnemy.id;
    expect(getRunProgressStoreView().roomsEncountered).toBe(3);
    expect(getBattleStoreView().hasActiveBattle).toBe(true);
    expect(getRunProgressStoreView().encounteredRunEnemyIds).toContain(enemyId);
    expect(resetBattleSession).toHaveBeenCalled();
  });

  it("appendUnique avoids duplicate encountered enemy ids", () => {
    const skeleton = enemyBestiary.find((e) => e.id === "skeleton")!;
    setRunProgress({
      encounteredRunEnemyIds: [skeleton.id],
      roomsEncountered: 1,
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });

    makeInit().startBattle(getRunProgressStoreView().runDeck, 0, "normal");

    const ids = getRunProgressStoreView().encounteredRunEnemyIds;
    expect(ids.filter((id) => id === skeleton.id)).toHaveLength(1);
  });

  it("appends the persisted Wildwood combat trait to a boss encounter", () => {
    makeInit().startBossById("forge-golem", undefined, "tempered");

    expect(getBattleStoreView().battleState.currentEnemy.traits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "tempered",
          description: "Gains 1 Forge each turn",
        }),
      ]),
    );
  });

  it("reads live run state when a battle starts inside another command", () => {
    const templateCard = getRunProgressStoreView().runDeck[0]!;
    setRunProgress({
      runDeck: [{ ...templateCard, id: "stale-card" }],
      runGold: 3,
      roomsEncountered: 1,
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });
    const init = makeInit();
    const freshCard = { ...templateCard, id: "fresh-card" };

    setRunProgress({ runDeck: [freshCard], runGold: 27, roomsEncountered: 4 });
    init.startBossById("forge-golem");

    const battle = getBattleStoreView().battleState;
    expect([...battle.hand, ...battle.deck, ...battle.discard, ...battle.exhausted].map((card) => card.id)).toEqual([
      "fresh-card",
    ]);
    expect(battle.gold).toBe(27);
    expect(getRunProgressStoreView().roomsEncountered).toBe(5);
  });
});
