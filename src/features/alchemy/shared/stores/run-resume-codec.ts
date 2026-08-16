// Canonical boundary between aggregate run state and persisted resume data.
// Keeping this translation in one module prevents autosave and boot hydration from
// growing independent field-by-field mappings.
import { isPlayerDefeated } from "@/lib/battle";
import {
  createEmptyRewardState,
  hydrateAlchemistState,
  hydrateEquipmentShopState,
  emptyHydratedMysteryVisit,
  hydrateMysteryVisit,
  hydrateShopState,
  hydrateTrinketShopState,
  restorePendingRewardBundle,
  restoreWildwoodRewardState,
  serializeAlchemistState,
  serializeEquipmentShopState,
  serializeMysteryVisit,
  serializePendingReward,
  serializeShopState,
  serializeTrinketShopState,
  type ActiveRunData,
  type AlchemistState,
  type EquipmentShopState,
  type InterruptedFlow,
  type LabyrinthNodePosition,
  type PersistedAlchemistState,
  type PersistedBattleTransition,
  type PersistedEquipmentShopState,
  type PersistedMysteryVisit,
  type PersistedPendingReward,
  type PersistedShopState,
  type PersistedTrinketShopState,
  type RewardState,
  type ShopState,
  type TrinketShopState,
} from "@/lib/active-run-session";
import type { CorruptionResult } from "@/lib/corruption";
import type { EncounterCombatTraitId, EncounterRewardTraitId, LabyrinthMap } from "@/lib/content-systems/types";
import type { BattleCard } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { MysteryChoice, MysteryEvent } from "@/lib/mystery";
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
  mysteryEvent: MysteryEvent | null;
  mysteryChosenChoice: MysteryChoice | null;
  mysteryPendingRemoval: boolean;
  mysteryCardChoices: BattleCard[] | null;
  mysteryGrantedTrinketIds: string[];
  mysteryGrantedGearInstances: GearInstance[];
  mysteryChosenCardId: string | null;
  corruptionResult: CorruptionResult | null;
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

interface EncodeResumeFields {
  currentScreen: Screen | null;
  interruptedFlow: InterruptedFlow;
  shopState: PersistedShopState | null;
  alchemistState: PersistedAlchemistState | null;
  trinketShopState: PersistedTrinketShopState | null;
  equipmentShopState: PersistedEquipmentShopState | null;
  mysteryVisit: PersistedMysteryVisit | null;
  corruptionResult: CorruptionResult | null;
}

/** Encode the aggregate run read model directly into persisted ActiveRunData. */
function toActiveRunData(source: RunSession, resume: EncodeResumeFields): ActiveRunData {
  const { run, session, battle } = source;
  // Drop fields joined only for the committed session read model before spreading
  // the canonical active-run progress projection into persistence.
  const {
    initialized: _initialized,
    talentXP: _talentXP,
    unlockedTalents: _unlockedTalents,
    ...activeRunProgress
  } = run;
  void _initialized;
  void _talentXP;
  void _unlockedTalents;
  const progress = pickActiveRunFields(activeRunProgress);
  const activeCombat =
    battle.hasActiveBattle && battle.battleState.enemyHealth > 0 && !isPlayerDefeated(battle.battleState)
      ? {
          battleState: battle.battleState,
          pendingBattleTransition: battle.pendingBattleTransition ?? null,
          activeLabyrinthModifiers: progress.contentSystemType === "labyrinth" ? session.activeLabyrinthModifiers : [],
          activeLabyrinthRewardModifiers:
            progress.contentSystemType === "labyrinth" ? session.activeLabyrinthRewardModifiers : [],
        }
      : null;

  return {
    ...progress,
    destinationRoundsSinceOffered: { ...progress.destinationRoundsSinceOffered },
    rng: { seed: progress.rng.seed, counters: { ...progress.rng.counters } },
    labyrinthMap: progress.contentSystemType === "labyrinth" ? session.labyrinthMap : null,
    labyrinthPendingNode: progress.contentSystemType === "labyrinth" ? session.activeLabyrinthPendingNode : null,
    wildwoodDraft: progress.contentSystemType === "wildwood" ? session.wildwoodDraft : null,
    activeCombat,
    currentScreen: resume.currentScreen,
    interruptedFlow: resume.interruptedFlow,
    shopState: resume.shopState,
    alchemistState: resume.alchemistState,
    trinketShopState: resume.trinketShopState,
    equipmentShopState: resume.equipmentShopState,
    mysteryVisit: resume.mysteryVisit,
    corruptionResult: resume.corruptionResult,
  };
}

function encodePersistedShops(
  session: RunSession["session"],
  currentScreen: Screen | null | undefined,
): Pick<EncodeResumeFields, "shopState" | "alchemistState" | "trinketShopState" | "equipmentShopState"> {
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

function encodeMysteryVisit(
  session: RunSession["session"],
  currentScreen: Screen | null | undefined,
): PersistedMysteryVisit | null {
  if (currentScreen !== "mystery") return null;
  return serializeMysteryVisit(session);
}

function encodeCorruptionResult(
  session: RunSession["session"],
  currentScreen: Screen | null | undefined,
): CorruptionResult | null {
  if (currentScreen !== "corruption" && !session.corruptionResult) return null;
  return session.corruptionResult;
}
export function encodeRunResumeSnapshot(source: RunSession, screen?: Screen): ActiveRunData {
  const requestedScreen = screen ?? source.screen;
  const currentScreen = resolveEncodeScreen(requestedScreen, source.session) ?? requestedScreen;
  return toActiveRunData(source, {
    currentScreen,
    interruptedFlow: encodeInterruptedFlow(source.session, currentScreen),
    ...encodePersistedShops(source.session, currentScreen),
    mysteryVisit: encodeMysteryVisit(source.session, currentScreen),
    corruptionResult: encodeCorruptionResult(source.session, currentScreen),
  });
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

  const mysteryVisit = screen === "mystery" ? hydrateMysteryVisit(activeRun.mysteryVisit) : emptyHydratedMysteryVisit();

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
      ...mysteryVisit,
      corruptionResult: activeRun.corruptionResult,
    },
  };
}
