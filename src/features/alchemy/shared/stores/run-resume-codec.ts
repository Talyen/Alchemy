// Canonical boundary between aggregate run state and persisted resume data.
// Keeping this translation in one module prevents autosave and boot hydration from
// growing independent field-by-field mappings.
import {
  createActiveRunSnapshot,
  createEmptyRewardState,
  hydrateAlchemistState,
  hydrateEquipmentShopState,
  hydrateShopState,
  hydrateTrinketShopState,
  restorePendingRewardBundle,
  restoreWildwoodRewardState,
  serializeAlchemistState,
  serializeEquipmentShopState,
  serializePendingReward,
  serializeShopState,
  serializeTrinketShopState,
  type ActiveRunData,
  type ActiveRunSnapshotSource,
  type AlchemistState,
  type EquipmentShopState,
  type InterruptedFlow,
  type LabyrinthNodePosition,
  type PersistedBattleTransition,
  type PersistedPendingReward,
  type RewardState,
  type ShopState,
  type TrinketShopState,
} from "@/lib/active-run-session";
import type { EncounterCombatTraitId, EncounterRewardTraitId, LabyrinthMap } from "@/lib/content-systems/types";
import type { BattleCard } from "@/lib/game-data";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { emptyInventory } from "@/lib/homestead/inventory";
import { filterValidDestinations, type Screen } from "@/lib/routing";
import { createInitialActiveRunFields, pickActiveRunFields, type ActiveRunProgressFields } from "./run-state-init";
import type { RunSession } from "./run-session-model";

export interface DecodedRunResumeSession {
  labyrinthMap: LabyrinthMap | null;
  labyrinthPendingNode: LabyrinthNodePosition | null;
  activeLabyrinthModifiers: EncounterCombatTraitId[];
  activeLabyrinthRewardModifiers: EncounterRewardTraitId[];
  wildwoodDraft: WildwoodDraftState | null;
  rewardState: RewardState | null;
  companionRewardCards: BattleCard[] | null;
  shopState: ShopState | null;
  alchemistState: AlchemistState | null;
  trinketShopState: TrinketShopState | null;
  equipmentShopState: EquipmentShopState | null;
}

export interface DecodedRunResumeSnapshot {
  progress: ActiveRunProgressFields;
  screen: Screen | null;
  pendingBattleTransition: PersistedBattleTransition | null;
  session: DecodedRunResumeSession;
}

