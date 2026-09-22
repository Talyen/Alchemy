import { wildcardStarterResumeTarget } from "@/features/alchemy/shared/run-flow/starter-draft";
import { wildwoodPhaseToScreen } from "@/features/alchemy/shared/run-flow/wildwood-screen-routing";
import {
  createEmptyRewardState,
  restorePendingRewardBundle,
  serializePendingReward,
  type ActiveRunData,
  type InterruptedFlow,
  type PersistedPendingReward,
  type RewardState,
} from "@/lib/active-run-session";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { BattleCard } from "@/lib/game-data";
import { filterValidDestinations, isRunResumeScreen, type Screen } from "@/lib/routing";
import type { RunSession } from "./run-reads";

export interface DecodedClaimSurface {
  rewardState: RewardState | null;
  companionRewardCards: BattleCard[] | null;
  screen: Screen | null;
}

function resolveExplorationScreen(
  labyrinthMap: LabyrinthMap | null | undefined,
  wildwoodDraft: WildwoodDraftState | null | undefined,
): Screen {
  if (labyrinthMap) return "labyrinth-map";
  if (wildwoodDraft) {
    return wildwoodPhaseToScreen(wildwoodDraft.phase) ?? "destination";
  }
  return "destination";
}

function encodeDestinationFlow(session: RunSession["session"]): InterruptedFlow {
  return {
    kind: "destination",
    destinations: [...session.rewardFlow.state.destinations],
    selectedBossId: session.rewardFlow.state.selectedBossId,
    lastVictoryEnemyType: session.rewardFlow.state.lastVictoryEnemyType,
    lastVictoryContentSystem: session.rewardFlow.state.lastVictoryContentSystem,
  };
}

export function encodeInterruptedFlow(
  session: RunSession["session"],
  currentScreen: Screen | null | undefined,
): InterruptedFlow {
  if (currentScreen === "rewards") {
    const pending = serializePendingReward(session.rewardFlow.state, session.rewardFlow.companionCards);
    return pending ? { kind: "primary-reward", pending } : { kind: "none" };
  }

  if (currentScreen === "destination") {
    return encodeDestinationFlow(session);
  }

  const pending = serializePendingReward(session.rewardFlow.state, session.rewardFlow.companionCards);
  // serializePendingReward already returns null when there is nothing of value
  // (no choices, no companion cards, no victory markers, no destinations, no
  // gold/materials), so any non-null pending must survive — including
  // gold/materials-only rewards with no card choices.
  if (pending) {
    return { kind: "primary-reward", pending };
  }

  return { kind: "none" };
}

function resolveDestinationExitScreen(activeRun: ActiveRunData): Screen {
  return resolveExplorationScreen(activeRun.labyrinthMap, activeRun.wildwoodDraft);
}

export function inferActiveRunScreen(activeRun: ActiveRunData): Screen {
  if (activeRun.activeCombat) return "battle";
  const starterResume = wildcardStarterResumeTarget({
    ...activeRun,
    runDeckLength: activeRun.runDeck.length,
  });
  if (starterResume) return starterResume;
  if (activeRun.currentScreen && activeRun.currentScreen !== "battle" && isRunResumeScreen(activeRun.currentScreen))
    return activeRun.currentScreen;
  if (activeRun.interruptedFlow.kind === "primary-reward" || activeRun.interruptedFlow.kind === "companion-reward") {
    return "rewards";
  }
  if (activeRun.interruptedFlow.kind === "destination") return "destination";
  if (activeRun.mysteryVisit) return "mystery";
  if (activeRun.corruptionResult) return "corruption";
  if (activeRun.shopState) return "shop";
  if (activeRun.alchemistState) return "alchemist";
  if (activeRun.trinketShopState) return "trinket-shop";
  if (activeRun.equipmentShopState) return "equipment-shop";
  return resolveExplorationScreen(activeRun.labyrinthMap, activeRun.wildwoodDraft);
}

function restoreCompanionHandoff(pending: PersistedPendingReward): DecodedClaimSurface {
  const { companionRewardCards } = restorePendingRewardBundle(pending);
  // Intentional asymmetry with restorePrimaryPendingReward below: the companion
  // handoff consumes its cards into rewardState.choices, so there is no
  // separate companion pile left to carry.
  return {
    rewardState: {
      ...createEmptyRewardState(filterValidDestinations(pending.destinations)),
      choices: companionRewardCards ?? [],
      selectedBossId: pending.selectedBossId,
      lastVictoryEnemyType: pending.lastVictoryEnemyType,
      lastVictoryContentSystem: pending.lastVictoryContentSystem,
    },
    companionRewardCards: null,
    screen: "rewards",
  };
}

function restorePrimaryPendingReward(
  activeRun: ActiveRunData,
  currentScreen: Screen | null,
  pending: PersistedPendingReward,
): DecodedClaimSurface {
  const restored = restorePendingRewardBundle(pending);
  const companionRewardCards = restored.companionRewardCards;
  let rewardState = restored.rewardState;
  let screen = currentScreen;
  if (!rewardState) {
    rewardState = {
      ...createEmptyRewardState(filterValidDestinations(pending.destinations)),
      gold: pending.gold,
      materials: pending.materials,
      selectedBossId: pending.selectedBossId,
      lastVictoryEnemyType: pending.lastVictoryEnemyType,
      lastVictoryContentSystem: pending.lastVictoryContentSystem,
    };
    screen = "rewards";
  } else if (
    screen !== "rewards" &&
    screen !== "battle" &&
    !activeRun.shopState &&
    !activeRun.alchemistState &&
    !activeRun.trinketShopState &&
    !activeRun.equipmentShopState &&
    !activeRun.mysteryVisit &&
    !activeRun.corruptionResult
  ) {
    // A pending reward can only be claimed from the rewards screen (see
    // claimRunReward). When the save was written after the screen moved on —
    // e.g. a gold/materials-only reward with no card choices — resume where it
    // can be claimed instead of stranding it behind a stateless screen. A live
    // battle owns the resume, and a persisted shop/mystery/corruption visit
    // wins over the stranded reward.
    screen = "rewards";
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
      return restoreCompanionHandoff(flow.pending);
    case "primary-reward":
      return restorePrimaryPendingReward(activeRun, activeRun.currentScreen, flow.pending);
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
