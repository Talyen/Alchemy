// Typed read model over the consolidated run domain store.
import type { BattleState } from "@/lib/battle";
import type { Screen } from "@/lib/routing";
import { getRunPhase, type RunPhase } from "@/lib/routing";
import type { RunStateFields } from "@/features/alchemy/run-setup/run/run-state-init";
import type { RewardState } from "@/lib/active-run-session";
import type { CorruptionResult } from "@/lib/corruption";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { CharacterId } from "@/lib/game-data";
import type { LabyrinthMap, LabyrinthModifierKind, ContentSystemId } from "@/lib/content-systems/types";
import type { LabyrinthNodePosition } from "@/lib/active-run-session";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { RunDomainDataState, RunSessionFields } from "./run-domain-types";
import { getRunDomainStore, useRunDomainStore } from "./run-domain-store";

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
  activeLabyrinthModifiers: LabyrinthModifierKind[];
}

export type RunSessionShopSlice = Pick<
  RunSessionTransientSlice,
  "shopState" | "alchemistState" | "trinketShopState" | "equipmentShopState"
>;

export type RunSessionMysterySlice = Pick<RunSessionTransientSlice, "mysteryEvent" | "mysteryCardChoices">;

export type RunSessionLabyrinthSlice = Pick<RunSessionTransientSlice, "labyrinthMap" | "activeLabyrinthPendingNode">;

export interface RunSessionNavigationSlice {
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
}

function resolveScreen(screen?: Screen): Screen {
  return screen ?? getRunDomainStore().navigation.screen;
}

function pickRunSessionRunSlice(state: RunDomainDataState): RunSessionRunSlice {
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
    talentXP: state.profile.talentXP,
    runTalentXP: state.activeRun.runTalentXP,
    runMaterialsEarned: state.activeRun.runMaterialsEarned,
    unlockedTalents: state.profile.unlockedTalents,
    initialized: state.initialized,
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

function useRunSessionBattleSlice(): RunSessionBattleSlice {
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
      trinketShopState: s.session.trinketShopState,
      equipmentShopState: s.session.equipmentShopState,
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
    run: pickRunSessionRunSlice(state),
    session: pickRunSessionTransientSlice(state.session),
    battle,
  };
}
