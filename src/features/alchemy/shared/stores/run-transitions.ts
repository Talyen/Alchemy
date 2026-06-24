// Atomic run lifecycle transitions over the consolidated domain store.
import { getBattleStartPlayerHealth } from "@/lib/battle";
import { playDefeat, stopAllSfx } from "@/lib/audio";
import { createActiveRunSnapshot, type ActiveRunData } from "@/lib/active-run-session";
import type { Screen } from "@/lib/routing";
import type { CharacterId, UnlockedTalents, TalentXP } from "@/lib/game-data";
import { computeGearManifest, type GearInstance, type GearLoadouts } from "@/lib/gear";
import { flushAlchemySaveNow } from "@/features/alchemy/shared/storage";
import type { Destination } from "@/features/alchemy/shared/types";
import type { MaterialInventory } from "@/lib/homestead/types";
import { createEmptyRewardState, restoreWildwoodRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import { restorePendingReward, serializePendingReward } from "@/lib/active-run-session";
import {
  hydrateAlchemistState,
  hydrateEquipmentShopState,
  hydrateShopState,
  hydrateTrinketShopState,
  serializeAlchemistState,
  serializeEquipmentShopState,
  serializeShopState,
  serializeTrinketShopState,
} from "@/features/alchemy/run-loop/shop/shop-state-init";
import { getRunDomainStore, useRunDomainStore } from "./run-domain-store";
import { createInitialRunDomainData } from "./run-domain-types";
import { useBattlePresentationStore } from "./battle-presentation-store";
import { useUiStore } from "./ui-store";
import { useAppStore } from "./app-store";
import { getRunSession } from "./run-session-model";

function restoreLabyrinth(store: ReturnType<typeof getRunDomainStore>, activeRun: ActiveRunData): void {
  if (activeRun.labyrinthMap) store.setLabyrinthMap(activeRun.labyrinthMap);
  if (activeRun.activeCombat) {
    store.setActiveLabyrinthModifiers(activeRun.activeCombat.activeLabyrinthModifiers);
    store.setActiveLabyrinthRewardModifiers(activeRun.activeCombat.activeLabyrinthRewardModifiers);
  }
  if (activeRun.labyrinthPendingNode) store.setActiveLabyrinthPendingNode(activeRun.labyrinthPendingNode);
}

function restoreWildwoodReward(store: ReturnType<typeof getRunDomainStore>, activeRun: ActiveRunData): void {
  const wildwoodDraft = activeRun.wildwoodDraft;
  if (!wildwoodDraft?.rewardType) return;
  if (wildwoodDraft.phase !== "reward" && wildwoodDraft.phase !== "recovery") return;
  store.setRewardState(
    restoreWildwoodRewardState(
      wildwoodDraft.rewardType,
      wildwoodDraft.rewardChoiceIds,
      wildwoodDraft.selectedRewardId,
      wildwoodDraft.rewardGearChoices,
    ),
  );
}

function restoreReward(store: ReturnType<typeof getRunDomainStore>, activeRun: ActiveRunData): void {
  if (activeRun.currentScreen === "destination" && activeRun.destinationChoices.length > 0) {
    store.setRewardState({ ...createEmptyRewardState(), destinations: activeRun.destinationChoices as Destination[] });
  } else if (activeRun.pendingReward) {
    const restored = restorePendingReward(activeRun.pendingReward);
    if (restored) store.setRewardState(restored);
  }
}

function restoreShops(store: ReturnType<typeof getRunDomainStore>, activeRun: ActiveRunData): void {
  if (activeRun.shopState) store.setShopState(hydrateShopState(activeRun.shopState));
  if (activeRun.alchemistState) store.setAlchemistState(hydrateAlchemistState(activeRun.alchemistState));
  if (activeRun.trinketShopState) store.setTrinketShopState(hydrateTrinketShopState(activeRun.trinketShopState));
  if (activeRun.equipmentShopState)
    store.setEquipmentShopState(hydrateEquipmentShopState(activeRun.equipmentShopState));
}

/** Apply persisted active-run data to the domain store atomically. */
export function restoreRun(
  activeRun: ActiveRunData | null,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
): void {
  const store = getRunDomainStore();
  store.initialize(activeRun, talentXP, unlockedTalents);
  store.initializeActiveBattle(activeRun?.activeCombat?.battleState ?? null);

  if (activeRun?.currentScreen) store.setScreen(activeRun.currentScreen);
  if (!activeRun) return;

  store.setHasActiveRun(true);
  store.setWildwoodDraft(activeRun.wildwoodDraft);
  restoreLabyrinth(store, activeRun);
  restoreWildwoodReward(store, activeRun);
  restoreReward(store, activeRun);
  restoreShops(store, activeRun);
}

/** Active-run snapshot for autosave — null when the run has ended. */
export function resolveActiveRunForSave(hasActiveRun: boolean, screen?: Screen): ActiveRunData | null {
  return hasActiveRun ? snapshotRun(screen) : null;
}

/** Serialize domain store into persisted ActiveRunData. */
export function snapshotRun(screen?: Screen): ActiveRunData {
  const { run, session, battle } = getRunSession(screen);
  const currentScreen = screen ?? getRunDomainStore().navigation.screen;
  const pendingReward = session.rewardState.choices.length > 0 ? serializePendingReward(session.rewardState) : null;
  const persistShop = currentScreen === "shop" || session.shopState.cards.length > 0;
  const persistAlchemist = currentScreen === "alchemist" || session.alchemistState.potions.length > 0;
  const persistTrinketShop = currentScreen === "trinket-shop" || session.trinketShopState.trinkets.length > 0;
  const persistEquipmentShop = currentScreen === "equipment-shop" || session.equipmentShopState.gear.length > 0;
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
    shopState: persistShop ? serializeShopState(session.shopState) : null,
    alchemistState: persistAlchemist ? serializeAlchemistState(session.alchemistState) : null,
    trinketShopState: persistTrinketShop ? serializeTrinketShopState(session.trinketShopState) : null,
    equipmentShopState: persistEquipmentShop ? serializeEquipmentShopState(session.equipmentShopState) : null,
  });
}

