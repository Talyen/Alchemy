// Facade over run domain store — reads, writes, sync, snapshot, restore, and teardown.
import { useShallow } from "zustand/react/shallow";
import type { BattleCard, CharacterId, DifficultyId, TalentXP, UnlockedTalents } from "@/lib/game-data";
import type { LabyrinthMap, LabyrinthModifierKind, ContentSystemId } from "@/lib/content-systems/types";
import type { CorruptionResult } from "@/lib/corruption";
import type { MysteryEvent } from "@/lib/mystery";
import type { MaterialInventory } from "@/lib/homestead/types";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import type { LabyrinthNodePosition } from "@/lib/active-run-session";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { Screen } from "@/lib/routing";
import type {
  AlchemistState,
  EquipmentShopState,
  RewardState,
  ShopState,
  TrinketShopState,
} from "@/lib/active-run-session";
import {
  getRunDomainStore,
  getBattleStoreView,
  getRunProgressStoreView,
  getRunSessionStoreView,
  useRunAdapter,
  useRunDomainStore,
  useTalentAdapter,
  useHomesteadAdapter,
  type RunProgressStore,
  type RunSessionStore,
} from "./run-domain-store";
import type { RunStateController, TalentStateController } from "./run-domain-store";
import type { DisplayOverrides } from "./run-domain-types";
import { restoreRun, snapshotRun } from "./run-transitions";

export {
  getRunSession,
  useRunSessionBattleContext,
  useRunSessionLabyrinthSlice,
  useRunSessionMysterySlice,
  useRunSessionNavigationSlice,
  useRunSessionShopSlice,
} from "./run-session-model";
export { restoreRun, snapshotRun };
import { useRunScreenData } from "./use-run-screen-data";
export { useRunAdapter, useTalentAdapter, useHomesteadAdapter, useRunScreenData };
export type { RunStateController, TalentStateController, RunProgressStore, RunSessionStore, DisplayOverrides };

/** Imperative read of run progression fields (deck, gold, talents, initialized). */
export function readActiveRunStore(): RunProgressStore {
  return getRunProgressStoreView();
}

/** Imperative read of transient session fields (shops, labyrinth, mystery). */
export function readRunSessionStore(): RunSessionStore {
  return getRunSessionStoreView();
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

export function setWildwoodDraft(
  state: WildwoodDraftState | null | ((prev: WildwoodDraftState | null) => WildwoodDraftState | null),
) {
  getRunDomainStore().setWildwoodDraft(state);
}

export function setRewardState(state: RewardState | ((prev: RewardState) => RewardState)) {
  getRunDomainStore().setRewardState(state);
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

export function setTrinketShopState(state: TrinketShopState | ((prev: TrinketShopState) => TrinketShopState)) {
  getRunDomainStore().setTrinketShopState(state);
}

export function setEquipmentShopState(state: EquipmentShopState | ((prev: EquipmentShopState) => EquipmentShopState)) {
  getRunDomainStore().setEquipmentShopState(state);
}

export function setRunEndMaterials(materials: MaterialInventory) {
  getRunDomainStore().setRunEndMaterials(materials);
}

/** Persist homestead materials and track totals for the run-end summary screen. */
export function awardMaterialsDuringRun(materials: MaterialInventory) {
  getRunDomainStore().addMaterials(materials);
  getRunDomainStore().addRunMaterialsEarned(materials);
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

export function useHasActiveBattle(): boolean {
  return useRunDomainStore((s) => s.battle.hasActiveBattle);
}

export function useHasActiveRun(): boolean {
  return useRunDomainStore((s) => s.session.hasActiveRun);
}

export function useDisplayOverrides(): DisplayOverrides {
  return useRunDomainStore((s) => s.battle.displayOverrides);
}

export function useSetHasActiveBattle(): (active: boolean) => void {
  return useRunDomainStore((s) => s.setHasActiveBattle);
}

export function useBondedCompanions() {
  return useRunDomainStore((s) => s.progress.permanent.bondedCompanions);
}

export function useContentSystemType(): ContentSystemId {
  return useRunDomainStore((s) => s.progress.run.contentSystemType);
}

export function useIsWildwoodRun(): boolean {
  return useRunDomainStore((s) => s.progress.run.contentSystemType === "wildwood");
}

export function useHomesteadProgressSlice() {
  return useRunDomainStore(
    useShallow((s) => ({
      materialInventory: s.progress.permanent.materialInventory,
      constructedBuildings: s.progress.permanent.constructedBuildings,
      plantedFarms: s.progress.permanent.plantedFarms,
      completedResearch: s.progress.permanent.completedResearch,
      bondedCompanions: s.progress.permanent.bondedCompanions,
    })),
  );
}

export function useTalentProgressSlice(): { talentXP: TalentXP; unlockedTalents: UnlockedTalents } {
  return useRunDomainStore(
    useShallow((s) => ({
      talentXP: s.progress.permanent.talentXP,
      unlockedTalents: s.progress.permanent.unlockedTalents,
    })),
  );
}

export function useDifficultySelectSlice(): {
  pendingCharacterId: CharacterId | null;
  selectedDifficulty: DifficultyId | null;
} {
  return useRunDomainStore(
    useShallow((s) => ({
      pendingCharacterId: s.session.pendingCharacterId,
      selectedDifficulty: s.progress.run.selectedDifficulty,
    })),
  );
}

export function useDraftDeckSlice(): {
  contentSystemType: ContentSystemId;
  runDeck: BattleCard[];
  wildwoodDraft: WildwoodDraftState | null;
} {
  return useRunDomainStore(
    useShallow((s) => ({
      contentSystemType: s.progress.run.contentSystemType,
      runDeck: s.progress.run.runDeck,
      wildwoodDraft: s.session.wildwoodDraft,
    })),
  );
}

export function useActiveRunCharacterId(): CharacterId {
  return useRunDomainStore((s) => s.progress.run.characterId);
}

/** Dev / unlock-all: set homestead materials. */
export function setMaterials(materials: MaterialInventory) {
  getRunDomainStore().setMaterials(materials);
}

/** Persistence: subscribe to any run-domain mutation (autosave). */
export function subscribeRunDomain(listener: () => void): () => void {
  return useRunDomainStore.subscribe(listener);
}

/** Persistence: whether an active run should be snapshotted. */
export function readHasActiveRun(): boolean {
  return getRunDomainStore().session.hasActiveRun;
}

type HomesteadSaveFields = Pick<
  RunProgressStore,
  "materialInventory" | "constructedBuildings" | "plantedFarms" | "completedResearch" | "bondedCompanions"
>;

/** Persistence: hydrate permanent homestead fields from save data. */
export function applyHomesteadSaveFields(homestead: HomesteadSaveFields): void {
  useRunDomainStore.setState((state) => {
    state.progress.permanent.materialInventory = homestead.materialInventory;
    state.progress.permanent.constructedBuildings = homestead.constructedBuildings;
    state.progress.permanent.plantedFarms = homestead.plantedFarms;
    state.progress.permanent.completedResearch = homestead.completedResearch;
    state.progress.permanent.bondedCompanions = homestead.bondedCompanions;
    state.progress.permanent.effects = computeHomesteadEffects(
      homestead.constructedBuildings,
      homestead.plantedFarms,
      homestead.completedResearch,
      homestead.bondedCompanions,
    );
  });
}