interface DecodedClaimSurface {
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

function resolveEncodeScreen(
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
      const phase = session.wildwoodDraft.phase;
      if (phase === "removal") return "wildwood-removal";
      if (phase === "recovery") return "wildwood-recovery";
      if (phase === "reward") return "rewards";
      if (phase === "draft") return "draft-deck";
      if (phase === "battle") return "battle";
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

function encodeInterruptedFlow(
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
    const phase = activeRun.wildwoodDraft.phase;
    if (phase === "removal") return "wildwood-removal";
    if (phase === "recovery") return "wildwood-recovery";
    if (phase === "draft") return "draft-deck";
    if (phase === "battle") return "battle";
  }
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

function decodeInterruptedFlow(activeRun: ActiveRunData): DecodedClaimSurface {
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

function resolvePendingBattleTransition(activeRun: ActiveRunData): PersistedBattleTransition | null {
  const pending = activeRun.activeCombat?.pendingBattleTransition ?? null;
  if (pending) return pending;
  if (activeRun.activeCombat?.battleState.turnPhase === "enemy") {
    return { kind: "legacy-enemy-turn" };
  }
  return null;
}

type ResumeEncodeFields = Pick<
  ActiveRunSnapshotSource,
  "currentScreen" | "interruptedFlow" | "shopState" | "alchemistState" | "trinketShopState" | "equipmentShopState"
>;

/** Map aggregate session → snapshot source; progress fields spread once (no second ActiveRunData table). */
function toActiveRunSnapshotSource(source: RunSession, resume: ResumeEncodeFields): ActiveRunSnapshotSource {
  const { run, session, battle } = source;
  // Drop permanent talent + initialized flags from the session run slice.
  const progress = pickActiveRunFields(run);
  return {
    ...progress,
    destinationRoundsSinceOffered: { ...progress.destinationRoundsSinceOffered },
    labyrinthMap: session.labyrinthMap,
    hasActiveBattle: battle.hasActiveBattle,
    battleState: battle.battleState,
    pendingBattleTransition: battle.pendingBattleTransition,
    labyrinthPendingNode: session.activeLabyrinthPendingNode,
    wildwoodDraft: session.wildwoodDraft,
    activeLabyrinthModifiers: session.activeLabyrinthModifiers,
    activeLabyrinthRewardModifiers: session.activeLabyrinthRewardModifiers,
    ...resume,
  };
}

function encodePersistedShops(
  session: RunSession["session"],
  currentScreen: Screen | null | undefined,
): Pick<ResumeEncodeFields, "shopState" | "alchemistState" | "trinketShopState" | "equipmentShopState"> {
  return {
    shopState:
      currentScreen === "shop" || session.shopState.cards.length > 0 ? serializeShopState(session.shopState) : null,
    alchemistState:
      currentScreen === "alchemist" || session.alchemistState.potions.length > 0
        ? serializeAlchemistState(session.alchemistState)
        : null,
    trinketShopState:
      currentScreen === "trinket-shop" || session.trinketShopState.trinkets.length > 0
        ? serializeTrinketShopState(session.trinketShopState)
        : null,
    equipmentShopState:
      currentScreen === "equipment-shop" || session.equipmentShopState.gear.length > 0
        ? serializeEquipmentShopState(session.equipmentShopState)
        : null,
  };
}

/** Encode one aggregate run read model for both autosave and explicit save flows. */
export function encodeRunResumeSnapshot(source: RunSession, screen?: Screen): ActiveRunData {
  const requestedScreen = screen ?? source.screen;
  const currentScreen = resolveEncodeScreen(requestedScreen, source.session) ?? requestedScreen;
  return createActiveRunSnapshot(
    toActiveRunSnapshotSource(source, {
      currentScreen,
      interruptedFlow: encodeInterruptedFlow(source.session, currentScreen),
      ...encodePersistedShops(source.session, currentScreen),
    }),
  );
}

/** Decode persisted resume data into the aggregate session fields. */
export function decodeRunResumeSnapshot(activeRun: ActiveRunData): DecodedRunResumeSnapshot {
  let screen = activeRun.currentScreen;
  let rewardState: RewardState | null = null;
  let companionRewardCards: BattleCard[] | null = null;

  if (activeRun.wildwoodDraft?.rewardType && ["reward", "recovery"].includes(activeRun.wildwoodDraft.phase)) {
    rewardState = restoreWildwoodRewardState(
      activeRun.wildwoodDraft.rewardType,
      activeRun.wildwoodDraft.rewardChoiceIds,
      activeRun.wildwoodDraft.selectedRewardId,
      activeRun.wildwoodDraft.rewardGearChoices,
    );
  }

  if (activeRun.interruptedFlow.kind !== "none") {
    const claim = decodeInterruptedFlow(activeRun);
    rewardState = claim.rewardState;
    companionRewardCards = claim.companionRewardCards;
    screen = claim.screen;
  }

  return {
    progress: createInitialActiveRunFields(activeRun),
    screen,
    pendingBattleTransition: resolvePendingBattleTransition(activeRun),
    session: {
      labyrinthMap: activeRun.labyrinthMap,
      labyrinthPendingNode: activeRun.labyrinthPendingNode,
      activeLabyrinthModifiers: activeRun.activeCombat?.activeLabyrinthModifiers ?? [],
      activeLabyrinthRewardModifiers: activeRun.activeCombat?.activeLabyrinthRewardModifiers ?? [],
      wildwoodDraft: activeRun.wildwoodDraft,
      rewardState,
      companionRewardCards,
      shopState: activeRun.shopState ? hydrateShopState(activeRun.shopState) : null,
      alchemistState: activeRun.alchemistState ? hydrateAlchemistState(activeRun.alchemistState) : null,
      trinketShopState: activeRun.trinketShopState ? hydrateTrinketShopState(activeRun.trinketShopState) : null,
      equipmentShopState: activeRun.equipmentShopState ? hydrateEquipmentShopState(activeRun.equipmentShopState) : null,
    },
  };
}
