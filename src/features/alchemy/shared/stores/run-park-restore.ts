import type { ActiveRunData, EquipmentShopState, TrinketShopState } from "@/lib/active-run-session";
import { repairShopOfferings, shopItemSlotKey } from "@/lib/active-run-session";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { combineTrinketEffectIds } from "@/lib/trinkets";
import { ROUTE_SCREENS } from "@/lib/routing";
import { repairPersistedTrinketManifest } from "@/lib/validation";
import { gearDefinitions, getOwnedUniqueDefinitionIds } from "@/lib/gear";
import { eventHasUnresolvedRandomTrinket, repairUnresolvedMysteryTrinkets } from "@/lib/mystery";
import type { GameplayDraft } from "./run-session-command";
import { decodeRunResumeSnapshot, encodeRunResumeSnapshot, type DecodedRunResumeSession } from "./run-resume-codec";
import { inferActiveRunScreen } from "./encode-interrupted-flow";
import { getRunSessionFromState } from "./run-reads";
import {
  abandonMysteryDestinationVisit,
  clearMysteryVisitState,
  clearTransientSession,
  setActiveLabyrinthModifiers,
  setActiveLabyrinthPendingNode,
  setActiveLabyrinthRewardModifiers,
  setAlchemistState,
  setCompanionRewardCards,
  setCorruptionResult,
  setEquipmentShopState,
  setHasActiveRun,
  setLabyrinthMap,
  setMysteryCardChoices,
  setMysteryChosenCardId,
  setMysteryChosenChoice,
  setMysteryEvent,
  setMysteryGrantedGearInstances,
  setMysteryGrantedTrinketIds,
  setMysteryPendingRemoval,
  setRewardState,
  setShopState,
  setStarterDraftChoices,
  setTrinketShopState,
  setWildwoodDraft,
} from "./write-port-session";
import {
  createDraftRunRandomSource,
  initializeActiveRun,
  initializeFromResumeSnapshot,
  setScreen,
} from "./write-port-run";
import { initializeActiveBattle } from "./write-port-run";
import { rebindLiveRunMeta } from "./run-meta-rebind";
import { omitParkedMode, removeRunRecency, touchRunRecency } from "./parked-runs";

function encodeParkedSnapshot(draft: GameplayDraft): ActiveRunData {
  return encodeRunResumeSnapshot(getRunSessionFromState(draft, draft.run.navigation.screen));
}

function repairRestoredTrinketShop(state: TrinketShopState, ownedIds: readonly string[]): TrinketShopState {
  const owned = new Set(ownedIds);
  const repaired = repairShopOfferings(
    state.trinkets,
    state.purchasedSlotKeys,
    (trinket) => !owned.has(trinket.id),
    (trinket, index) => shopItemSlotKey(trinket.id, index),
  );
  return { ...state, trinkets: repaired.items, purchasedSlotKeys: repaired.purchasedSlotKeys };
}

function repairRestoredEquipmentShop(
  state: EquipmentShopState,
  inventories: GameplayDraft["gear"]["inventories"],
): EquipmentShopState {
  const ownedUniques = getOwnedUniqueDefinitionIds(inventories);
  const repaired = repairShopOfferings(
    state.gear,
    state.purchasedSlotKeys,
    (instance) =>
      gearDefinitions[instance.definitionId]?.rarity !== "unique" || !ownedUniques.has(instance.definitionId),
    (instance) => instance.instanceId,
  );
  return { ...state, gear: repaired.items, purchasedSlotKeys: repaired.purchasedSlotKeys };
}

function restoreRunSession(draft: GameplayDraft, decoded: DecodedRunResumeSession): void {
  if (decoded.labyrinthMap) setLabyrinthMap(draft, decoded.labyrinthMap);
  setActiveLabyrinthModifiers(draft, decoded.activeLabyrinthModifiers);
  setActiveLabyrinthRewardModifiers(draft, decoded.activeLabyrinthRewardModifiers);
  setActiveLabyrinthPendingNode(draft, decoded.labyrinthPendingNode);
  setWildwoodDraft(draft, decoded.wildwoodDraft);
  setStarterDraftChoices(draft, decoded.starterDraftChoices);
  if (decoded.rewardState) setRewardState(draft, decoded.rewardState);
  setCompanionRewardCards(draft, decoded.companionRewardCards);
  if (decoded.shopState) setShopState(draft, decoded.shopState);
  if (decoded.alchemistState) setAlchemistState(draft, decoded.alchemistState);
  if (decoded.trinketShopState) {
    setTrinketShopState(draft, repairRestoredTrinketShop(decoded.trinketShopState, draft.gear.ownedTrinketIds));
  }
  if (decoded.equipmentShopState) {
    setEquipmentShopState(draft, repairRestoredEquipmentShop(decoded.equipmentShopState, draft.gear.inventories));
  }
  setMysteryEvent(draft, decoded.mysteryEvent);
  setMysteryChosenChoice(draft, decoded.mysteryChosenChoice);
  setMysteryPendingRemoval(draft, decoded.mysteryPendingRemoval);
  setMysteryCardChoices(draft, decoded.mysteryCardChoices);
  setMysteryGrantedTrinketIds(draft, decoded.mysteryGrantedTrinketIds);
  setMysteryGrantedGearInstances(draft, decoded.mysteryGrantedGearInstances);
  setMysteryChosenCardId(draft, decoded.mysteryChosenCardId);
  setCorruptionResult(draft, decoded.corruptionResult);
}

