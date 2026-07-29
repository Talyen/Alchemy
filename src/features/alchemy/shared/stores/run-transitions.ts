// Atomic run lifecycle transitions across the run-domain, profile, transient, and battle stores.
import { getBattleStartPlayerHealth } from "@/lib/battle";
import { playDefeat, stopAllSfx } from "@/lib/audio";
import {
  createActiveRunSnapshot,
  serializeAlchemistState,
  serializeEquipmentShopState,
  serializePendingReward,
  serializeShopState,
  serializeTrinketShopState,
  type ActiveRunData,
} from "@/lib/active-run-session";
import type { Screen } from "@/lib/routing";
import type { CharacterId, UnlockedTalents, TalentXP } from "@/lib/game-data";
import { computeGearManifest, type GearInstance, type GearLoadouts } from "@/lib/gear";
import { flushAlchemySaveNow } from "@/features/alchemy/shared/storage/flush-save";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { getRunDomainStore, useRunDomainStore } from "./run-domain-store";
import { getRunProfileStore } from "./run-profile-store";
import { getRunTransientStore, resetRunTransientStore } from "./run-transient-store";
import { getRunBattleDomainStore, resetRunBattleDomainStore } from "./run-battle-domain-store";
import { createInitialRunDomainData } from "./run-domain-types";
import { clearBattlePresentationCardGhosts, resetBattlePresentation } from "./battle-presentation-bridge";
import { useUiStore } from "./ui-store";
import { useProfileStore } from "./profile-store";
import { getRunSession } from "./run-session-model";
import { restoreLabyrinth, restoreReward, restoreShops, restoreWildwoodReward } from "./restore-active-run-session";

/** Apply persisted active-run data across the run-lifetime stores atomically. */
export function restoreRun(
  activeRun: ActiveRunData | null,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
): void {
  const store = getRunDomainStore();
  store.initialize(activeRun);
  getRunProfileStore().applyTalentState(talentXP, unlockedTalents);
  getRunBattleDomainStore().initializeActiveBattle(activeRun?.activeCombat?.battleState ?? null);

  if (activeRun?.currentScreen) store.setScreen(activeRun.currentScreen);
  if (!activeRun) return;

  const session = getRunTransientStore();
  session.setHasActiveRun(true);
  session.setWildwoodDraft(activeRun.wildwoodDraft);
  restoreLabyrinth(session, activeRun);
  restoreWildwoodReward(session, activeRun);
  restoreReward(session, activeRun, store.setScreen);
  restoreShops(session, activeRun);
}

/** Active-run snapshot for autosave — null when the run has ended. */
export function resolveActiveRunForSave(hasActiveRun: boolean, screen?: Screen): ActiveRunData | null {
  return hasActiveRun ? snapshotRun(screen) : null;
}

/** Serialize the run-lifetime stores into persisted ActiveRunData. */
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
  const nextMax = store.activeRun.runMaxHealth + delta;
  store.setRunMaxHealth(nextMax);
  store.setRunPlayerHealth(Math.min(nextMax, store.activeRun.runPlayerHealth));
}

/** Clamp run HP for battle entry and persist before creating BattleState. */
export function syncRunToBattleStart(playerHealth?: number): number {
  const store = getRunDomainStore();
  const startingHealth =
    playerHealth ??
    getBattleStartPlayerHealth(
      store.activeRun.runPlayerHealth,
      store.activeRun.runMaxHealth,
      store.activeRun.runTrinkets,
    );
  store.setRunPlayerHealth(startingHealth);
  return startingHealth;
}

/** Persist combat HP to run progress after victory or when leaving battle. */
export function syncBattleToRun(options?: { playerHealth?: number }): void {
  const health = options?.playerHealth ?? getRunBattleDomainStore().battleState.playerHealth;
  getRunDomainStore().setRunPlayerHealth(health);
}

/** Clear the battle-active flag and battle-related presentation state. */
export function clearBattleUi(): void {
  getRunBattleDomainStore().setHasActiveBattle(false);
  useUiStore.getState().clearCardHover();
  clearBattlePresentationCardGhosts();
}

/** Clear active combat, run progression, session UI, navigation, and presentation (profile survives). */
export function teardownRun(): void {
  useRunDomainStore.setState((state) => {
    const fresh = createInitialRunDomainData();
    state.activeRun = { ...fresh.activeRun, characterId: state.activeRun.characterId };
    state.initialized = true;
    state.navigation = fresh.navigation;
  });
  resetRunTransientStore();
  resetRunBattleDomainStore();
  resetBattlePresentation();
  useUiStore.getState().clearCardHover();
}

/** Write the full save file immediately (bypasses autosave debounce). */
async function flushPersistedSave(activeRun: ActiveRunData | null): Promise<void> {
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
  const session = getRunTransientStore();
  // Re-entry guard: run-end rewards are granted once per active run (menu abandon, defeat, victory).
  if (!session.hasActiveRun) {
    return emptyInventory();
  }

  const activeChar = getRunDomainStore().activeRun.characterId;
  useProfileStore.getState().setFinishedRunCharacters((prev) => {
    if (prev.includes(activeChar)) return prev;
    return [...prev, activeChar];
  });

  const materials = options.awardRunEndMaterials(options.displayMaterials);
  options.finalizeRunXP();

  flushSaveAfterRunEnd();
  getRunTransientStore().setHasActiveRun(false);
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
