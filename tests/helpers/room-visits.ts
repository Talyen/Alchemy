import { defaultGameSession } from "@/app/application-session";
import {
  initializeAlchemyVisitInTransaction,
  initializeShopVisit,
  beginMysteryVisitInTransaction,
} from "@/features/alchemy/run-loop/run/room-visit-initialization";
import type { ShopKind } from "@/features/alchemy/run-loop/shop/shop-action-types";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";

// Focused command tests seed visits without manufacturing a complete route/map.
// Room-entry tests exercise validation, history, atomicity, and durable routing.
export function initializeShopVisitForTest(kind: ShopKind, session: GameSession = defaultGameSession) {
  dispatchRunSessionCommand((transaction) => acceptCommand(initializeShopVisit(transaction, kind)), undefined, session);
}
export function initializeAlchemyVisitForTest(
  kind: "campfire" | "transmutation",
  session: GameSession = defaultGameSession,
) {
  dispatchRunSessionCommand(
    (transaction) => acceptCommand(initializeAlchemyVisitInTransaction(transaction, kind)),
    undefined,
    session,
  );
}
export function initializeMysteryVisitForTest(session: GameSession = defaultGameSession) {
  dispatchRunSessionCommand(
    (transaction) => acceptCommand(beginMysteryVisitInTransaction(transaction)),
    undefined,
    session,
  );
}
