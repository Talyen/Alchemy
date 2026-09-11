import type { ActiveRunData, EquipmentShopState, TrinketShopState } from "@/lib/active-run-session";
import { readActivityData, repairShopOfferings, runActivityScreen, shopItemSlotKey } from "@/lib/active-run-session";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { gearDefinitions, getOwnedUniqueDefinitionIds } from "@/lib/gear";
import { eventHasUnresolvedRandomTrinket, repairUnresolvedMysteryTrinkets } from "@/lib/mystery";
import { ROUTE_SCREENS } from "@/lib/routing";
import { combineTrinketEffectIds } from "@/lib/trinkets";
import { repairPersistedTrinketManifest } from "@/lib/validation";
import { omitParkedMode, removeRunRecency, touchRunRecency } from "./parked-runs";
import { rebindLiveRunMeta } from "./run-meta-rebind";
import { getRunSessionFromState } from "./run-reads";
import { decodeRunResumeSnapshot, encodeRunResumeSnapshot, type DecodedRunResumeSession } from "./run-resume-codec";
import type { GameplayDraft } from "./run-session-command";
import {
  createDraftRunRandomSource,
  initializeActiveBattle,
  initializeActiveRun,
  initializeFromResumeSnapshot,
  setScreen,
} from "./write-port-run";
import {
  abandonMysteryDestinationVisit,
  clearMysteryVisitState,
  clearTransientSession,
  setActiveLabyrinthModifiers,
  setActiveLabyrinthPendingNode,
  setActiveLabyrinthRewardModifiers,
  setCompanionRewardCards,
  setHasActiveRun,
  setLabyrinthMap,
  setMysteryEvent,
  setRewardState,
  setStarterDraftChoices,
  setWildwoodDraft,
} from "./write-port-session";

function encodeParkedSnapshot(draft: GameplayDraft): ActiveRunData {
  return encodeRunResumeSnapshot(getRunSessionFromState(draft), runActivityScreen(draft.session.activity) ?? undefined);
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
  draft.session.activity = decoded.activity;
  const activity = draft.session.activity;
  if (activity.kind === "trinket-shop") {
    activity.data = repairRestoredTrinketShop(activity.data, draft.gear.ownedTrinketIds);
  }
  if (activity.kind === "equipment-shop") {
    activity.data = repairRestoredEquipmentShop(activity.data, draft.gear.inventories);
  }
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
  draft.session.activity = { kind: "idle" };
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

  const resumeScreen = decoded?.screen ?? null;
  if (!activeRun) return;

  clearTransientSession(draft);
  setHasActiveRun(draft, true);
  if (decoded) restoreRunSession(draft, decoded.session);
  if (resumeScreen) setScreen(draft, resumeScreen);
  const mysteryEvent = readActivityData(draft.session.activity, "mystery").mysteryEvent;
  if (mysteryEvent && eventHasUnresolvedRandomTrinket(mysteryEvent)) {
    const rng = createDraftRunRandomSource(draft, "events");
    setMysteryEvent(
      draft,
      repairUnresolvedMysteryTrinkets(
        mysteryEvent,
        combineTrinketEffectIds(
          draft.run.activeRun.runBoons,
          draft.gear.equippedTrinkets[draft.run.activeRun.characterId],
        ),
        rng,
      ),
    );
  }
  if (resumeScreen === "mystery" && !mysteryEvent) {
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
