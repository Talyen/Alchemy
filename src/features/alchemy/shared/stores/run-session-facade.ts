// Facade over run domain store — reads, writes, sync, snapshot, restore, and teardown.
import { useShallow } from "zustand/react/shallow";
import type { BattleCard, CharacterId } from "@/lib/game-data";
import type { LabyrinthMap, LabyrinthModifierKind, ContentSystemId } from "@/lib/content-systems/types";
import type { CorruptionResult } from "@/lib/corruption";
import type { MysteryEvent } from "@/lib/mystery";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { LabyrinthNodePosition } from "@/lib/active-run-session";
import type { Screen } from "@/lib/routing";
import type { RewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import type { ShopState, AlchemistState } from "@/features/alchemy/run-loop/shop/shop-state-init";
import type { Destination } from "@/features/alchemy/shared/types";
import { getRunSession } from "./run-session-model";
import {
  getBattleStoreView,
  getRunDomainStore,
  getRunProgressStoreView,
  getRunSessionStoreView,
  useRunAdapter,
  useRunDomainStore,
  useTalentAdapter,
} from "./run-domain-store";
import type { RunProgressStore, RunSessionStore } from "./run-domain-types";
import type { RunStateController, TalentStateController } from "./run-domain-store";
import {
  applyRunDefeatTeardown,
  flushPersistedSave,
  flushSaveAfterRunEnd,
  restoreRun,
  snapshotRun,
  syncBattleToRun,
  syncRunToBattleStart,
  teardownRun,
} from "./run-transitions";

export {
  getRunSession,
  useRunSession,
  useRunSessionBattleContext,
  useRunSessionBattleSlice,
  useRunSessionLabyrinthSlice,
  useRunSessionMysterySlice,
  useRunSessionNavigationSlice,
  useRunSessionRunSlice,
  useRunSessionShopSlice,
  useRunSessionTransientSlice,
} from "./run-session-model";
export {
  applyRunDefeatTeardown,
  flushPersistedSave,
  flushSaveAfterRunEnd,
  restoreRun,
  snapshotRun,
  syncBattleToRun,
  syncRunToBattleStart,
  teardownRun,
};
import { useRunScreenData } from "./use-run-screen-data";
export { useRunAdapter, useTalentAdapter, useRunDomainStore, useRunScreenData };
export type { RunStateController, TalentStateController };

/** Imperative read of run progression fields (deck, gold, talents, initialized). */
export function readActiveRunStore(): RunProgressStore {
  return getRunProgressStoreView();
}

/** Imperative read of transient session fields (shops, labyrinth, mystery). */
export function readRunSessionStore(): RunSessionStore {
  return getRunSessionStoreView();
}

/** Imperative read of navigation screen. */
export function readNavigationScreen() {
  return getRunDomainStore().navigation.screen;
}

/** Imperative read of battle domain slice. */
export function readBattleStore() {
  return getBattleStoreView();
}

export function setHasActiveRun(hasActiveRun: boolean) {
  getRunDomainStore().setHasActiveRun(hasActiveRun);
}

export function setActiveLabyrinthModifiers(modifiers: LabyrinthModifierKind[]) {
  getRunDomainStore().setActiveLabyrinthModifiers(modifiers);
}

export function setActiveLabyrinthRewardModifiers(modifiers: LabyrinthModifierKind[]) {
  getRunDomainStore().setActiveLabyrinthRewardModifiers(modifiers);
}

export function setActiveLabyrinthPendingNode(node: LabyrinthNodePosition | null) {
  getRunDomainStore().setActiveLabyrinthPendingNode(node);
}

export function setLabyrinthMap(map: LabyrinthMap | ((prev: LabyrinthMap) => LabyrinthMap)) {
  getRunDomainStore().setLabyrinthMap(map);
}

export function setRewardState(state: RewardState | ((prev: RewardState) => RewardState)) {
  getRunDomainStore().setRewardState(state);
}

export function applyDestinationChoices(choices: Destination[]) {
  setRewardState((prev) => ({ ...prev, destinations: choices }));
}

export function setMysteryEvent(event: MysteryEvent | null) {
  getRunDomainStore().setMysteryEvent(event);
}

export function setMysteryCardChoices(
  choices: BattleCard[] | null | ((prev: BattleCard[] | null) => BattleCard[] | null),
) {
  getRunDomainStore().setMysteryCardChoices(choices);
}

export function setShopState(state: ShopState | ((prev: ShopState) => ShopState)) {
  getRunDomainStore().setShopState(state);
}

export function setAlchemistState(state: AlchemistState | ((prev: AlchemistState) => AlchemistState)) {
  getRunDomainStore().setAlchemistState(state);
}

export function setRunEndMaterials(materials: MaterialInventory) {
  getRunDomainStore().setRunEndMaterials(materials);
}

export function setCorruptionResult(result: CorruptionResult | null) {
  getRunDomainStore().setCorruptionResult(result);
}

export function setPendingCharacterId(id: CharacterId | null) {
  getRunDomainStore().setPendingCharacterId(id);
}

export function setPendingContentSystemType(type: ContentSystemId) {
  getRunDomainStore().setPendingContentSystemType(type);
}

export function setCompanionRewardCards(cards: BattleCard[] | null) {
  getRunDomainStore().setCompanionRewardCards(cards);
}

/** Current screen and setter (owned by run domain navigation slice). */
export function useActiveRunScreen() {
  return useRunDomainStore(useShallow((s) => ({ screen: s.navigation.screen, setScreen: s.setScreen })));
}

/** Subscribe to navigation screen only (autosave, routing). */
export function useActiveRunScreenValue(): Screen {
  return useRunDomainStore((s) => s.navigation.screen);
}

/** Map-layer gold plus in-combat gold (e.g. victory totals). */
export function getCombinedRunGold(runGold?: number, battleGold?: number): number {
  const run = runGold ?? readActiveRunStore().runGold;
  const battle = battleGold ?? readBattleStore().battleState.gold;
  return run + battle;
}

/** Current lifecycle phase from live stores and the active screen. */
export function getCurrentRunPhase(screen?: Screen) {
  return getRunSession(screen).phase;
}

/** Whether run domain bootstrap has completed. */
export function readActiveRunInitialized(): boolean {
  return getRunDomainStore().progress.initialized;
}
