// Canonical boundary between the committed run projection and persisted resume data.
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
  type RewardState,
  type ShopState,
  type TrinketShopState,
} from "@/lib/active-run-session";
import type { EncounterCombatTraitId, EncounterRewardTraitId, LabyrinthMap } from "@/lib/content-systems/types";
import type { BattleCard } from "@/lib/game-data";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
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
  session: DecodedRunResumeSession;
}

function validDestinations(values: string[]): Destination[] {
  const allowed = new Set<string>(Object.values(DESTINATIONS));
  return values.filter((value): value is Destination => allowed.has(value));
}

/** Encode one committed run projection for both autosave and explicit save flows. */
export function encodeRunResumeSnapshot(source: RunSession, screen?: Screen): ActiveRunData {
  const { run, session, battle } = source;
  const currentScreen = screen ?? source.screen;
  const pendingReward = serializePendingReward(session.rewardState, session.companionRewardCards);

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

/** Decode persisted resume data into the transient session projection. */
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
    if (!rewardState) {
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
  }

  return {
    progress: createInitialActiveRunFields(activeRun),
    screen,
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
