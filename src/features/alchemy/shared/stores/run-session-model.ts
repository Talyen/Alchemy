// Typed read model composed from the canonical gameplay aggregate projection.
import type { BattleState } from "@/lib/battle";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import type { Screen } from "@/lib/routing";
import { getRunPhase, type RunPhase } from "@/lib/routing";
import type { RunStateFields } from "@/features/alchemy/shared/stores/run-state-init";
import { pickActiveRunSessionCoreFields } from "@/features/alchemy/shared/stores/run-state-init";
import type { CharacterId } from "@/lib/game-data";
import type { ContentSystemId, EncounterCombatTraitId } from "@/lib/content-systems/types";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { RunSessionFields } from "./run-domain-types";
import { getCommittedRunSessionSnapshot, useRunSessionCommitStore } from "./run-session-transaction";
import { createRunSessionStoreSnapshot, type RunSessionStoreSnapshot } from "./run-session-queries";
import type { RunDomainStore } from "./run-domain-store";
import type { RunProfileStore } from "./run-profile-store";
import { readRunSessionFields } from "./run-transient-store";

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
  pendingBattleTransition: PersistedBattleTransition | null;
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

function pickRunSessionRunSlice(state: RunDomainStore, profile: RunProfileStore): RunSessionRunSlice {
  return {
    ...pickActiveRunSessionCoreFields(state.activeRun),
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
  pendingBattleTransition: PersistedBattleTransition | null;
}): RunSessionBattleSlice {
  return {
    hasActiveBattle: battle.hasActiveBattle,
    battleState: battle.battleState,
    pendingBattleTransition: battle.pendingBattleTransition,
  };
}

function useRunSessionBattleSlice(): RunSessionBattleSlice {
  return useRunSessionCommitStore(useShallow(({ snapshot }) => pickRunSessionBattleSlice(snapshot.battle)));
}

/** Battle screen: combat state + labyrinth modifiers only (avoids run/shop subscriptions). */
export function useRunSessionBattleContext(screen?: Screen): RunSessionBattleContext {
  const battle = useRunSessionBattleSlice();
  const activeLabyrinthModifiers = useRunSessionCommitStore(
    (state) => state.snapshot.transient.activeLabyrinthModifiers,
  );
  const committedScreen = useRunSessionCommitStore((state) => state.snapshot.domain.navigation.screen);
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

/** Run navigation: session fields used by useRunNavigation (no screen-display twins). */
export function useRunSessionNavigationSlice(screen?: Screen): RunSessionNavigationSlice {
  const session = useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      screen: snapshot.domain.navigation.screen,
      hasActiveBattle: snapshot.battle.hasActiveBattle,
      hasActiveRun: snapshot.transient.hasActiveRun,
      pendingCharacterId: snapshot.transient.pendingCharacterId,
      pendingContentSystemType: snapshot.transient.pendingContentSystemType,
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

function toRunSession(snapshot: RunSessionStoreSnapshot, screen?: Screen): RunSession {
  const resolvedScreen = screen ?? snapshot.domain.navigation.screen;
  const battle = pickRunSessionBattleSlice(snapshot.battle);
  return {
    screen: resolvedScreen,
    phase: getRunPhase(resolvedScreen, battle.hasActiveBattle),
    run: pickRunSessionRunSlice(snapshot.domain, snapshot.runProfile),
    session: readRunSessionFields(snapshot.transient),
    battle,
  };
}

/** Imperative snapshot of run + session + battle for the current screen. */
export function getRunSession(screen?: Screen): RunSession {
  return toRunSession(createRunSessionStoreSnapshot(), screen);
}

/** Imperative snapshot of the last committed run + session + battle state. */
export function getCommittedRunSession(screen?: Screen): RunSession {
  return toRunSession(getCommittedRunSessionSnapshot(), screen);
}
