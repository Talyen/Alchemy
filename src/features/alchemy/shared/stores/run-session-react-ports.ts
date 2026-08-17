// React-facing capability ports over the authoritative gameplay aggregate.
// Keep these selectors narrow so controllers subscribe only to their domain.
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  computeTalentEffects,
  type BattleCard,
  type CharacterId,
  type DifficultyId,
  type TalentEffectManifest,
  type TalentXP,
  type UnlockedTalents,
} from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { Screen } from "@/lib/routing";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { DisplayOverrides } from "./run-domain-types";
import { pickActiveRunFields } from "./run-state-init";
import { useGameplayStateStore } from "./gameplay-state-store";
import {
  awardCardXP,
  setCompletedDestinations,
  setCurrentAct,
  setDestinationIndexInAct,
  setDestinationOfferState,
  setEncounteredRunEnemyIds,
  setRunDeck,
  setRunPlayerHealth,
  setRunTrinkets,
  setRoomsEncountered,
  setScreen,
} from "./run-session-write-port";
import type {
  BattleRunPort,
  BattleTalentPort,
  ContentNavigationTalentPort,
  RunFlowTalentPort,
  RunOrchestrationPort,
} from "./run-port-types";
import { createRunSessionCommand } from "./run-session-command";
import { selectAutosaveAllowed } from "./select-autosave-allowed";
import { setHasActiveBattle as setHasActiveBattleCommand } from "./run-session-write-port";

const commandSetCurrentAct = createRunSessionCommand(setCurrentAct);
const commandSetDestinationIndexInAct = createRunSessionCommand(setDestinationIndexInAct);
const commandSetCompletedDestinations = createRunSessionCommand(setCompletedDestinations);
const commandSetRoomsEncountered = createRunSessionCommand(setRoomsEncountered);
const commandSetRunDeck = createRunSessionCommand(setRunDeck);
const commandSetRunTrinkets = createRunSessionCommand(setRunTrinkets);
const commandSetRunPlayerHealth = createRunSessionCommand(setRunPlayerHealth);
const commandSetDestinationOfferState = createRunSessionCommand(setDestinationOfferState);
const commandSetEncounteredRunEnemyIds = createRunSessionCommand(setEncounteredRunEnemyIds);
const commandSetScreen = createRunSessionCommand(setScreen);
const commandSetHasActiveBattle = createRunSessionCommand(setHasActiveBattleCommand);

export function useTalentEffects(): TalentEffectManifest {
  const unlockedTalents = useGameplayStateStore((state) => state.runProfile.unlockedTalents);
  return useMemo(() => computeTalentEffects(unlockedTalents), [unlockedTalents]);
}

/** Single orchestration subscription for run-flow, content-nav, destinations, and wildwood. */
export function useRunOrchestrationPort(): RunOrchestrationPort {
  return useGameplayStateStore(
    useShallow((state) => ({
      ...pickActiveRunFields(state.run.activeRun),
      updateCurrentAct: commandSetCurrentAct,
      updateDestinationIndexInAct: commandSetDestinationIndexInAct,
      updateCompletedDestinations: commandSetCompletedDestinations,
      updateRoomsEncountered: commandSetRoomsEncountered,
      updateRunDeck: commandSetRunDeck,
      updateRunTrinkets: commandSetRunTrinkets,
      updateRunPlayerHealth: commandSetRunPlayerHealth,
      updateDestinationOfferState: commandSetDestinationOfferState,
    })),
  );
}

export function useBattleRunPort(): BattleRunPort {
  return useGameplayStateStore(
    useShallow((state) => ({
      characterId: state.run.activeRun.characterId,
      selectedDifficulty: state.run.activeRun.selectedDifficulty,
      runMaxHealth: state.run.activeRun.runMaxHealth,
      runTrinkets: state.run.activeRun.runTrinkets,
      roomsEncountered: state.run.activeRun.roomsEncountered,
      updateRoomsEncountered: commandSetRoomsEncountered,
      contentSystemType: state.run.activeRun.contentSystemType,
      encounteredRunEnemyIds: state.run.activeRun.encounteredRunEnemyIds,
      updateEncounteredRunEnemyIds: commandSetEncounteredRunEnemyIds,
      runDeck: state.run.activeRun.runDeck,
      runGold: state.run.activeRun.runGold,
    })),
  );
}

