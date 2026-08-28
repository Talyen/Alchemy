// React-facing capability ports over the authoritative gameplay aggregate.
// Use for shell controllers (useAlchemyRunController, useRunFlowEngine) and orchestration.
// For screen display, prefer useRunScreenData / useBattleScreenRouteData (exact per-screen contracts).
// For imperative handlers, use run-session-read-port. Keep selectors narrow so controllers subscribe only to their domain.
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
import type { ActiveRunProgressFields } from "./run-state-init";
import { mostRecentResumableMode } from "./parked-runs";
import { useGameplayStateStore, type GameplayState } from "./gameplay-state-store";
import type {
  BattleRunPort,
  BattleTalentPort,
  ContentNavigationRunPort,
  ContentNavigationTalentPort,
  RunOrchestrationPort,
} from "./run-port-types";
import { createRunSessionCommand } from "./run-session-command";
import { selectAutosaveAllowed } from "./select-autosave-allowed";
import { setHasActiveBattle as setHasActiveBattleCommand } from "./run-session-write-port";

// The three run-facing ports intentionally overlap (orchestration is the superset of
// navigation + part of battle). A shared selector factory centralizes the per-field
// picking so renaming/adding a field touches one place instead of three hand-maintained
// object spreads. Overlap is intentional; narrowing is by key list, not by copy-paste.
function selectRunFields<K extends keyof ActiveRunProgressFields>(
  ...keys: K[]
): (state: GameplayState) => Pick<ActiveRunProgressFields, K> {
  return (state) => {
    const out = {} as Pick<ActiveRunProgressFields, K>;
    for (const k of keys) out[k] = state.run.activeRun[k];
    return out;
  };
}

const selectContentNavigationFields = selectRunFields(
  "contentSystemType",
  "lastOfferedDestinations",
  "destinationRoundsSinceOffered",
);

const selectBattleRunFields = selectRunFields(
  "characterId",
  "selectedDifficulty",
  "runMaxHealth",
  "runBoons",
  "roomsEncountered",
  "contentSystemType",
  "encounteredRunEnemyIds",
  "runDeck",
);

const selectOrchestrationFields = selectRunFields(
  "characterId",
  "selectedDifficulty",
  "runMaxHealth",
  "contentSystemType",
  "roomsEncountered",
  "currentAct",
  "runDeck",
  "runPlayerHealth",
  "destinationIndexInAct",
  "completedDestinations",
  "lastOfferedDestinations",
  "destinationRoundsSinceOffered",
);

const commandSetHasActiveBattle = createRunSessionCommand(setHasActiveBattleCommand);

export function useTalentEffects(): TalentEffectManifest {
  const unlockedTalents = useGameplayStateStore((state) => state.runProfile.unlockedTalents);
  return useMemo(() => computeTalentEffects(unlockedTalents), [unlockedTalents]);
}

/** Single orchestration subscription for run-flow, content-nav, destinations, and wildwood. */
export function useRunOrchestrationPort(): RunOrchestrationPort {
  return useGameplayStateStore(
    useShallow((state) => ({
      ...selectOrchestrationFields(state),
      gold: state.runProfile.gold,
    })),
  );
}

export function useContentNavigationRunPort(): ContentNavigationRunPort {
  return useGameplayStateStore(useShallow(selectContentNavigationFields));
}

export function useBattleRunPort(): BattleRunPort {
  return useGameplayStateStore(
    useShallow((state) => ({
      ...selectBattleRunFields(state),
      gold: state.runProfile.gold,
    })),
  );
}

export function useBattleTalentPort(): BattleTalentPort {
  const talentEffects = useTalentEffects();
  return useMemo(() => ({ talentEffects }), [talentEffects]);
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

export function useActiveRunScreenValue(): Screen {
  return useGameplayStateStore((state) => state.run.navigation.screen);
}

export function useAutosaveAllowed(screen: Screen): boolean {
  return useGameplayStateStore((state) => selectAutosaveAllowed(state, screen));
}

export function useBattleLifetimeFields() {
  return useGameplayStateStore(
    useShallow((state) => ({
      hasActiveBattle: state.battle.hasActiveBattle,
      pendingBattleTransition: state.battle.pendingBattleTransition,
      pendingTransitionResumeRequired: state.battle.pendingTransitionResumeRequired,
    })),
  );
}

export function useHasActiveBattle(): boolean {
  return useGameplayStateStore((state) => state.battle.hasActiveBattle);
}

export function useHasActiveRun(): boolean {
  return useGameplayStateStore((state) => state.session.hasActiveRun);
}

export function useForegroundResumeKind(): "battle" | "run" | null {
  return useGameplayStateStore((state) => {
    const liveMode = state.session.hasActiveRun ? state.run.activeRun.contentSystemType : null;
    const mode = mostRecentResumableMode(
      state.run.runRecency,
      liveMode,
      state.run.parkedRuns,
      state.session.hasActiveRun,
    );
    if (!mode) return null;
    if (state.session.hasActiveRun && liveMode === mode) {
      return state.battle.hasActiveBattle ? "battle" : "run";
    }
    return state.run.parkedRuns[mode]?.activeCombat ? "battle" : "run";
  });
}

export function useResumableGameModes(): Record<ContentSystemId, boolean> {
  return useGameplayStateStore(
    useShallow((state) => {
      const live = state.session.hasActiveRun ? state.run.activeRun.contentSystemType : null;
      return {
        campaign: live === "campaign" || Boolean(state.run.parkedRuns.campaign),
        labyrinth: live === "labyrinth" || Boolean(state.run.parkedRuns.labyrinth),
        wildwood: live === "wildwood" || Boolean(state.run.parkedRuns.wildwood),
      };
    }),
  );
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
  characterId: CharacterId;
  selectedDifficulty: DifficultyId | null;
} {
  return useGameplayStateStore(
    useShallow((state) => ({
      characterId: state.session.pendingCharacterId ?? state.run.activeRun.characterId,
      selectedDifficulty: state.run.activeRun.selectedDifficulty,
    })),
  );
}

export function useDraftDeckSlice(): {
  contentSystemType: ContentSystemId;
  runDeck: BattleCard[];
  wildwoodDraft: WildwoodDraftState | null;
  starterDraftChoices: BattleCard[] | null;
} {
  return useGameplayStateStore(
    useShallow((state) => ({
      contentSystemType: state.run.activeRun.contentSystemType,
      runDeck: state.run.activeRun.runDeck,
      wildwoodDraft: state.session.wildwoodDraft,
      starterDraftChoices: state.session.starterDraftChoices,
    })),
  );
}

export function useActiveRunCharacterId(): CharacterId {
  return useGameplayStateStore((state) => state.run.activeRun.characterId);
}

export function useActiveRunBoons(): string[] {
  return useGameplayStateStore((state) => state.run.activeRun.runBoons);
}
