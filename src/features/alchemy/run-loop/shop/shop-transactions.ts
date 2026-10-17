import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/run-session-command";
import { guardProgressAction, sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import type { BattleCard } from "@/lib/game-data";
import { type playUISound } from "@/lib/audio";
import type { ShopActivity } from "./shop-action-types";

export interface ShopTransactionResult {
  committed: boolean;
  price: number;
  value: BattleCard | null | undefined;
}

export function runShopTransaction(
  activity: ShopActivity,
  recipe: (draft: RunTransaction) => ShopTransactionResult,
  successSound: Parameters<typeof playUISound>[0] | undefined,
  gameSession: GameSession,
): ShopTransactionResult {
  const result = guardProgressAction(
    gameSession,
    () =>
      dispatchRunSessionCommand<ShopTransactionResult | null>(
        (draft) => {
          if (draft.session.activity.kind !== activity) return rejectCommand("Shop visit is no longer active", null);
          const result = recipe(draft);
          return result.committed ? acceptCommand(result) : rejectCommand("Shop action was rejected", result);
        },
        undefined,
        gameSession,
      ),
    null,
  )();
  if (!result) return { committed: false, price: 0, value: undefined };
  if (result.committed && result.price > 0) sessionFeedback(gameSession).playGoldSpend();
  if (result.committed && successSound) sessionFeedback(gameSession).playUISound(successSound);
  return result;
}
