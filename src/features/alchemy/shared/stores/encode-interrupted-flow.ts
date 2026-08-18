import {
  createEmptyRewardState,
  restorePendingRewardBundle,
  serializePendingReward,
  type ActiveRunData,
  type InterruptedFlow,
  type PersistedPendingReward,
  type RewardState,
} from "@/lib/active-run-session";
import type { BattleCard } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { filterValidDestinations, type Screen } from "@/lib/routing";
import { wildwoodPhaseToScreen } from "@/features/alchemy/shared/run-flow/wildwood-screen-routing";
import type { RunSession } from "./run-session-model";

export interface DecodedClaimSurface {
  rewardState: RewardState | null;
  companionRewardCards: BattleCard[] | null;
  screen: Screen | null;
}

/**
 * During an in-flight claim the primary choice is already applied to the deck.
 * Persist only the post-claim surface (companion handoff or destinations) so
 * autosave cannot re-offer the claimed primary or soft-lock empty Rewards.
 */
function encodeMidClaimPendingReward(session: RunSession["session"]): PersistedPendingReward | null {
  const companions = session.companionRewardCards;
  if (!companions?.length) return null;

  return {
    rewardType: "card",
    choiceIds: [],
    companionChoiceIds: companions.map((choice) => choice.id),
    selectedId: null,
    gold: 0,
    materials: emptyInventory(),
    destinations: [...session.rewardState.destinations],
    selectedBossId: session.rewardState.selectedBossId,
    lastVictoryEnemyType: session.rewardState.lastVictoryEnemyType,
    lastVictoryContentSystem: session.rewardState.lastVictoryContentSystem,
  };
}

export function resolveEncodeScreen(
  requested: Screen | null | undefined,
  session: RunSession["session"],
): Screen | null | undefined {
  if (!session.rewardClaimInFlight) return requested;
  if (session.companionRewardCards?.length) return requested ?? "rewards";
  // Primary drained with destinations still pending — resume on destination pick.
  if (session.rewardState.destinations.length > 0) return "destination";
  // Boss / act-complete / labyrinth clear: no claimable surface left.
  if (requested === "rewards" || requested == null) {
    if (session.labyrinthMap) return "labyrinth-map";
    if (session.wildwoodDraft) {
      return wildwoodPhaseToScreen(session.wildwoodDraft.phase) ?? "destination";
    }
    return "destination";
  }
  return requested;
}

function encodeDestinationFlow(session: RunSession["session"]): InterruptedFlow {
  return {
    kind: "destination",
    destinations: [...session.rewardState.destinations],
    selectedBossId: session.rewardState.selectedBossId,
    lastVictoryEnemyType: session.rewardState.lastVictoryEnemyType,
    lastVictoryContentSystem: session.rewardState.lastVictoryContentSystem,
  };
}

export function encodeInterruptedFlow(
  session: RunSession["session"],
  currentScreen: Screen | null | undefined,
): InterruptedFlow {
  if (session.rewardClaimInFlight) {
    if (session.companionRewardCards?.length) {
      const pending = encodeMidClaimPendingReward(session);
      return pending ? { kind: "companion-reward", pending } : { kind: "none" };
    }
    // Match resolveEncodeScreen: post-claim destination / hollow rewards need destination phase.
    if (session.rewardState.destinations.length > 0 || currentScreen === "destination" || currentScreen === "rewards") {
      return encodeDestinationFlow(session);
    }
    return { kind: "none" };
  }

  if (currentScreen === "rewards" && session.rewardState.choices.length > 0) {
    const pending = serializePendingReward(session.rewardState, session.companionRewardCards);
    return pending ? { kind: "primary-reward", pending } : { kind: "none" };
  }

  // Destination phase: destination screen, or rewards with no primary/companion choices left.
  if (currentScreen === "destination" || (currentScreen === "rewards" && session.rewardState.choices.length === 0)) {
    return encodeDestinationFlow(session);
  }

  // Non-claim screens can still carry an in-progress reward payload (e.g. snapshot parity).
  const pending = serializePendingReward(session.rewardState, session.companionRewardCards);
  if (pending && session.companionRewardCards?.length) {
    return { kind: "companion-reward", pending };
  }
  if (pending && session.rewardState.choices.length > 0) {
    return { kind: "primary-reward", pending };
  }

  return { kind: "none" };
}