export function useBattleTalentPort(): BattleTalentPort {
  const talentEffects = useTalentEffects();
  return useMemo(() => ({ talentEffects, awardCardXP }), [talentEffects]);
}

export function useRunFlowTalentPort(talentEffects: TalentEffectManifest): RunFlowTalentPort {
  return useMemo(() => ({ talentEffects: { campfireHealBonus: talentEffects.campfireHealBonus } }), [talentEffects]);
}

export function useContentNavigationTalentPort(
  talentEffects: TalentEffectManifest,
  talentXP: TalentXP,
): ContentNavigationTalentPort {
  return useMemo(
    () => ({ talentXP, talentEffects: { startGold: talentEffects.startGold } }),
    [talentEffects, talentXP],
  );
}

export function useActiveRunScreen() {
  return useGameplayStateStore(
    useShallow((state) => ({
      screen: state.run.navigation.screen,
      setScreen: commandSetScreen,
    })),
  );
}

export function useActiveRunScreenValue(): Screen {
  return useGameplayStateStore((state) => state.run.navigation.screen);
}

export function useAutosaveAllowed(screen: Screen): boolean {
  return useGameplayStateStore((state) => selectAutosaveAllowed(state, screen));
}

export function useHasActiveBattle(): boolean {
  return useGameplayStateStore((state) => state.battle.hasActiveBattle);
}

export function useHasActiveRun(): boolean {
  return useGameplayStateStore((state) => state.session.hasActiveRun);
}

export function useDisplayOverrides(): DisplayOverrides {
  return useGameplayStateStore((state) => state.battle.displayOverrides);
}

export function useSetHasActiveBattle(): (active: boolean) => void {
  return commandSetHasActiveBattle;
}

export function useBondedCompanions() {
  return useGameplayStateStore((state) => state.runProfile.bondedCompanions);
}

export function useContentSystemType(): ContentSystemId {
  return useGameplayStateStore((state) => state.run.activeRun.contentSystemType);
}

export function useIsWildwoodRun(): boolean {
  return useGameplayStateStore((state) => state.run.activeRun.contentSystemType === "wildwood");
}

export function useHomesteadProgressSlice() {
  return useGameplayStateStore(
    useShallow((state) => ({
      gold: state.runProfile.gold,
      materialInventory: state.runProfile.materialInventory,
      constructedBuildings: state.runProfile.constructedBuildings,
      plantedFarms: state.runProfile.plantedFarms,
      completedResearch: state.runProfile.completedResearch,
      bondedCompanions: state.runProfile.bondedCompanions,
    })),
  );
}

export function useHomesteadEffects() {
  return useGameplayStateStore((state) => state.runProfile.effects);
}

export function useTalentProgressSlice(): { talentXP: TalentXP; unlockedTalents: UnlockedTalents } {
  return useGameplayStateStore(
    useShallow((state) => ({
      talentXP: state.runProfile.talentXP,
      unlockedTalents: state.runProfile.unlockedTalents,
    })),
  );
}

export function useDifficultySelectSlice(): {
  pendingCharacterId: CharacterId | null;
  selectedDifficulty: DifficultyId | null;
} {
  return useGameplayStateStore(
    useShallow((state) => ({
      pendingCharacterId: state.session.pendingCharacterId,
      selectedDifficulty: state.run.activeRun.selectedDifficulty,
    })),
  );
}

export function useDraftDeckSlice(): {
  contentSystemType: ContentSystemId;
  runDeck: BattleCard[];
  wildwoodDraft: WildwoodDraftState | null;
} {
  return useGameplayStateStore(
    useShallow((state) => ({
      contentSystemType: state.run.activeRun.contentSystemType,
      runDeck: state.run.activeRun.runDeck,
      wildwoodDraft: state.session.wildwoodDraft,
    })),
  );
}

export function useActiveRunCharacterId(): CharacterId {
  return useGameplayStateStore((state) => state.run.activeRun.characterId);
}

export function useActiveRunTrinkets(): string[] {
  return useGameplayStateStore((state) => state.run.activeRun.runTrinkets);
}
