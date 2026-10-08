import { trinketLibrary } from "@/lib/game-data";
import { withClearedNode } from "@/lib/content-systems/labyrinth/map-state";
import { getBossById, rollFreshBossId } from "@/features/alchemy/shared/config";
import { isBossOnlyDestinationOffer } from "@/features/alchemy/shared/run-flow/destination-flow";
import { sampleAndApplyDestinationOffer } from "@/features/alchemy/shared/stores/destination-offer-command";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  type RunTransaction,
  snapshotTransactionValue,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  abandonCorruptionDestinationVisit,
  clearMysteryVisitState,
  clearShopOfferings,
  completeRunRoom,
  createDraftRunRandomSource,
  setCompletedDestinations,
  setCompletedDifficulties,
  setCorruptionResult,
  setCurrentAct,
  setDestinationIndexInAct,
  setRewardState,
  setLabyrinthMap,
  setActiveLabyrinthPendingNode,
  setSelectedLabyrinthNodeId,
  setRoomsEncountered,
  setRunProgressActivity,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { ACTS_PER_RUN } from "@/lib/game-constants";
import { GAME_EDITION_POLICY, IS_DEMO } from "@/lib/game-edition";
import type { RunFlowHandlerDeps } from "./run-flow";

export function prepareDestinationInDraft(draft: RunTransaction): void {
  const state = draft.session.rewardFlow.state;
  if (!isBossOnlyDestinationOffer(state.destinations)) {
    if (state.selectedBossId) setRewardState(draft, (previous) => ({ ...previous, selectedBossId: null }));
  } else if (!state.selectedBossId || !getBossById(state.selectedBossId)) {
    setRewardState(draft, (previous) => ({
      ...previous,
      selectedBossId: rollFreshBossId(createDraftRunRandomSource(draft, "world")),
    }));
  }
}
export function prepareNextDestinationInDraft(
  draft: RunTransaction,
  getAvailableDestinations: RunFlowHandlerDeps["getAvailableDestinations"],
  index?: number,
): void {
  sampleAndApplyDestinationOffer(
    draft,
    getAvailableDestinations({
      currentAct: draft.run.activeRun.currentAct,
      destinationIndexInAct: index ?? draft.run.activeRun.destinationIndexInAct,
      currentHealth: draft.run.activeRun.runPlayerHealth,
      currentGold: draft.runProfile.gold,
      maxHealth: draft.run.activeRun.runMaxHealth,
      hasAnyOwnedGear:
        draft.gear.ownedTrinketIds.length > 0 ||
        Object.values(draft.gear.inventories).some((items) => items.length > 0),
      hasUnownedTrinkets: draft.gear.ownedTrinketIds.length < trinketLibrary.length,
    }),
  );
  prepareDestinationInDraft(draft);
}
export function completeActInDraft(draft: RunTransaction): boolean {
  const run = draft.run.activeRun;
  if (run.currentAct >= (IS_DEMO ? GAME_EDITION_POLICY.campaignActs : ACTS_PER_RUN)) {
    const difficulty = run.selectedDifficulty;
    if (difficulty && !IS_DEMO)
      setCompletedDifficulties(draft, (previous) => ({
        ...previous,
        [run.characterId]: (previous[run.characterId] ?? []).includes(difficulty)
          ? (previous[run.characterId] ?? [])
          : [...(previous[run.characterId] ?? []), difficulty],
      }));
    return true;
  }
  setCurrentAct(draft, (previous) => previous + 1);
  setDestinationIndexInAct(draft, 0);
  setCompletedDestinations(draft, []);
  return false;
}
export function clearLabyrinthNodeInDraft(draft: RunTransaction): void {
  const node = draft.session.activeLabyrinthPendingNode;
  if (node) completeRunRoom(draft);
  setActiveLabyrinthPendingNode(draft, null);
  setSelectedLabyrinthNodeId(draft, null);
  if (node && draft.session.labyrinthMap)
    setLabyrinthMap(draft, withClearedNode(snapshotTransactionValue(draft.session.labyrinthMap), node));
}
export function createProgressionCommands(
  getAvailableDestinations: RunFlowHandlerDeps["getAvailableDestinations"],
  gameSession: GameSession,
) {
  const commit = (mutate: (draft: RunTransaction) => boolean | void) =>
    dispatchRunSessionCommand((draft) => acceptCommand(mutate(draft)), undefined, gameSession);
  return {
    prepareDestinationScreen: () => commit(prepareDestinationInDraft),
    prepareNextDestination: (index?: number) =>
      commit((draft) => prepareNextDestinationInDraft(draft, getAvailableDestinations, index)),
    completeAct: () => commit(completeActInDraft) === true,
    leaveCorruption: () =>
      commit((draft) => {
        abandonCorruptionDestinationVisit(draft);
        setRunProgressActivity(draft, "destination");
      }),
    completeDestination: () =>
      commit((draft) => {
        completeRunRoom(draft);
        setRoomsEncountered(draft, (previous) => previous + 1);
        clearMysteryVisitState(draft);
        clearShopOfferings(draft);
        setCorruptionResult(draft, null);
        if (draft.run.activeRun.contentSystemType === CONTENT_SYSTEMS.LABYRINTH) {
          clearLabyrinthNodeInDraft(draft);
          setRunProgressActivity(draft, "labyrinth-map");
        } else prepareNextDestinationInDraft(draft, getAvailableDestinations);
      }),
  };
}