function resolveDestinationExitScreen(activeRun: ActiveRunData): Screen {
  if (activeRun.labyrinthMap) return "labyrinth-map";
  if (activeRun.wildwoodDraft) {
    return wildwoodPhaseToScreen(activeRun.wildwoodDraft.phase) ?? "destination";
  }
  return "destination";
}

/** Fallback when a persisted active run has a null/missing currentScreen. */
export function inferActiveRunScreen(activeRun: ActiveRunData): Screen {
  if (activeRun.activeCombat && activeRun.activeCombat.battleState.enemyHealth > 0) return "battle";
  if (activeRun.contentSystemType === "labyrinth" && activeRun.labyrinthMap) return "labyrinth-map";
  if (activeRun.wildwoodDraft) {
    return wildwoodPhaseToScreen(activeRun.wildwoodDraft.phase) ?? "destination";
  }
  if (activeRun.interruptedFlow.kind === "primary-reward" || activeRun.interruptedFlow.kind === "companion-reward") {
    return "rewards";
  }
  if (activeRun.interruptedFlow.kind === "destination") return "destination";
  if (activeRun.mysteryVisit) return "mystery";
  if (activeRun.corruptionResult) return "corruption";
  return "destination";
}

function restoreCompanionHandoff(currentScreen: Screen | null, pending: PersistedPendingReward): DecodedClaimSurface {
  const restored = restorePendingRewardBundle(pending);
  let { rewardState, companionRewardCards } = restored;
  let screen = currentScreen;

  if (companionRewardCards?.length && (!rewardState || rewardState.choices.length === 0)) {
    rewardState = {
      ...(rewardState ?? createEmptyRewardState(filterValidDestinations(pending.destinations))),
      rewardType: "card",
      choices: companionRewardCards,
      selectedId: null,
      gold: 0,
      materials: emptyInventory(),
    };
    companionRewardCards = null;
    screen = "rewards";
  }

  return { rewardState, companionRewardCards, screen };
}

function restorePrimaryPendingReward(
  currentScreen: Screen | null,
  pending: PersistedPendingReward,
): DecodedClaimSurface {
  const restored = restorePendingRewardBundle(pending);
  const companionRewardCards = restored.companionRewardCards;
  let rewardState = restored.rewardState;
  let screen = currentScreen;
  if (!rewardState && pending.destinations.length > 0) {
    rewardState = createEmptyRewardState(filterValidDestinations(pending.destinations));
    screen = "destination";
  }
  return { rewardState, companionRewardCards, screen };
}

function restoreDestinationFlow(
  activeRun: ActiveRunData,
  flow: Extract<InterruptedFlow, { kind: "destination" }>,
): DecodedClaimSurface {
  const destinations = filterValidDestinations(flow.destinations);
  if (destinations.length === 0) {
    const screen = resolveDestinationExitScreen(activeRun);
    if (screen !== "destination") {
      return { rewardState: null, companionRewardCards: null, screen };
    }
  }

  return {
    rewardState: {
      ...createEmptyRewardState(destinations.length > 0 ? destinations : undefined),
      selectedBossId: flow.selectedBossId,
      lastVictoryEnemyType: flow.lastVictoryEnemyType,
      lastVictoryContentSystem: flow.lastVictoryContentSystem,
    },
    companionRewardCards: null,
    screen: "destination",
  };
}

export function decodeInterruptedFlow(activeRun: ActiveRunData): DecodedClaimSurface {
  const flow = activeRun.interruptedFlow;
  switch (flow.kind) {
    case "companion-reward":
      return restoreCompanionHandoff(activeRun.currentScreen, flow.pending);
    case "primary-reward":
      return restorePrimaryPendingReward(activeRun.currentScreen, flow.pending);
    case "destination":
      return restoreDestinationFlow(activeRun, flow);
    case "none":
      return { rewardState: null, companionRewardCards: null, screen: activeRun.currentScreen };
    default: {
      const _exhaustive: never = flow;
      void _exhaustive;
      return { rewardState: null, companionRewardCards: null, screen: activeRun.currentScreen };
    }
  }
}
