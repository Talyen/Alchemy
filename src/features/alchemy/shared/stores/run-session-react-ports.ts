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
  unlockTalent,
  resetUnlockedTalents,
} from "./run-session-write-port";
import type {
  BattleRunPort,
  BattleTalentPort,
  ContentNavigationRunPort,
  ContentNavigationTalentPort,
  CorruptionRunPort,
  DestinationRunPort,
  RunFlowRunPort,
  RunFlowTalentPort,
  TalentCommandPort,
  WildwoodRunPort,
} from "./run-port-types";
import { setHasActiveBattle as setHasActiveBattleCommand } from "./ports/run-battle-write-port";

export function useTalentEffects(): TalentEffectManifest {
  const unlockedTalents = useGameplayStateStore((state) => state.runProfile.unlockedTalents);
  return useMemo(() => computeTalentEffects(unlockedTalents), [unlockedTalents]);
}

export function useRunFlowRunPort(): RunFlowRunPort {
  return useGameplayStateStore(
    useShallow((state) => ({
      contentSystemType: state.run.activeRun.contentSystemType,
      currentAct: state.run.activeRun.currentAct,
      selectedDifficulty: state.run.activeRun.selectedDifficulty,
      characterId: state.run.activeRun.characterId,
      runMaxHealth: state.run.activeRun.runMaxHealth,
      updateCurrentAct: setCurrentAct,
      updateDestinationIndexInAct: setDestinationIndexInAct,
      updateCompletedDestinations: setCompletedDestinations,
      updateRoomsEncountered: setRoomsEncountered,
      updateRunDeck: setRunDeck,
      updateRunTrinkets: setRunTrinkets,
      updateRunPlayerHealth: setRunPlayerHealth,
    })),
  );
}

export function useRunFlowTalentPort(): RunFlowTalentPort {
  const talentEffects = useTalentEffects();
  return useMemo(() => ({ talentEffects: { campfireHealBonus: talentEffects.campfireHealBonus } }), [talentEffects]);
}

export function useBattleRunPort(): BattleRunPort {
  return useGameplayStateStore(
    useShallow((state) => ({
      characterId: state.run.activeRun.characterId,
      selectedDifficulty: state.run.activeRun.selectedDifficulty,
      runMaxHealth: state.run.activeRun.runMaxHealth,
      runTrinkets: state.run.activeRun.runTrinkets,
      roomsEncountered: state.run.activeRun.roomsEncountered,
      updateRoomsEncountered: setRoomsEncountered,
      contentSystemType: state.run.activeRun.contentSystemType,
      encounteredRunEnemyIds: state.run.activeRun.encounteredRunEnemyIds,
      updateEncounteredRunEnemyIds: setEncounteredRunEnemyIds,
      runDeck: state.run.activeRun.runDeck,
      runGold: state.run.activeRun.runGold,
    })),
  );
}

export function useBattleTalentPort(): BattleTalentPort {
  const talentEffects = useTalentEffects();
  return useMemo(() => ({ talentEffects, awardCardXP }), [talentEffects]);
}

export function useTalentCommandPort(): TalentCommandPort {
  return useMemo(() => ({ unlockTalent, resetUnlockedTalents }), []);
}

export function useContentNavigationRunPort(): ContentNavigationRunPort {
  return useGameplayStateStore(
    useShallow((state) => ({
      contentSystemType: state.run.activeRun.contentSystemType,
      lastOfferedDestinations: state.run.activeRun.lastOfferedDestinations,
      destinationRoundsSinceOffered: state.run.activeRun.destinationRoundsSinceOffered,
      updateDestinationOfferState: setDestinationOfferState,
    })),
  );
}

export function useContentNavigationTalentPort(): ContentNavigationTalentPort {
  const talentEffects = useTalentEffects();
  const talentXP = useGameplayStateStore((state) => state.runProfile.talentXP);
  return useMemo(
    () => ({ talentXP, talentEffects: { startGold: talentEffects.startGold } }),
    [talentEffects, talentXP],
  );
}

export function useDestinationRunPort(): DestinationRunPort {
  return useGameplayStateStore(
    useShallow((state) => ({
      destinationIndexInAct: state.run.activeRun.destinationIndexInAct,
      completedDestinations: state.run.activeRun.completedDestinations,
      runPlayerHealth: state.run.activeRun.runPlayerHealth,
      runGold: state.run.activeRun.runGold,
      runMaxHealth: state.run.activeRun.runMaxHealth,
    })),
  );
}

export function useWildwoodRunPort(): WildwoodRunPort {
  return useGameplayStateStore(
    useShallow((state) => ({
      contentSystemType: state.run.activeRun.contentSystemType,
      characterId: state.run.activeRun.characterId,
      runDeck: state.run.activeRun.runDeck,
      updateRunDeck: setRunDeck,
    })),
  );
}

export function useCorruptionRunPort(): CorruptionRunPort {
  return useGameplayStateStore(
    useShallow((state) => ({
      runDeck: state.run.activeRun.runDeck,
      updateRunDeck: setRunDeck,
    })),
  );
}

export function useActiveRunScreen() {
  return useGameplayStateStore(
    useShallow((state) => ({
      screen: state.run.navigation.screen,
      setScreen,
    })),
  );
}

export function useActiveRunScreenValue(): Screen {
  return useGameplayStateStore((state) => state.run.navigation.screen);
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
  return setHasActiveBattleCommand;
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
