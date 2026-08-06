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
  type AlchemistState,
  type EquipmentShopState,
  type LabyrinthNodePosition,
  type PersistedBattleTransition,
  type PersistedPendingReward,
  type RewardState,
  type ShopState,
  type TrinketShopState,
} from "@/lib/active-run-session";
import type { ResumePhase } from "@/lib/validation";
import type { EncounterCombatTraitId, EncounterRewardTraitId, LabyrinthMap } from "@/lib/content-systems/types";
import type { BattleCard } from "@/lib/game-data";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { emptyInventory } from "@/lib/homestead/inventory";
import { filterValidDestinations, type Screen } from "@/lib/routing";
import { createInitialActiveRunFields, type ActiveRunProgressFields } from "./run-state-init";
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

function encodeResumePhase(session: RunSession["session"], currentScreen: Screen | null | undefined): ResumePhase {
  if (session.rewardClaimInFlight) {
    if (session.companionRewardCards?.length) return "companion-reward";
    // Match resolveEncodeScreen: post-claim destination / hollow rewards need destination phase.
    if (session.rewardState.destinations.length > 0 || currentScreen === "destination" || currentScreen === "rewards") {
      return "destination";
    }
    return "none";
  }

  if (currentScreen === "rewards" && session.rewardState.choices.length > 0) {
    return "primary-reward";
  }

  // Destination phase: destination screen, or rewards with no primary/companion choices left.
  if (currentScreen === "destination" || (currentScreen === "rewards" && session.rewardState.choices.length === 0)) {
    return "destination";
  }

  return "none";
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

function restoreCompanionHandoff(
  activeRun: ActiveRunData,
  restored: ReturnType<typeof restorePendingRewardBundle>,
): { rewardState: RewardState | null; companionRewardCards: BattleCard[] | null; screen: Screen | null } {
  let { rewardState, companionRewardCards } = restored;
  let screen = activeRun.currentScreen;

  if (companionRewardCards?.length && (!rewardState || rewardState.choices.length === 0)) {
    rewardState = {
      ...(rewardState ?? createEmptyRewardState(filterValidDestinations(activeRun.pendingReward!.destinations))),
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

function restorePrimaryPendingReward(activeRun: ActiveRunData): {
  rewardState: RewardState | null;
  companionRewardCards: BattleCard[] | null;
  screen: Screen | null;
} {
  if (!activeRun.pendingReward) {
    return { rewardState: null, companionRewardCards: null, screen: activeRun.currentScreen };
  }
  const restored = restorePendingRewardBundle(activeRun.pendingReward);
  const companionRewardCards = restored.companionRewardCards;
  let rewardState = restored.rewardState;
  let screen = activeRun.currentScreen;
  if (!rewardState && activeRun.pendingReward.destinations.length > 0) {
    rewardState = createEmptyRewardState(filterValidDestinations(activeRun.pendingReward.destinations));
    screen = "destination";
  }
  return { rewardState, companionRewardCards, screen };
}

function restoreDestinationPhase(activeRun: ActiveRunData): {
  rewardState: RewardState | null;
  screen: Screen | null;
} {
  if (activeRun.currentScreen === "rewards" && !activeRun.pendingReward) {
    const screen = resolveDestinationExitScreen(activeRun);
    return {
      screen,
      rewardState: screen === "destination" ? createEmptyRewardState() : null,
    };
  }
  const destinations = filterValidDestinations(
    activeRun.destinationChoices.length > 0
      ? activeRun.destinationChoices
      : (activeRun.pendingReward?.destinations ?? []),
  );
  return {
    rewardState: createEmptyRewardState(destinations.length > 0 ? destinations : undefined),
    screen: "destination",
  };
}

/**
 * Infer claim surface when resumePhase is missing/defaulted to none (pre-field saves).
 * Prefer explicit resumePhase when present.
 */
function inferResumeFromLegacySignals(activeRun: ActiveRunData): {
  rewardState: RewardState | null;
  companionRewardCards: BattleCard[] | null;
  screen: Screen | null;
} {
  if (activeRun.currentScreen === "destination" && activeRun.destinationChoices.length > 0) {
    return {
      rewardState: createEmptyRewardState(filterValidDestinations(activeRun.destinationChoices)),
      companionRewardCards: null,
      screen: activeRun.currentScreen,
    };
  }

  if (activeRun.pendingReward) {
    const handoff = restoreCompanionHandoff(activeRun, restorePendingRewardBundle(activeRun.pendingReward));
    if (handoff.rewardState || handoff.companionRewardCards) {
      return handoff;
    }
    return restorePrimaryPendingReward(activeRun);
  }

  if (activeRun.currentScreen === "rewards" && activeRun.destinationChoices.length > 0) {
    return {
      rewardState: createEmptyRewardState(filterValidDestinations(activeRun.destinationChoices)),
      companionRewardCards: null,
      screen: "destination",
    };
  }

  if (activeRun.currentScreen === "rewards") {
    const screen = resolveDestinationExitScreen(activeRun);
    return {
      rewardState: screen === "destination" ? createEmptyRewardState() : null,
      companionRewardCards: null,
      screen,
    };
  }

  return { rewardState: null, companionRewardCards: null, screen: activeRun.currentScreen };
}

function resolvePendingBattleTransition(activeRun: ActiveRunData): PersistedBattleTransition | null {
  const pending = activeRun.activeCombat?.pendingBattleTransition ?? null;
  if (pending) return pending;
  if (activeRun.activeCombat?.battleState.turnPhase === "enemy") {
    return { kind: "legacy-enemy-turn" };
  }
  return null;
}

/** Encode one aggregate run read model for both autosave and explicit save flows. */
export function encodeRunResumeSnapshot(source: RunSession, screen?: Screen): ActiveRunData {
  const { run, session, battle } = source;
  const requestedScreen = screen ?? source.screen;
  const currentScreen = resolveEncodeScreen(requestedScreen, session) ?? requestedScreen;
  const pendingReward = session.rewardClaimInFlight
    ? encodeMidClaimPendingReward(session)
    : serializePendingReward(session.rewardState, session.companionRewardCards);
  const resumePhase = encodeResumePhase(session, currentScreen);

  return createActiveRunSnapshot({
    characterId: run.characterId,
    runDeck: run.runDeck,
    runGold: run.runGold,
    runPlayerHealth: run.runPlayerHealth,
    runMaxHealth: run.runMaxHealth,
    roomsEncountered: run.roomsEncountered,
    currentAct: run.currentAct,
    destinationIndexInAct: run.destinationIndexInAct,
    completedDestinations: run.completedDestinations,
    lastOfferedDestinations: run.lastOfferedDestinations,
    destinationRoundsSinceOffered: { ...run.destinationRoundsSinceOffered },
    runTrinkets: run.runTrinkets,
    encounteredRunEnemyIds: run.encounteredRunEnemyIds,
    selectedDifficulty: run.selectedDifficulty,
    contentSystemType: run.contentSystemType,
    rng: run.rng,
    labyrinthMap: session.labyrinthMap,
    hasActiveBattle: battle.hasActiveBattle,
    battleState: battle.battleState,
    pendingBattleTransition: battle.pendingBattleTransition,
    labyrinthPendingNode: session.activeLabyrinthPendingNode,
    wildwoodDraft: session.wildwoodDraft,
    activeLabyrinthModifiers: session.activeLabyrinthModifiers,
    activeLabyrinthRewardModifiers: session.activeLabyrinthRewardModifiers,
    runTalentXP: run.runTalentXP,
    runMaterialsEarned: run.runMaterialsEarned,
    currentScreen,
    destinationChoices: session.rewardState.destinations,
    pendingReward,
    resumePhase,
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

  const resumePhase = activeRun.resumePhase;

  if (resumePhase === "companion-reward" && activeRun.pendingReward) {
    const handoff = restoreCompanionHandoff(activeRun, restorePendingRewardBundle(activeRun.pendingReward));
    rewardState = handoff.rewardState;
    companionRewardCards = handoff.companionRewardCards;
    screen = handoff.screen;
  } else if (resumePhase === "destination") {
    const destination = restoreDestinationPhase(activeRun);
    rewardState = destination.rewardState;
    screen = destination.screen;
  } else if (resumePhase === "primary-reward" && activeRun.pendingReward) {
    const primary = restorePrimaryPendingReward(activeRun);
    rewardState = primary.rewardState;
    companionRewardCards = primary.companionRewardCards;
    screen = primary.screen;
  } else if (resumePhase === "none") {
    // Pre-resumePhase saves and mid-flight gaps: infer from screen / pendingReward signals.
    const inferred = inferResumeFromLegacySignals(activeRun);
    if (inferred.rewardState || inferred.companionRewardCards || inferred.screen !== activeRun.currentScreen) {
      rewardState = inferred.rewardState ?? rewardState;
      companionRewardCards = inferred.companionRewardCards;
      screen = inferred.screen;
    }
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
