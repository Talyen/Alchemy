import {
  initializeAlchemyVisitInTransaction,
  initializeShopVisit,
  beginMysteryVisitInTransaction,
} from "@/features/alchemy/run-loop/run/room-visit-initialization";
import type { ShopActivity } from "@/lib/active-run-session";
import type { GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import {
  acceptCommand,
  dispatchRunSessionCommand,
} from "@/features/alchemy/shared/stores/commands/run-session-command";

export function initializeShopForTest(kind: ShopActivity, session: GameSession): void {
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
