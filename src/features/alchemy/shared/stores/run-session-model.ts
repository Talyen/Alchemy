// Typed read model composed from the canonical gameplay aggregate projection.
import type { BattleState } from "@/lib/battle";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import type { Screen } from "@/lib/routing";
import { getRunPhase, type RunPhase } from "@/lib/routing";
import { pickActiveRunView, type ActiveRunReadView } from "@/features/alchemy/shared/stores/run-state-init";
import type { CharacterId, TalentXP, UnlockedTalents } from "@/lib/game-data";
import type { ContentSystemId, EncounterCombatTraitId } from "@/lib/content-systems/types";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { RunSessionFields } from "./run-domain-types";
import { readGameplayState, useGameplayStateStore, type GameplayState } from "./gameplay-state-store";

/** Active-run view plus the permanent talent fields joined for committed session reads. */
type RunSessionRunSlice = ActiveRunReadView & {
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
};

type RunSessionTransientSlice = RunSessionFields;

interface RunSessionBattleSlice {
  hasActiveBattle: boolean;
  battleState: BattleState;
  pendingBattleTransition: PersistedBattleTransition | null;
  pendingTransitionResumeRequired: boolean;
}

/** Unified view of an in-progress or resumable run (screen defaults to navigation slice). */
export interface RunSession {
  screen: Screen;
  phase: RunPhase;
  run: RunSessionRunSlice;
  session: RunSessionTransientSlice;
  battle: RunSessionBattleSlice;
}

export interface RunSessionBattleContext {
  phase: RunPhase;
  battle: RunSessionBattleSlice;
  activeLabyrinthModifiers: EncounterCombatTraitId[];
}

/** Cross-screen orchestration fields for useRunFlowEngine (not screen display data). */
export interface RunSessionNavigationSlice {
  phase: RunPhase;
  hasActiveBattle: boolean;
  hasActiveRun: boolean;
  pendingCharacterId: CharacterId | null;
  pendingContentSystemType: ContentSystemId;
}

function pickRunSessionBattleSlice(battle: {
  hasActiveBattle: boolean;
  battleState: BattleState;
  pendingBattleTransition: PersistedBattleTransition | null;
  pendingTransitionResumeRequired: boolean;
}): RunSessionBattleSlice {
  return {
    hasActiveBattle: battle.hasActiveBattle,
    battleState: battle.battleState,
    pendingBattleTransition: battle.pendingBattleTransition,
    pendingTransitionResumeRequired: battle.pendingTransitionResumeRequired,
  };
}

function useRunSessionBattleSlice(): RunSessionBattleSlice {
  return useGameplayStateStore(useShallow((state) => pickRunSessionBattleSlice(state.battle)));
}

/** Battle screen: combat state + labyrinth modifiers only (avoids run/shop subscriptions). */
export function useRunSessionBattleContext(screen?: Screen): RunSessionBattleContext {
  const battle = useRunSessionBattleSlice();
  const activeLabyrinthModifiers = useGameplayStateStore((state) => state.session.activeLabyrinthModifiers);
  const committedScreen = useGameplayStateStore((state) => state.run.navigation.screen);
  const resolvedScreen = screen ?? committedScreen;
  return useMemo(
    () => ({
      phase: getRunPhase(resolvedScreen, battle.hasActiveBattle),
      battle,
      activeLabyrinthModifiers,
    }),
    [resolvedScreen, battle, activeLabyrinthModifiers],
  );
}

/** Run navigation: session fields used by useRunFlowEngine (no screen-display twins). */
export function useRunSessionNavigationSlice(screen?: Screen): RunSessionNavigationSlice {
  const session = useGameplayStateStore(
    useShallow((state) => ({
      screen: state.run.navigation.screen,
      hasActiveBattle: state.battle.hasActiveBattle,
      hasActiveRun: state.session.hasActiveRun,
      pendingCharacterId: state.session.pendingCharacterId,
      pendingContentSystemType: state.session.pendingContentSystemType,
    })),
  );
  const resolvedScreen = screen ?? session.screen;
  return useMemo(
    () => ({
      phase: getRunPhase(resolvedScreen, session.hasActiveBattle),
      hasActiveBattle: session.hasActiveBattle,
      hasActiveRun: session.hasActiveRun,
      pendingCharacterId: session.pendingCharacterId,
      pendingContentSystemType: session.pendingContentSystemType,
    }),
    [resolvedScreen, session],
  );
}

function toRunSession(state: GameplayState, screen?: Screen): RunSession {
  const resolvedScreen = screen ?? state.run.navigation.screen;
  const battle = pickRunSessionBattleSlice(state.battle);
  const { talentXP, unlockedTalents } = state.runProfile;
  return {
    screen: resolvedScreen,
    phase: getRunPhase(resolvedScreen, battle.hasActiveBattle),
    run: { ...pickActiveRunView(state.run), talentXP, unlockedTalents },
    session: { ...state.session },
    battle,
  };
}

/** Imperative snapshot of run + session + battle for the current screen. */
export function getRunSession(screen?: Screen): RunSession {
  return toRunSession(readGameplayState(), screen);
}

/** Imperative snapshot of the last committed run + session + battle state. */
export function getCommittedRunSession(screen?: Screen): RunSession {
  return toRunSession(useGameplayStateStore.getState(), screen);
}
