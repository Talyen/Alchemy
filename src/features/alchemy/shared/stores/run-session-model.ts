// Typed read model over the consolidated run domain store.
import type { BattleState } from "@/lib/battle";
import type { Screen } from "@/lib/routing";
import { getRunPhase, type RunPhase } from "@/lib/routing";
import type { RunStateFields } from "@/features/alchemy/run-setup/run/run-state-init";
import type { RewardState } from "@/features/alchemy/navigation/reward-flow";
import type { CorruptionResult } from "@/lib/corruption";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { CharacterId } from "@/lib/game-data";
import type { LabyrinthMap, LabyrinthModifierKind, ContentSystemId } from "@/lib/content-systems/types";
import type { LabyrinthNodePosition } from "@/lib/active-run-session";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { RunSessionFields } from "./run-session-store-types";
import { getRunDomainStore, useRunDomainStore } from "./run-domain-store";

export type RunSessionRunSlice = Pick<
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
  | "runTrinkets"
  | "encounteredRunEnemyIds"
  | "selectedDifficulty"
  | "contentSystemType"
  | "talentXP"
  | "runTalentXP"
  | "unlockedTalents"
  | "initialized"
>;

export type RunSessionTransientSlice = RunSessionFields;

export type RunSessionBattleSlice = {
  hasActiveBattle: boolean;
  battleState: BattleState;
};

/** Unified view of an in-progress or resumable run (screen defaults to navigation slice). */
export type RunSession = {
  screen: Screen;
  phase: RunPhase;
  run: RunSessionRunSlice;
  session: RunSessionTransientSlice;
  battle: RunSessionBattleSlice;
};

export type RunSessionBattleContext = {
  phase: RunPhase;
  battle: RunSessionBattleSlice;
  activeLabyrinthModifiers: LabyrinthModifierKind[];
};

export type RunSessionShopSlice = Pick<RunSessionTransientSlice, "shopState" | "alchemistState">;

export type RunSessionMysterySlice = Pick<RunSessionTransientSlice, "mysteryEvent" | "mysteryCardChoices">;

export type RunSessionLabyrinthSlice = Pick<RunSessionTransientSlice, "labyrinthMap" | "activeLabyrinthPendingNode">;

export type RunSessionNavigationSlice = {
  phase: RunPhase;
  hasActiveBattle: boolean;
  hasActiveRun: boolean;
  labyrinthMap: LabyrinthMap;
  labyrinthPendingNode: LabyrinthNodePosition | null;
  activeLabyrinthModifiers: LabyrinthModifierKind[];
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
  rewardState: RewardState;
  runEndMaterials: MaterialInventory;
  corruptionResult: CorruptionResult | null;
  pendingCharacterId: CharacterId | null;
  pendingContentSystemType: ContentSystemId;
};

function resolveScreen(screen?: Screen): Screen {
  return screen ?? getRunDomainStore().navigation.screen;
}

function pickRunSessionRunSlice(progress: RunStateFields): RunSessionRunSlice {
  return {
    characterId: progress.characterId,
    runDeck: progress.runDeck,
    runGold: progress.runGold,
    runPlayerHealth: progress.runPlayerHealth,
    runMaxHealth: progress.runMaxHealth,
    roomsEncountered: progress.roomsEncountered,
    currentAct: progress.currentAct,
    destinationIndexInAct: progress.destinationIndexInAct,
    completedDestinations: progress.completedDestinations,
    runTrinkets: progress.runTrinkets,
    encounteredRunEnemyIds: progress.encounteredRunEnemyIds,
    selectedDifficulty: progress.selectedDifficulty,
    contentSystemType: progress.contentSystemType,
    talentXP: progress.talentXP,
    runTalentXP: progress.runTalentXP,
    unlockedTalents: progress.unlockedTalents,
    initialized: progress.initialized,
  };
}