/** Apply gear max-health bonus delta after armory equip/unequip during an active run. */
export function syncRunMaxHealthFromGear(
  characterId: CharacterId,
  inventory: GearInstance[],
  loadoutsBefore: GearLoadouts,
  loadoutsAfter: GearLoadouts,
): void {
  syncRunMaxHealthFromGearMutation(characterId, inventory, loadoutsBefore, inventory, loadoutsAfter);
}

/** Apply gear max-health bonus delta after armory gear inventory/loadout mutations during an active run. */
export function syncRunMaxHealthFromGearMutation(
  characterId: CharacterId,
  inventoryBefore: GearInstance[],
  loadoutsBefore: GearLoadouts,
  inventoryAfter: GearInstance[],
  loadoutsAfter: GearLoadouts,
): void {
  const oldBonus = computeGearManifest(characterId, inventoryBefore, loadoutsBefore).maxHealth;
  const newBonus = computeGearManifest(characterId, inventoryAfter, loadoutsAfter).maxHealth;
  const delta = newBonus - oldBonus;
  if (delta === 0) return;

  const store = getRunDomainStore();
  const nextMax = store.progress.runMaxHealth + delta;
  store.setRunMaxHealth(nextMax);
  store.setRunPlayerHealth(Math.min(nextMax, store.progress.runPlayerHealth));
}

/** Clamp run HP for battle entry and persist before creating BattleState. */
export function syncRunToBattleStart(playerHealth?: number): number {
  const store = getRunDomainStore();
  const startingHealth =
    playerHealth ??
    getBattleStartPlayerHealth(store.progress.runPlayerHealth, store.progress.runMaxHealth, store.progress.runTrinkets);
  store.setRunPlayerHealth(startingHealth);
  return startingHealth;
}

/** Persist combat HP to run progress after victory or when leaving battle. */
export function syncBattleToRun(options?: { playerHealth?: number }): void {
  const store = getRunDomainStore();
  const health = options?.playerHealth ?? store.battle.battleState.playerHealth;
  store.setRunPlayerHealth(health);
}

/** Clear the battle-active flag and battle-related presentation state. */
export function clearBattleUi(): void {
  getRunDomainStore().setHasActiveBattle(false);
  useUiStore.getState().clearCardHover();
  useBattlePresentationStore.getState().clearCardGhosts();
}

/** Clear active combat, run progression, session UI, navigation, and presentation. */
export function teardownRun(): void {
  useRunDomainStore.setState((state) => {
    const characterId = state.progress.characterId;
    const talentXP = state.progress.talentXP;
    const unlockedTalents = state.progress.unlockedTalents;
    const materialInventory = state.progress.materialInventory;
    const constructedBuildings = state.progress.constructedBuildings;
    const plantedFarms = state.progress.plantedFarms;
    const completedResearch = state.progress.completedResearch;
    const bondedCompanions = state.progress.bondedCompanions;
    const effects = state.progress.effects;
    const fresh = createInitialRunDomainData();
    state.progress = {
      ...fresh.progress,
      characterId,
      talentXP,
      unlockedTalents,
      materialInventory,
      constructedBuildings,
      plantedFarms,
      completedResearch,
      bondedCompanions,
      effects,
      initialized: true,
    };
    state.session = { ...fresh.session, pendingContentSystemType: "campaign" };
    state.navigation = fresh.navigation;
    state.battle = fresh.battle;
  });
  useBattlePresentationStore.getState().resetPresentation();
  useUiStore.getState().clearCardHover();
}

/** Write the full save file immediately (bypasses autosave debounce). */
export async function flushPersistedSave(activeRun: ActiveRunData | null): Promise<void> {
  await flushAlchemySaveNow(activeRun);
}

/** Persist meta/talent progress after a run ends with no resumable active run. */
export function flushSaveAfterRunEnd(): void {
  void flushPersistedSave(null);
}

/** Shared run-end bookkeeping: materials, XP, save flush, and clear active-run flag. */
export function finalizeRunEndSession(options: {
  awardRunEndMaterials: (displayMaterials?: MaterialInventory | null) => MaterialInventory;
  finalizeRunXP: () => void;
  displayMaterials?: MaterialInventory | null;
}): MaterialInventory {
  const activeChar = useRunDomainStore.getState().progress.characterId;
  useAppStore.getState().setFinishedRunCharacters((prev) => {
    if (prev.includes(activeChar)) return prev;
    return [...prev, activeChar];
  });

  const materials = options.awardRunEndMaterials(options.displayMaterials);
  options.finalizeRunXP();

  flushSaveAfterRunEnd();
  getRunDomainStore().setHasActiveRun(false);
  return materials;
}

/** Defeat flow: finalize rewards/XP, persist, audio, and clear combat state. */
export function applyRunDefeatTeardown(options: {
  awardRunEndMaterials: (displayMaterials?: MaterialInventory | null) => MaterialInventory;
  finalizeRunXP: () => void;
  clearCombatState: () => void;
}): void {
  finalizeRunEndSession({
    awardRunEndMaterials: options.awardRunEndMaterials,
    finalizeRunXP: options.finalizeRunXP,
  });
  stopAllSfx();
  playDefeat();
  options.clearCombatState();
}
