// Typed read model over run, session, and battle Zustand stores.
import type { BattleState } from "@/lib/battle";
import type { Screen } from "@/lib/routing";
import { getRunPhase, type RunPhase } from "@/lib/routing";
import type { RunStateFields } from "@/features/alchemy/run/run-state-init";
import type { RewardState } from "@/features/alchemy/navigation/reward-flow";
import type { CorruptionResult } from "@/lib/corruption";
import type { MysteryEvent } from "@/lib/mystery";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { CharacterId } from "@/lib/game-data";
import type { BattleCard } from "@/lib/game-data";
import type { LabyrinthMap, LabyrinthModifierKind, ContentSystemId } from "@/lib/content-systems/types";
import type { LabyrinthNodePosition } from "@/features/alchemy/run/types";
import type { ShopState, AlchemistState } from "@/features/alchemy/shop/shop-state-init";
import type { TalentXP } from "@/lib/talents";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useBattleStore } from "./battle-store";
import { useActiveRunStore } from "./active-run-store";

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

export type RunSessionTransientSlice = {
  hasActiveRun: boolean;
  activeLabyrinthModifiers: LabyrinthModifierKind[];
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
  activeLabyrinthPendingNode: LabyrinthNodePosition | null;
  rewardState: RewardState;
  companionRewardCards: BattleCard[] | null;
  runEndMaterials: MaterialInventory;
  runEndTalentXP: TalentXP;
  corruptionResult: CorruptionResult | null;
  pendingCharacterId: CharacterId | null;
  pendingContentSystemType: ContentSystemId;
  labyrinthMap: LabyrinthMap;
  shopState: ShopState;
  alchemistState: AlchemistState;
  mysteryEvent: MysteryEvent | null;
  mysteryCardChoices: BattleCard[] | null;
};

export type RunSessionBattleSlice = {
  hasActiveBattle: boolean;
  battleState: BattleState;
};

/** Unified view of an in-progress or resumable run (screen defaults to active-run-store). */
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
  return screen ?? useActiveRunStore.getState().screen;
}

function pickRunSessionRunSlice(run: ReturnType<typeof useActiveRunStore.getState>): RunSessionRunSlice {
  return {
    characterId: run.characterId,
    runDeck: run.runDeck,
    runGold: run.runGold,
    runPlayerHealth: run.runPlayerHealth,
    runMaxHealth: run.runMaxHealth,
    roomsEncountered: run.roomsEncountered,
    currentAct: run.currentAct,
    destinationIndexInAct: run.destinationIndexInAct,
    completedDestinations: run.completedDestinations,
    runTrinkets: run.runTrinkets,
    encounteredRunEnemyIds: run.encounteredRunEnemyIds,
    selectedDifficulty: run.selectedDifficulty,
    contentSystemType: run.contentSystemType,
    talentXP: run.talentXP,
    runTalentXP: run.runTalentXP,
    unlockedTalents: run.unlockedTalents,
    initialized: run.initialized,
  };
}

function pickRunSessionTransientSlice(
  session: ReturnType<typeof useActiveRunStore.getState>,
): RunSessionTransientSlice {
  return {
    hasActiveRun: session.hasActiveRun,
    activeLabyrinthModifiers: session.activeLabyrinthModifiers,
    activeLabyrinthRewardModifiers: session.activeLabyrinthRewardModifiers,
    activeLabyrinthPendingNode: session.activeLabyrinthPendingNode,
    rewardState: session.rewardState,
    companionRewardCards: session.companionRewardCards,
    runEndMaterials: session.runEndMaterials,
    runEndTalentXP: session.runEndTalentXP,
    corruptionResult: session.corruptionResult,
    pendingCharacterId: session.pendingCharacterId,
    pendingContentSystemType: session.pendingContentSystemType,
    labyrinthMap: session.labyrinthMap,
    shopState: session.shopState,
    alchemistState: session.alchemistState,
    mysteryEvent: session.mysteryEvent,
    mysteryCardChoices: session.mysteryCardChoices,
  };
}

