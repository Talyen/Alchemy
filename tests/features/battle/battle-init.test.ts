import { describe, expect, it, beforeEach, vi } from "vitest";
import { createBattleInit } from "@/features/alchemy/battle/battle-init";
import { useBattleStore } from "@/features/alchemy/stores/battle-store";
import { useRunStore } from "@/features/alchemy/stores/run-store";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { computeTalentEffects } from "@/lib/game-data";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { enemyBestiary } from "@/lib/game-data";
import type { RunStateController, TalentStateController } from "@/features/alchemy/stores/run-store";

beforeEach(() => {
  useBattleStore.setState(useBattleStore.getInitialState());
  useRunStore.setState(useRunStore.getInitialState());
});

function makeRunController(): RunStateController {
  const s = useRunStore.getState();
  return {
    characterId: s.characterId,
    runDeck: s.runDeck,
    runGold: s.runGold,
    runPlayerHealth: s.runPlayerHealth,
    runMaxHealth: s.runMaxHealth,
    roomsEncountered: s.roomsEncountered,
    currentAct: s.currentAct,
    destinationIndexInAct: s.destinationIndexInAct,
    completedDestinations: s.completedDestinations,
    runTrinkets: s.runTrinkets,
    encounteredRunEnemyIds: s.encounteredRunEnemyIds,
    selectedDifficulty: s.selectedDifficulty,
    contentSystemType: s.contentSystemType,
    setRunDeck: s.setRunDeck,
    setRunGold: s.setRunGold,
    setRunPlayerHealth: s.setRunPlayerHealth,
    setRunMaxHealth: s.setRunMaxHealth,
    setRoomsEncountered: s.setRoomsEncountered,
    setCurrentAct: s.setCurrentAct,
    setDestinationIndexInAct: s.setDestinationIndexInAct,
    setCompletedDestinations: s.setCompletedDestinations,
    setRunTrinkets: s.setRunTrinkets,
    setEncounteredRunEnemyIds: s.setEncounteredRunEnemyIds,
    setSelectedDifficulty: s.setSelectedDifficulty,
    setContentSystemType: s.setContentSystemType,
    setCharacter: s.setCharacter,
    reset: s.reset,
    addRunGold: s.addRunGold,
    hydrateFromSnapshot: s.hydrateFromSnapshot,
  };
}

function makeTalentController(): TalentStateController {
  const s = useRunStore.getState();
  return {
    talentXP: s.talentXP,
    runTalentXP: s.runTalentXP,
    unlockedTalents: s.unlockedTalents,
    talentEffects: computeTalentEffects(s.unlockedTalents),
    awardCardXP: s.awardCardXP,
    unlockTalent: s.unlockTalent,
    unlockAllTalents: s.unlockAllTalents,
    resetUnlockedTalents: s.resetUnlockedTalents,
    resetRunXP: s.resetRunXP,
    clearPermanentData: s.clearPermanentData,
    awardMysteryXP: s.awardMysteryXP,
    finalizeRunXP: s.finalizeRunXP,
  };
}

describe("createBattleInit", () => {
  const homesteadEffectsRef = { current: defaultHomesteadEffects };
  const setEncounteredEnemyIds = vi.fn();
  const resetBattleSession = vi.fn();
  const setCardTransfers = vi.fn();
  const setHiddenHandCardKeys = vi.fn();
  const setCardTransferInProgress = vi.fn();

  function makeInit() {
    return createBattleInit({
      run: makeRunController(),
      talents: makeTalentController(),
      discoveredCardIds: [],
      homesteadEffectsRef,
      setEncounteredEnemyIds,
      resetBattleSession,
      setCardTransfers,
      setHiddenHandCardKeys,
      setCardTransferInProgress,
    });
  }

  it("merges talent and homestead manifests into battle state", () => {
    useRunStore.setState({ roomsEncountered: 0, runPlayerHealth: 30, runMaxHealth: 30 });
    homesteadEffectsRef.current = { ...defaultHomesteadEffects, flatPhysicalDamage: 2 };

    makeInit().startBattle(useRunStore.getState().runDeck, 0, "normal");

    const battle = useBattleStore.getState().battleState;
    const expected = mergeIntoManifest(computeTalentEffects({}), homesteadEffectsRef.current);
    expect(battle.talentEffects.flatPhysicalDamage).toBe(expected.flatPhysicalDamage);
    expect(battle.currentEnemy.enemyType).toBe("normal");
  });

  it("beginBattle increments roomsEncountered and sets hasActiveBattle", () => {
    useRunStore.setState({ roomsEncountered: 2, runPlayerHealth: 25, runMaxHealth: 30 });

    makeInit().startBattle(useRunStore.getState().runDeck, 10, "normal");

    const enemyId = useBattleStore.getState().battleState.currentEnemy.id;
    expect(useRunStore.getState().roomsEncountered).toBe(3);
    expect(useBattleStore.getState().hasActiveBattle).toBe(true);
    expect(useRunStore.getState().encounteredRunEnemyIds).toContain(enemyId);
    expect(resetBattleSession).toHaveBeenCalled();
  });

  it("appendUnique avoids duplicate encountered enemy ids", () => {
    const skeleton = enemyBestiary.find((e) => e.id === "skeleton")!;
    useRunStore.setState({
      encounteredRunEnemyIds: [skeleton.id],
      roomsEncountered: 1,
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });

    makeInit().startBattle(useRunStore.getState().runDeck, 0, "normal");

    const ids = useRunStore.getState().encounteredRunEnemyIds;
    expect(ids.filter((id) => id === skeleton.id)).toHaveLength(1);
  });
});
