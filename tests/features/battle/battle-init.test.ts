import { describe, expect, it, beforeEach, vi } from "vitest";
import { createBattleInit } from "@/features/alchemy/run-loop/battle/battle-init";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { computeTalentEffects } from "@/lib/game-data";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { enemyBestiary } from "@/lib/game-data";
import { makeRunController, makeTalentController } from "../../helpers/run-controller";
import {
  getBattleStoreView,
  getRunProgressStoreView,
  resetRunBattleSlice,
  resetRunProgressSlice,
  setRunProgress,
} from "../../helpers/run-domain-store-test";

beforeEach(() => {
  resetRunBattleSlice();
  resetRunProgressSlice();
});

describe("createBattleInit", () => {
  const homesteadEffectsRef = { current: defaultHomesteadEffects };
  const resetBattleSession = vi.fn();
  const setCardTransfers = vi.fn();
  const setHiddenHandCardKeys = vi.fn();
  const setCardTransferInProgress = vi.fn();

  function makeInit() {
    return createBattleInit({
      run: makeRunController(),
      talents: makeTalentController(),
      homesteadEffectsRef,
      resetBattleSession,
      setCardTransfers,
      setHiddenHandCardKeys,
      setCardTransferInProgress,
    });
  }

  it("merges talent and homestead manifests into battle state", () => {
    setRunProgress({ roomsEncountered: 0, runPlayerHealth: 30, runMaxHealth: 30 });
    homesteadEffectsRef.current = { ...defaultHomesteadEffects, flatPhysicalDamage: 2 };

    makeInit().startBattle(getRunProgressStoreView().runDeck, 0, "normal");

    const battle = getBattleStoreView().battleState;
    const expected = mergeIntoManifest(computeTalentEffects({}), homesteadEffectsRef.current);
    expect(battle.talentEffects.flatPhysicalDamage).toBe(expected.flatPhysicalDamage);
    expect(battle.currentEnemy.enemyType).toBe("normal");
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

  it("appends the persisted Wildwood modifier to a boss encounter", () => {
    makeInit().startBossById("forge-golem", undefined, "wildwood-modifier-verdant");

    expect(getBattleStoreView().battleState.currentEnemy.traits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "wildwood-modifier-verdant",
          description: expect.stringContaining("No combat effect yet"),
        }),
      ]),
    );
  });
});