function pickRunSessionBattleSlice(battle: ReturnType<typeof useBattleStore.getState>): RunSessionBattleSlice {
  return {
    hasActiveBattle: battle.hasActiveBattle,
    battleState: battle.battleState,
  };
}

function readRunSlice(): RunSessionRunSlice {
  return pickRunSessionRunSlice(useActiveRunStore.getState());
}

function readSessionSlice(): RunSessionTransientSlice {
  return pickRunSessionTransientSlice(useActiveRunStore.getState());
}

function readBattleSlice(): RunSessionBattleSlice {
  return pickRunSessionBattleSlice(useBattleStore.getState());
}

export function useRunSessionRunSlice(): RunSessionRunSlice {
  return useActiveRunStore(useShallow(pickRunSessionRunSlice));
}

export function useRunSessionTransientSlice(): RunSessionTransientSlice {
  return useActiveRunStore(useShallow(pickRunSessionTransientSlice));
}

export function useRunSessionBattleSlice(): RunSessionBattleSlice {
  return useBattleStore(useShallow(pickRunSessionBattleSlice));
}

/** Battle screen: combat state + labyrinth modifiers only (avoids run/shop subscriptions). */
export function useRunSessionBattleContext(screen?: Screen): RunSessionBattleContext {
  const battle = useRunSessionBattleSlice();
  const activeLabyrinthModifiers = useActiveRunStore((s) => s.activeLabyrinthModifiers);
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
  return useActiveRunStore(
    useShallow((s) => ({
      shopState: s.shopState,
      alchemistState: s.alchemistState,
    })),
  );
}

/** Mystery screen: event + card picker state only. */
export function useRunSessionMysterySlice(): RunSessionMysterySlice {
  return useActiveRunStore(
    useShallow((s) => ({
      mysteryEvent: s.mysteryEvent,
      mysteryCardChoices: s.mysteryCardChoices,
    })),
  );
}

/** Labyrinth map: grid + pending node only. */
export function useRunSessionLabyrinthSlice(): RunSessionLabyrinthSlice {
  return useActiveRunStore(
    useShallow((s) => ({
      labyrinthMap: s.labyrinthMap,
      activeLabyrinthPendingNode: s.activeLabyrinthPendingNode,
    })),
  );
}

/** Run navigation: session fields used by useRunNavigation (no full run/battle state). */
export function useRunSessionNavigationSlice(screen?: Screen): RunSessionNavigationSlice {
  const resolvedScreen = resolveScreen(screen);
  const session = useActiveRunStore(
    useShallow((s) => ({
      hasActiveRun: s.hasActiveRun,
      labyrinthMap: s.labyrinthMap,
      activeLabyrinthPendingNode: s.activeLabyrinthPendingNode,
      activeLabyrinthModifiers: s.activeLabyrinthModifiers,
      activeLabyrinthRewardModifiers: s.activeLabyrinthRewardModifiers,
      rewardState: s.rewardState,
      runEndMaterials: s.runEndMaterials,
      corruptionResult: s.corruptionResult,
      pendingCharacterId: s.pendingCharacterId,
      pendingContentSystemType: s.pendingContentSystemType,
    })),
  );
  const hasActiveBattle = useBattleStore((s) => s.hasActiveBattle);
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
  const resolvedScreen = resolveScreen(screen);
  const battle = readBattleSlice();
  return {
    screen: resolvedScreen,
    phase: getRunPhase(resolvedScreen, battle.hasActiveBattle),
    run: readRunSlice(),
    session: readSessionSlice(),
    battle,
  };
}

/** React hook — subscribes to run, session, and battle slices (shallow per store). */
export function useRunSession(screen?: Screen): RunSession {
  const resolvedScreen = useActiveRunStore((s) => s.screen);
  const screenValue = screen ?? resolvedScreen;
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
