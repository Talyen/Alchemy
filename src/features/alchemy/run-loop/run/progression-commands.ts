import { readRewardActivity } from "@/lib/active-run-session";
import { restAtCampfireInDraft } from "./destination-commands";
import { withClearedNode } from "@/lib/content-systems/labyrinth/map-state";
import { getBossById, rollFreshBossId } from "@/features/alchemy/shared/config";
import { isBossOnlyDestinationOffer } from "@/features/alchemy/shared/run-flow/destination-flow";
import { sampleAndApplyDestinationOffer } from "@/features/alchemy/shared/stores/commands/destination-offer-command";
import { type GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import {
  acceptCommand,
  rejectCommand,
  dispatchRunSessionCommand,
  type RunTransaction,
  snapshotTransactionValue,
} from "@/features/alchemy/shared/stores/commands/run-session-command";
import {
  abandonCorruptionDestinationVisit,
  abandonLabyrinthCorruptionVisit,
  clearMysteryVisitState,
  clearShopOfferings,
  completeRunRoom,
  createDraftRunRandomSource,
  setCompletedDestinations,
  setCompletedDifficulties,
  setCorruptionResult,
  setCurrentAct,
  setDestinationIndexInAct,
  setDestinationState,
  setLabyrinthMap,
  setActiveLabyrinthPendingNode,
  setSelectedLabyrinthNodeId,
  setRoomsEncountered,
  setRunProgressActivity,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { ACTS_PER_RUN } from "@/lib/game-constants";
import { GAME_EDITION_POLICY, IS_DEMO } from "@/lib/game-edition";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";

export function prepareDestinationInDraft(draft: RunTransaction): void {
  const state = readRewardActivity(draft.session.activity).state;
  if (!isBossOnlyDestinationOffer(state.destinations)) {
    if (state.selectedBossId) setDestinationState(draft, (previous) => ({ ...previous, selectedBossId: null }));
  } else if (!state.selectedBossId || !getBossById(state.selectedBossId)) {
    setDestinationState(draft, (previous) => ({
      ...previous,
      selectedBossId: rollFreshBossId(createDraftRunRandomSource(draft, "world")),
    }));
  }
}
export function prepareNextDestinationInDraft(draft: RunTransaction): void {
  sampleAndApplyDestinationOffer(draft);
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
export function createProgressionCommands(gameSession: GameSession) {
  return {
    prepareDestinationScreen: () =>
      dispatchRunSessionCommand(
        (draft) => {
          if (draft.session.activity.kind !== "destination") return rejectCommand("Destination is unavailable", false);
          prepareDestinationInDraft(draft);
          return acceptCommand(true);
        },
        undefined,
        gameSession,
      ),
    leaveVisit: (expectedActivity: Screen): Screen | null =>
      dispatchRunSessionCommand(
        (draft) => {
          const activity = draft.session.activity;
          if (activity.kind !== expectedActivity || draft.run.activeRun.contentSystemType === CONTENT_SYSTEMS.WILDWOOD)
            return rejectCommand("Visit is unavailable", null);
          switch (activity.kind) {
            case "campfire":
              restAtCampfireInDraft(draft);
              break;
            case "corruption":
              if (activity.data === null) {
                if (draft.run.activeRun.contentSystemType === CONTENT_SYSTEMS.LABYRINTH) {
                  abandonLabyrinthCorruptionVisit(draft);
                  return acceptCommand(ROUTE_SCREENS.LABYRINTH_MAP);
                }
                abandonCorruptionDestinationVisit(draft);
                prepareDestinationInDraft(draft);
                setRunProgressActivity(draft, "destination");
                return acceptCommand(ROUTE_SCREENS.DESTINATION);
              }
              break;
            case "transmutation":
            case "shop":
            case "alchemist":
            case "trinket-shop":
            case "equipment-shop":
              break;
            case "mystery":
              if (!activity.data.mysteryChosenChoice || activity.data.mysteryCardChoices?.length)
                return rejectCommand("Mystery is unfinished", null);
              break;
            case "battle":
            case "destination":
            case "difficulty-select":
            case "draft-deck":
            case "labyrinth-map":
            case "rewards":
            case "wildwood-removal":
              return rejectCommand("Activity is not a visit", null);
          }
          completeRunRoom(draft);
          setRoomsEncountered(draft, (previous) => Math.min(Number.MAX_SAFE_INTEGER, previous + 1));
          clearMysteryVisitState(draft);
          clearShopOfferings(draft);
          setCorruptionResult(draft, null);
          if (draft.run.activeRun.contentSystemType === CONTENT_SYSTEMS.LABYRINTH) {
            clearLabyrinthNodeInDraft(draft);
            setRunProgressActivity(draft, "labyrinth-map");
            return acceptCommand(ROUTE_SCREENS.LABYRINTH_MAP);
          }
          prepareNextDestinationInDraft(draft);
          return acceptCommand(ROUTE_SCREENS.DESTINATION);
        },
        undefined,
        gameSession,
      ),
  };
}
