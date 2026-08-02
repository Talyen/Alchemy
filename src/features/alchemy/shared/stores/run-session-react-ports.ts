// React-facing capability ports over the committed gameplay projection.
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
import { useRunSessionCommitStore } from "./run-session-transaction";
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
  const unlockedTalents = useRunSessionCommitStore((state) => state.snapshot.runProfile.unlockedTalents);
  return useMemo(() => computeTalentEffects(unlockedTalents), [unlockedTalents]);
}

export function useRunFlowRunPort(): RunFlowRunPort {
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      contentSystemType: snapshot.domain.activeRun.contentSystemType,
      currentAct: snapshot.domain.activeRun.currentAct,
      selectedDifficulty: snapshot.domain.activeRun.selectedDifficulty,
      characterId: snapshot.domain.activeRun.characterId,
      runMaxHealth: snapshot.domain.activeRun.runMaxHealth,
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
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      characterId: snapshot.domain.activeRun.characterId,
      selectedDifficulty: snapshot.domain.activeRun.selectedDifficulty,
      runMaxHealth: snapshot.domain.activeRun.runMaxHealth,
      runTrinkets: snapshot.domain.activeRun.runTrinkets,
      roomsEncountered: snapshot.domain.activeRun.roomsEncountered,
      updateRoomsEncountered: setRoomsEncountered,
      contentSystemType: snapshot.domain.activeRun.contentSystemType,
      encounteredRunEnemyIds: snapshot.domain.activeRun.encounteredRunEnemyIds,
      updateEncounteredRunEnemyIds: setEncounteredRunEnemyIds,
      runDeck: snapshot.domain.activeRun.runDeck,
      runGold: snapshot.domain.activeRun.runGold,
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
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      contentSystemType: snapshot.domain.activeRun.contentSystemType,
      lastOfferedDestinations: snapshot.domain.activeRun.lastOfferedDestinations,
      destinationRoundsSinceOffered: snapshot.domain.activeRun.destinationRoundsSinceOffered,
      updateDestinationOfferState: setDestinationOfferState,
    })),
  );
}

export function useContentNavigationTalentPort(): ContentNavigationTalentPort {
  const talentEffects = useTalentEffects();
  const talentXP = useRunSessionCommitStore((state) => state.snapshot.runProfile.talentXP);
  return useMemo(
    () => ({ talentXP, talentEffects: { startGold: talentEffects.startGold } }),
    [talentEffects, talentXP],
  );
}

export function useDestinationRunPort(): DestinationRunPort {
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      destinationIndexInAct: snapshot.domain.activeRun.destinationIndexInAct,
      completedDestinations: snapshot.domain.activeRun.completedDestinations,
      runPlayerHealth: snapshot.domain.activeRun.runPlayerHealth,
      runGold: snapshot.domain.activeRun.runGold,
      runMaxHealth: snapshot.domain.activeRun.runMaxHealth,
    })),
  );
}

export function useWildwoodRunPort(): WildwoodRunPort {
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      contentSystemType: snapshot.domain.activeRun.contentSystemType,
      characterId: snapshot.domain.activeRun.characterId,
      runDeck: snapshot.domain.activeRun.runDeck,
      updateRunDeck: setRunDeck,
    })),
  );
}

export function useCorruptionRunPort(): CorruptionRunPort {
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      runDeck: snapshot.domain.activeRun.runDeck,
      updateRunDeck: setRunDeck,
    })),
  );
}

export function useActiveRunScreen() {
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      screen: snapshot.domain.navigation.screen,
      setScreen,
    })),
  );
}

export function useActiveRunScreenValue(): Screen {
  return useRunSessionCommitStore((state) => state.snapshot.domain.navigation.screen);
}

export function useHasActiveBattle(): boolean {
  return useRunSessionCommitStore((state) => state.snapshot.battle.hasActiveBattle);
}

export function useHasActiveRun(): boolean {
  return useGameplayStateStore((state) => state.session.hasActiveRun);
}

export function useDisplayOverrides(): DisplayOverrides {
  return useRunSessionCommitStore((state) => state.snapshot.battle.displayOverrides);
}

export function useSetHasActiveBattle(): (active: boolean) => void {
  return setHasActiveBattleCommand;
}

export function useBondedCompanions() {
  return useRunSessionCommitStore((state) => state.snapshot.runProfile.bondedCompanions);
}

export function useContentSystemType(): ContentSystemId {
  return useRunSessionCommitStore((state) => state.snapshot.domain.activeRun.contentSystemType);
}

export function useIsWildwoodRun(): boolean {
  return useRunSessionCommitStore((state) => state.snapshot.domain.activeRun.contentSystemType === "wildwood");
}

export function useHomesteadProgressSlice() {
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      materialInventory: snapshot.runProfile.materialInventory,
      constructedBuildings: snapshot.runProfile.constructedBuildings,
      plantedFarms: snapshot.runProfile.plantedFarms,
      completedResearch: snapshot.runProfile.completedResearch,
      bondedCompanions: snapshot.runProfile.bondedCompanions,
    })),
  );
}

export function useHomesteadEffects() {
  return useRunSessionCommitStore((state) => state.snapshot.runProfile.effects);
}

export function useTalentProgressSlice(): { talentXP: TalentXP; unlockedTalents: UnlockedTalents } {
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      talentXP: snapshot.runProfile.talentXP,
      unlockedTalents: snapshot.runProfile.unlockedTalents,
    })),
  );
}

export function useDifficultySelectSlice(): {
  pendingCharacterId: CharacterId | null;
  selectedDifficulty: DifficultyId | null;
} {
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      pendingCharacterId: snapshot.transient.pendingCharacterId,
      selectedDifficulty: snapshot.domain.activeRun.selectedDifficulty,
    })),
  );
}

export function useDraftDeckSlice(): {
  contentSystemType: ContentSystemId;
  runDeck: BattleCard[];
  wildwoodDraft: WildwoodDraftState | null;
} {
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      contentSystemType: snapshot.domain.activeRun.contentSystemType,
      runDeck: snapshot.domain.activeRun.runDeck,
      wildwoodDraft: snapshot.transient.wildwoodDraft,
    })),
  );
}

export function useActiveRunCharacterId(): CharacterId {
  return useRunSessionCommitStore((state) => state.snapshot.domain.activeRun.characterId);
}