export function parkForegroundRunInDraft(draft: GameplayDraft): void {
  if (!draft.session.hasActiveRun) return;
  const mode = draft.run.activeRun.contentSystemType;
  draft.run.parkedRuns[mode] = encodeParkedSnapshot(draft);
  draft.run.runRecency = touchRunRecency(draft.run.runRecency, mode);
}

export function parkAndDeactivateForegroundRunInDraft(draft: GameplayDraft): void {
  if (!draft.session.hasActiveRun) return;
  parkForegroundRunInDraft(draft);
  clearTransientSession(draft);
  setHasActiveRun(draft, false);
  initializeActiveBattle(draft, null);
}

export function applyRestoreRunToDraft(draft: GameplayDraft, activeRun: ActiveRunData | null): void {
  const decoded = activeRun ? decodeRunResumeSnapshot(activeRun) : null;
  if (decoded) initializeFromResumeSnapshot(draft, decoded.progress);
  else initializeActiveRun(draft, null);

  const battleState =
    activeRun?.activeCombat?.battleState != null
      ? repairPersistedTrinketManifest(
          activeRun.activeCombat.battleState,
          combineTrinketEffectIds(activeRun.runBoons, draft.gear.equippedTrinkets[activeRun.characterId]),
        )
      : null;
  const pending = decoded?.pendingBattleTransition ?? null;
  initializeActiveBattle(draft, battleState, pending);

  const resumeScreen = decoded?.screen ?? (activeRun ? inferActiveRunScreen(activeRun) : null);
  if (resumeScreen) setScreen(draft, resumeScreen);
  if (!activeRun) return;

  clearTransientSession(draft);
  setHasActiveRun(draft, true);
  if (decoded) restoreRunSession(draft, decoded.session);
  if (draft.session.mysteryEvent && eventHasUnresolvedRandomTrinket(draft.session.mysteryEvent)) {
    const rng = createDraftRunRandomSource(draft, "events");
    setMysteryEvent(
      draft,
      repairUnresolvedMysteryTrinkets(
        draft.session.mysteryEvent,
        combineTrinketEffectIds(
          draft.run.activeRun.runBoons,
          draft.gear.equippedTrinkets[draft.run.activeRun.characterId],
        ),
        rng,
      ),
    );
  }
  if (resumeScreen === "mystery" && !draft.session.mysteryEvent) {
    if (activeRun.mysteryVisit != null) {
      abandonMysteryDestinationVisit(draft);
      clearMysteryVisitState(draft);
      setScreen(draft, ROUTE_SCREENS.DESTINATION);
      rebindLiveRunMeta(draft);
      return;
    }
    clearMysteryVisitState(draft);
    setScreen(draft, ROUTE_SCREENS.DESTINATION);
  }
  rebindLiveRunMeta(draft);
}

export function hydrateModeRunInDraft(draft: GameplayDraft, mode: ContentSystemId): boolean {
  const parked = draft.run.parkedRuns[mode];
  if (!parked) return false;
  if (draft.session.hasActiveRun && draft.run.activeRun.contentSystemType !== mode) {
    parkForegroundRunInDraft(draft);
  }
  draft.run.parkedRuns = omitParkedMode(draft.run.parkedRuns, mode);
  applyRestoreRunToDraft(draft, parked);
  draft.run.runRecency = touchRunRecency(draft.run.runRecency, mode);
  return true;
}

export function clearModeSlotInDraft(draft: GameplayDraft, mode: ContentSystemId): void {
  draft.run.parkedRuns = omitParkedMode(draft.run.parkedRuns, mode);
  draft.run.runRecency = removeRunRecency(draft.run.runRecency, mode);
}
