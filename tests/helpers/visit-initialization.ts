import {
  initializeAlchemyVisitInTransaction,
  initializeShopVisit,
  beginMysteryVisitInTransaction,
} from "@/features/alchemy/run-loop/run/room-visit-initialization";
import type { ShopKind } from "@/features/alchemy/run-loop/shop/shop-action-types";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";

export function initializeShopForTest(kind: ShopKind, session: GameSession): void {
  dispatchRunSessionCommand((draft) => acceptCommand(initializeShopVisit(draft, kind)), undefined, session);
}

export function initializeAlchemyVisitForTest(kind: "campfire" | "transmutation", session: GameSession): void {
  dispatchRunSessionCommand(
    (draft) => acceptCommand(initializeAlchemyVisitInTransaction(draft, kind)),
    undefined,
    session,
  );
}

export function initializeMysteryForTest(session: GameSession): void {
  dispatchRunSessionCommand((draft) => acceptCommand(beginMysteryVisitInTransaction(draft)), undefined, session);
}