function pickRunSessionTransientSlice(session: RunSessionFields): RunSessionTransientSlice {
  return { ...session };
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

export function useRunSessionRunSlice(): RunSessionRunSlice {
  return useRunDomainStore(useShallow((s) => pickRunSessionRunSlice(s.progress)));
}

export function useRunSessionTransientSlice(): RunSessionTransientSlice {
  return useRunDomainStore(useShallow((s) => pickRunSessionTransientSlice(s.session)));
}

export function useRunSessionBattleSlice(): RunSessionBattleSlice {
  return useRunDomainStore(useShallow((s) => pickRunSessionBattleSlice(s.battle)));
}

/** Battle screen: combat state + labyrinth modifiers only (avoids run/shop subscriptions). */
export function useRunSessionBattleContext(screen?: Screen): RunSessionBattleContext {
  const battle = useRunSessionBattleSlice();
  const activeLabyrinthModifiers = useRunDomainStore((s) => s.session.activeLabyrinthModifiers);
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

/** Shop / alchemist screens: offer state only. */
export function useRunSessionShopSlice(): RunSessionShopSlice {
  return useRunDomainStore(
    useShallow((s) => ({
      shopState: s.session.shopState,
      alchemistState: s.session.alchemistState,
    })),
  );
}

/** Mystery screen: event + card picker state only. */
export function useRunSessionMysterySlice(): RunSessionMysterySlice {
  return useRunDomainStore(
    useShallow((s) => ({
      mysteryEvent: s.session.mysteryEvent,
      mysteryCardChoices: s.session.mysteryCardChoices,
    })),
  );
}

/** Labyrinth map: grid + pending node only. */
export function useRunSessionLabyrinthSlice(): RunSessionLabyrinthSlice {
  return useRunDomainStore(
    useShallow((s) => ({
      labyrinthMap: s.session.labyrinthMap,
      activeLabyrinthPendingNode: s.session.activeLabyrinthPendingNode,
    })),
  );
}

/** Run navigation: session fields used by useRunNavigation (no full run/battle state). */
export function useRunSessionNavigationSlice(screen?: Screen): RunSessionNavigationSlice {
  const resolvedScreen = resolveScreen(screen);
  const session = useRunDomainStore(
    useShallow((s) => ({
      hasActiveRun: s.session.hasActiveRun,
      labyrinthMap: s.session.labyrinthMap,
      activeLabyrinthPendingNode: s.session.activeLabyrinthPendingNode,
      activeLabyrinthModifiers: s.session.activeLabyrinthModifiers,
      activeLabyrinthRewardModifiers: s.session.activeLabyrinthRewardModifiers,
      rewardState: s.session.rewardState,
      runEndMaterials: s.session.runEndMaterials,
      corruptionResult: s.session.corruptionResult,
      pendingCharacterId: s.session.pendingCharacterId,
      pendingContentSystemType: s.session.pendingContentSystemType,
    })),
  );
  const hasActiveBattle = useRunDomainStore((s) => s.battle.hasActiveBattle);
  return useMemo(
    () => ({
      phase: getRunPhase(resolvedScreen, hasActiveBattle),
      hasActiveBattle,
      hasActiveRun: session.hasActiveRun,
      labyrinthMap: session.labyrinthMap,
      labyrinthPendingNode: session.activeLabyrinthPendingNode,
      activeLabyrinthModifiers: session.activeLabyrinthModifiers,
      activeLabyrinthRewardModifiers: session.activeLabyrinthRewardModifiers,
      rewardState: session.rewardState,
      runEndMaterials: session.runEndMaterials,
      corruptionResult: session.corruptionResult,
      pendingCharacterId: session.pendingCharacterId,
      pendingContentSystemType: session.pendingContentSystemType,
    }),
    [resolvedScreen, hasActiveBattle, session],
  );
}

/** Imperative snapshot of run + session + battle for the current screen. */
export function getRunSession(screen?: Screen): RunSession {
  const state = getRunDomainStore();
  const resolvedScreen = resolveScreen(screen);
  const battle = pickRunSessionBattleSlice(state.battle);
  return {
    screen: resolvedScreen,
    phase: getRunPhase(resolvedScreen, battle.hasActiveBattle),
    run: pickRunSessionRunSlice(state.progress),
    session: pickRunSessionTransientSlice(state.session),
    battle,
  };
}

/** React hook — subscribes to run, session, and battle slices (shallow per slice). */
export function useRunSession(screen?: Screen): RunSession {
  const navigationScreen = useRunDomainStore((s) => s.navigation.screen);
  const screenValue = screen ?? navigationScreen;
  const run = useRunSessionRunSlice();
  const session = useRunSessionTransientSlice();
  const battle = useRunSessionBattleSlice();
  return useMemo(
    () => ({
      screen: screenValue,
      phase: getRunPhase(screenValue, battle.hasActiveBattle),
      run,
      session,
      battle,
    }),
    [screenValue, run, session, battle],
  );
}
