import { getBossById } from "@/features/alchemy/shared/config";
import type { BattleStarted, BattleStartRequest } from "@/features/alchemy/shared/stores/battle-start-types";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  snapshotTransactionValue,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  beginDestinationClaim,
  commitDestinationClaim,
  initializeBattle,
  recordRunRoom,
  setActiveLabyrinthModifiers,
  setActiveLabyrinthPendingNode,
  setActiveLabyrinthRewardModifiers,
  setRunActivityData,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { LABYRINTH_TYPE_TO_DESTINATION } from "@/lib/content-systems/labyrinth/data";
import { canEnterLabyrinthNode } from "@/lib/content-systems/labyrinth/map-generation";
import { DESTINATIONS, ROUTE_SCREENS, type Destination, type Screen } from "@/lib/routing";
import { initializeAlchemyVisitInTransaction } from "../navigation/alchemy-commands";
import { beginMysteryVisitInTransaction } from "../navigation/mystery-commands";
import { initializeShopVisit } from "../shop/shop-initialization";

export type RunRoomRequest = { kind: "campaign"; destination: Destination } | { kind: "labyrinth" };

export interface RunRoomEntered {
  screen: Screen;
  battle: BattleStarted | null;
}

function initializeRoom(
  draft: RunTransaction,
  destination: Destination,
  battleRequest?: BattleStartRequest,
): RunRoomEntered | null {
  switch (destination) {
    case DESTINATIONS.NORMAL_COMBAT:
    case DESTINATIONS.ELITE_COMBAT:
    case DESTINATIONS.BOSS_COMBAT: {
      const battle = initializeBattle(
        draft,
        battleRequest ??
          (destination === DESTINATIONS.BOSS_COMBAT
            ? { kind: "boss", options: {} }
            : {
                kind: "battle",
                options: { enemyType: destination === DESTINATIONS.ELITE_COMBAT ? "elite" : "normal" },
              }),
      );
      return battle ? { screen: ROUTE_SCREENS.BATTLE, battle } : null;
    }
    case DESTINATIONS.CAMPFIRE:
    case DESTINATIONS.TRANSMUTATION: {
      const screen = destination === DESTINATIONS.CAMPFIRE ? ROUTE_SCREENS.CAMPFIRE : ROUTE_SCREENS.TRANSMUTATION;
      initializeAlchemyVisitInTransaction(draft, screen);
      return { screen, battle: null };
    }
    case DESTINATIONS.CARD_SHOP:
      initializeShopVisit(draft, "merchant");
      return { screen: ROUTE_SCREENS.SHOP, battle: null };
    case DESTINATIONS.ALCHEMIST_SHOP:
      initializeShopVisit(draft, "alchemist");
      return { screen: ROUTE_SCREENS.ALCHEMIST, battle: null };
    case DESTINATIONS.TRINKET_SHOP:
      initializeShopVisit(draft, "trinket");
      return { screen: ROUTE_SCREENS.TRINKET_SHOP, battle: null };
    case DESTINATIONS.GEAR_SHOP:
      initializeShopVisit(draft, "equipment");
      return { screen: ROUTE_SCREENS.EQUIPMENT_SHOP, battle: null };
    case DESTINATIONS.MYSTERY:
      beginMysteryVisitInTransaction(draft);
      return { screen: ROUTE_SCREENS.MYSTERY, battle: null };
    case DESTINATIONS.CORRUPTION:
      setRunActivityData(draft, "corruption", null);
      return { screen: ROUTE_SCREENS.CORRUPTION, battle: null };
  }
}

export function enterRunRoom(request: RunRoomRequest, gameSession: GameSession): RunRoomEntered | null {
  return dispatchRunSessionCommand(
    (draft) => {
      const unavailable = () => rejectCommand("Room entry is unavailable", null);
      if (request.kind === "campaign") {
        if (
          draft.run.activeRun.contentSystemType !== "campaign" ||
          draft.session.activity.kind !== "destination" ||
          !beginDestinationClaim(draft, request.destination)
        )
          return unavailable();
        const bossId = draft.session.rewardFlow.state.selectedBossId;
        const battleRequest =
          request.destination === DESTINATIONS.BOSS_COMBAT && bossId && getBossById(bossId)
            ? { kind: "boss-by-id" as const, options: { bossId } }
            : undefined;
        // Keep the pending claim during sampling: loot depth includes this room,
        // and battle initialization leaves Campaign history to this command.
        const result = initializeRoom(draft, request.destination, battleRequest);
        if (!result || !commitDestinationClaim(draft, request.destination)) return unavailable();
        return acceptCommand(result);
      }
      const session = draft.session;
      const map = session.labyrinthMap;
      const nodeId = session.selectedLabyrinthNodeId;
      if (
        draft.run.activeRun.contentSystemType !== "labyrinth" ||
        session.activity.kind !== "labyrinth-map" ||
        session.activeLabyrinthPendingNode ||
        !map ||
        !nodeId
      )
        return unavailable();
      const node = map.nodes[nodeId];
      if (!node || node.type === "entrance" || !canEnterLabyrinthNode(snapshotTransactionValue(map), nodeId))
        return unavailable();
      const combat = node.type === "combat" || node.type === "elite" || node.type === "boss";
      setActiveLabyrinthPendingNode(draft, nodeId);
      setActiveLabyrinthModifiers(draft, combat ? node.modifiers : []);
      setActiveLabyrinthRewardModifiers(draft, node.rewardModifiers);
      const destination = LABYRINTH_TYPE_TO_DESTINATION[node.type];
      recordRunRoom(draft, destination, `labyrinth:${map.currentFloor}:${nodeId}`);
      const battleRequest: BattleStartRequest | undefined = combat
        ? node.type === "boss"
          ? { kind: "boss", options: { modifiers: [], enemyId: node.enemyId } }
          : {
              kind: "battle",
              options: { enemyType: node.type === "elite" ? "elite" : "normal", modifiers: [], enemyId: node.enemyId },
            }
        : undefined;
      const result = initializeRoom(draft, destination, battleRequest);
      return result ? acceptCommand(result) : unavailable();
    },
    undefined,
    gameSession,
  );
}
