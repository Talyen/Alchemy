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
import type { EncounterCombatTraitId, EncounterRewardTraitId, LabyrinthMap } from "@/lib/content-systems/types";
import type { BattleCard } from "@/lib/game-data";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { emptyInventory } from "@/lib/homestead/inventory";
import { DESTINATIONS, type Destination, type Screen } from "@/features/alchemy/shared/types";
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

function validDestinations(values: string[]): Destination[] {
  const allowed = new Set<string>(Object.values(DESTINATIONS));
  return values.filter((value): value is Destination => allowed.has(value));
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

/** Encode one aggregate run read model for both autosave and explicit save flows. */
export function encodeRunResumeSnapshot(source: RunSession, screen?: Screen): ActiveRunData {
  const { run, session, battle } = source;
  const requestedScreen = screen ?? source.screen;
  const currentScreen = resolveEncodeScreen(requestedScreen, session) ?? requestedScreen;
  const pendingReward = session.rewardClaimInFlight
    ? encodeMidClaimPendingReward(session)
    : serializePendingReward(session.rewardState, session.companionRewardCards);

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

  if (activeRun.currentScreen === "destination" && activeRun.destinationChoices.length > 0) {
    rewardState = createEmptyRewardState(validDestinations(activeRun.destinationChoices));
  } else if (activeRun.pendingReward) {
    const restored = restorePendingRewardBundle(activeRun.pendingReward);
    rewardState = restored.rewardState;
    companionRewardCards = restored.companionRewardCards;
    // Mid-claim companion saves use empty primary choiceIds; promote companions to the offer.
    if (companionRewardCards?.length && (!rewardState || rewardState.choices.length === 0)) {
      rewardState = {
        ...(rewardState ?? createEmptyRewardState(validDestinations(activeRun.pendingReward.destinations))),
        rewardType: "card",
        choices: companionRewardCards,
        selectedId: null,
        gold: 0,
        materials: emptyInventory(),
      };
      companionRewardCards = null;
      screen = "rewards";
    } else if (!rewardState) {
      console.warn("Pending reward could not be restored; reward choices were dropped", {
        rewardType: activeRun.pendingReward.rewardType,
      });
      if (activeRun.pendingReward.destinations.length > 0) {
        rewardState = createEmptyRewardState(validDestinations(activeRun.pendingReward.destinations));
        screen = "destination";
      }
    }
  } else if (activeRun.currentScreen === "rewards" && activeRun.destinationChoices.length > 0) {
    // Claim drained mid-transition; resume on destination pick with destinations intact.
    rewardState = createEmptyRewardState(validDestinations(activeRun.destinationChoices));
    screen = "destination";
  } else if (activeRun.currentScreen === "rewards" && !rewardState) {
    // Hollow Rewards with no pending offer — never soft-lock Add/Skip.
    if (activeRun.labyrinthMap) {
      screen = "labyrinth-map";
    } else if (activeRun.wildwoodDraft) {
      const phase = activeRun.wildwoodDraft.phase;
      if (phase === "removal") screen = "wildwood-removal";
      else if (phase === "recovery") screen = "wildwood-recovery";
      else if (phase === "draft") screen = "draft-deck";
      else if (phase === "battle") screen = "battle";
      else screen = "destination";
    } else {
      screen = "destination";
      rewardState = createEmptyRewardState();
    }
  }

  return {
    progress: createInitialActiveRunFields(activeRun),
    screen,
    pendingBattleTransition:
      activeRun.activeCombat?.pendingBattleTransition ??
      (activeRun.activeCombat?.battleState.turnPhase === "enemy" ? { kind: "legacy-enemy-turn" } : null),
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
