// Typed read model composed from the run-domain, profile, transient, and battle stores.
import type { BattleState } from "@/lib/battle";
import type { Screen } from "@/lib/routing";
import { getRunPhase, type RunPhase } from "@/lib/routing";
import type { RunStateFields } from "@/features/alchemy/shared/stores/run-state-init";
import type { CharacterId } from "@/lib/game-data";
import type { ContentSystemId, EncounterCombatTraitId } from "@/lib/content-systems/types";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { RunSessionFields } from "./run-domain-types";
import { getRunDomainStore, type RunDomainStore } from "./run-domain-store";
import { getRunProfileStore, type RunProfileStore } from "./run-profile-store";
import { getRunTransientStore, readRunSessionFields, useRunTransientStore } from "./run-transient-store";
import { getRunBattleDomainStore, useRunBattleDomainStore } from "./run-battle-domain-store";

type RunSessionRunSlice = Pick<
  RunStateFields,
  | "characterId"
  | "runDeck"
  | "runGold"
  | "runPlayerHealth"
  | "runMaxHealth"
  | "roomsEncountered"
  | "currentAct"
  | "destinationIndexInAct"
  | "completedDestinations"
  | "lastOfferedDestinations"
  | "destinationRoundsSinceOffered"
  | "runTrinkets"
  | "encounteredRunEnemyIds"
  | "selectedDifficulty"
  | "contentSystemType"
  | "rng"
  | "talentXP"
  | "runTalentXP"
  | "runMaterialsEarned"
  | "unlockedTalents"
  | "initialized"
>;

type RunSessionTransientSlice = RunSessionFields;

interface RunSessionBattleSlice {
  hasActiveBattle: boolean;
  battleState: BattleState;
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

/** Cross-screen orchestration fields for useRunNavigation (not screen display data). */
export interface RunSessionNavigationSlice {
  phase: RunPhase;
  hasActiveBattle: boolean;
  hasActiveRun: boolean;
  pendingCharacterId: CharacterId | null;
  pendingContentSystemType: ContentSystemId;
}

function resolveScreen(screen?: Screen): Screen {
  return screen ?? getRunDomainStore().navigation.screen;
}

function pickRunSessionRunSlice(state: RunDomainStore, profile: RunProfileStore): RunSessionRunSlice {
  return {
    characterId: state.activeRun.characterId,
    runDeck: state.activeRun.runDeck,
    runGold: state.activeRun.runGold,
    runPlayerHealth: state.activeRun.runPlayerHealth,
    runMaxHealth: state.activeRun.runMaxHealth,
    roomsEncountered: state.activeRun.roomsEncountered,
    currentAct: state.activeRun.currentAct,
    destinationIndexInAct: state.activeRun.destinationIndexInAct,
    completedDestinations: state.activeRun.completedDestinations,
    lastOfferedDestinations: state.activeRun.lastOfferedDestinations,
    destinationRoundsSinceOffered: state.activeRun.destinationRoundsSinceOffered,
    runTrinkets: state.activeRun.runTrinkets,
    encounteredRunEnemyIds: state.activeRun.encounteredRunEnemyIds,
    selectedDifficulty: state.activeRun.selectedDifficulty,
    contentSystemType: state.activeRun.contentSystemType,
    rng: state.activeRun.rng,
    talentXP: profile.talentXP,
    runTalentXP: state.activeRun.runTalentXP,
    runMaterialsEarned: state.activeRun.runMaterialsEarned,
    unlockedTalents: profile.unlockedTalents,
    initialized: state.initialized,
  };
}

function pickRunSessionBattleSlice(battle: {
  hasActiveBattle: boolean;
  battleState: BattleState;
}): RunSessionBattleSlice {
  return {
    hasActiveBattle: battle.hasActiveBattle,
    battleState: battle.battleState,
  };
}

function useRunSessionBattleSlice(): RunSessionBattleSlice {
  return useRunBattleDomainStore(useShallow(pickRunSessionBattleSlice));
}

/** Battle screen: combat state + labyrinth modifiers only (avoids run/shop subscriptions). */
export function useRunSessionBattleContext(screen?: Screen): RunSessionBattleContext {
  const battle = useRunSessionBattleSlice();
  const activeLabyrinthModifiers = useRunTransientStore((s) => s.activeLabyrinthModifiers);
  const resolvedScreen = resolveScreen(screen);
  return useMemo(
    () => ({
      phase: getRunPhase(resolvedScreen, battle.hasActiveBattle),
      battle,
      activeLabyrinthModifiers,
    }),
    [resolvedScreen, battle, activeLabyrinthModifiers],
  );
}

/** Run navigation: session fields used by useRunNavigation (no screen-display twins). */
export function useRunSessionNavigationSlice(screen?: Screen): RunSessionNavigationSlice {
  const resolvedScreen = resolveScreen(screen);
  const session = useRunTransientStore(
    useShallow((s) => ({
      hasActiveRun: s.hasActiveRun,
      pendingCharacterId: s.pendingCharacterId,
      pendingContentSystemType: s.pendingContentSystemType,
    })),
  );
  const hasActiveBattle = useRunBattleDomainStore((s) => s.hasActiveBattle);
  return useMemo(
    () => ({
      phase: getRunPhase(resolvedScreen, hasActiveBattle),
      hasActiveBattle,
      hasActiveRun: session.hasActiveRun,
      pendingCharacterId: session.pendingCharacterId,
      pendingContentSystemType: session.pendingContentSystemType,
    }),
    [resolvedScreen, hasActiveBattle, session],
  );
}

/** Imperative snapshot of run + session + battle for the current screen. */
export function getRunSession(screen?: Screen): RunSession {
  const resolvedScreen = resolveScreen(screen);
  const battle = pickRunSessionBattleSlice(getRunBattleDomainStore());
  return {
    screen: resolvedScreen,
    phase: getRunPhase(resolvedScreen, battle.hasActiveBattle),
    run: pickRunSessionRunSlice(getRunDomainStore(), getRunProfileStore()),
    session: readRunSessionFields(getRunTransientStore()),
    battle,
  };
}
