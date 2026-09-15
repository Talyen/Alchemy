import type { ActiveRunData, EquipmentShopState, TrinketShopState } from "@/lib/active-run-session";
import { readActivityData, repairShopOfferings, shopItemSlotKey } from "@/lib/active-run-session";
import { gearDefinitions, getOwnedUniqueDefinitionIds } from "@/lib/gear";
import { eventHasUnresolvedRandomTrinket, repairUnresolvedMysteryTrinkets } from "@/lib/mystery";
import { ROUTE_SCREENS } from "@/lib/routing";
import { combineTrinketEffectIds } from "@/lib/trinkets";
import { repairPersistedTrinketManifest } from "@/lib/validation";
import { rebindLiveRunMeta } from "./run-session-write-port";
import { decodeRunResumeSnapshot, type DecodedRunResumeSession } from "./run-resume-codec";
import type { GameplayDraft } from "./run-session-command";
import {
  abandonMysteryDestinationVisit,
  clearMysteryVisitState,
  clearTransientSession,
  createDraftRunRandomSource,
  initializeActiveBattle,
  initializeActiveRun,
  initializeFromResumeSnapshot,
  setActiveLabyrinthModifiers,
  setActiveLabyrinthPendingNode,
  setActiveLabyrinthRewardModifiers,
  setCompanionRewardCards,
  setHasActiveRun,
  setLabyrinthMap,
  setMysteryEvent,
  setRewardState,
  setScreen,
  setStarterDraftChoices,
  setWildwoodDraft,
} from "./run-session-write-port";

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

export function applyRestoreRunToDraft(draft: GameplayDraft, activeRun: ActiveRunData | null): void {
  draft.session.activity = { kind: "inactive" };
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
  // Order matters: install the decoded activity first, then navigate. setScreen
  // re-syncs the activity to the screen via prepareRunNavigation, which is an
  // identity for the matching visit and repairs stale activity/screen pairs.
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
