import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { isActiveRunActivity, runActivityScreen } from "@/lib/active-run-session";
import {
  computeTalentEffects,
  type CharacterId,
  type DifficultyId,
  type TalentEffectManifest,
  type TalentXP,
  type UnlockedTalents,
} from "@/lib/game-data";
import { getRunPhase, type Screen } from "@/lib/routing";
import { useGameplayStateStore, type GameplayState } from "./gameplay-state-store";
import { selectBattle, selectCardInspectionData } from "./run-reads";

function useShallowRunSelector<T>(selector: (state: GameplayState) => T): T {
  return useGameplayStateStore(useShallow(selector));
}

export function useRunResumeScreen(): Screen | null {
  return useGameplayStateStore((state) =>
    isActiveRunActivity(state.session.activity) ? runActivityScreen(state.session.activity) : null,
  );
}

export function useTalentEffects(): TalentEffectManifest {
  const unlockedTalents = useGameplayStateStore(useShallow((state) => state.runProfile.unlockedTalents));
  return useMemo(() => computeTalentEffects(unlockedTalents), [unlockedTalents]);
}

export function useActiveRunScreenValue(): Screen {
  return useGameplayStateStore((state) => state.run.navigation.screen);
}

export function useHasActiveBattle(): boolean {
  return useGameplayStateStore((state) => state.session.activity.kind === "battle");
}

export function useHasActiveRun(): boolean {
  return useGameplayStateStore((state) => isActiveRunActivity(state.session.activity));
}

export function useForegroundResumeKind(): "battle" | "run" | null {
  return useGameplayStateStore((state) => {
    if (!isActiveRunActivity(state.session.activity)) return null;
    return state.session.activity.kind === "battle" ? "battle" : "run";
  });
}

export function useBondedCompanions() {
  return useGameplayStateStore(useShallow((state) => state.runProfile.bondedCompanions));
}

export function useHomesteadProgressSlice() {
  return useShallowRunSelector((state) => ({
    gold: state.runProfile.gold,
    materialInventory: state.runProfile.materialInventory,
    constructedBuildings: state.runProfile.constructedBuildings,
    plantedFarms: state.runProfile.plantedFarms,
    completedResearch: state.runProfile.completedResearch,
    bondedCompanions: state.runProfile.bondedCompanions,
  }));
}

export function useHomesteadEffects() {
  return useGameplayStateStore(useShallow((state) => state.runProfile.effects));
}

export function useTalentProgressSlice(): { talentXP: TalentXP; unlockedTalents: UnlockedTalents } {
  return useShallowRunSelector((state) => ({
    talentXP: state.runProfile.talentXP,
    unlockedTalents: state.runProfile.unlockedTalents,
  }));
}

export function useDifficultySelectSlice(): { characterId: CharacterId; selectedDifficulty: DifficultyId | null } {
  return useShallowRunSelector((state) => ({
    characterId: state.session.pendingCharacterId ?? state.run.activeRun.characterId,
    selectedDifficulty: state.run.activeRun.selectedDifficulty,
  }));
}

export function useActiveRunCharacterId(): CharacterId {
  return useGameplayStateStore((state) => state.run.activeRun.characterId);
}

export function useActiveRunBoons(): string[] {
  return useGameplayStateStore(useShallow((state) => state.run.activeRun.runBoons));
}

export function useBattleClusterState() {
  return useGameplayStateStore(
    useShallow((state) => {
      const { battleState, hasActiveBattle } = selectBattle(state);
      return {
        battleState,
        hasActiveBattle,
        gold: battleState.gold,
        hasWishOptions: Boolean(battleState.wishOptions),
      };
    }),
  );
}

export function useRunSessionBattleContext() {
  const battle = useShallowRunSelector(selectBattle);
  const activeLabyrinthModifiers = useGameplayStateStore((state) => state.session.activeLabyrinthModifiers);
  return { battle, activeLabyrinthModifiers };
}

export function useRunPhase(screen?: Screen) {
  return useGameplayStateStore((state) =>
    getRunPhase(screen ?? state.run.navigation.screen, state.session.activity.kind === "battle"),
  );
}

export function useCardInspectionData() {
  return useShallowRunSelector(selectCardInspectionData);
}
