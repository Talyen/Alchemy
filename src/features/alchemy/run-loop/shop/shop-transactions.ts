import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/run-session-command";
import { deductGold, readDraftGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import { type playUISound } from "@/lib/audio";

export interface ShopTransactionResult<T = undefined> {
  committed: boolean;
  price: number;
  value: T;
}

function playShopSpendFeedback(
  result: Pick<ShopTransactionResult<unknown>, "committed" | "price">,
  gameSession: GameSession,
): void {
  if (result.committed && result.price > 0) sessionFeedback(gameSession).playGoldSpend();
}

export function runShopTransaction<T>(
  activity: "shop" | "alchemist" | "trinket-shop" | "equipment-shop",
  recipe: (draft: RunTransaction) => ShopTransactionResult<T>,
  successSound: Parameters<typeof playUISound>[0] | undefined,
  gameSession: GameSession,
): ShopTransactionResult<T | undefined> {
  const result = dispatchRunSessionCommand(
    (draft) => {
      if (draft.session.activity.kind !== activity) return rejectCommand("Shop visit is no longer active", null);
      const result = recipe(draft);
      return result.committed ? acceptCommand(result) : rejectCommand("Shop action was rejected", result);
    },
    undefined,
    gameSession,
  );
  if (!result) return { committed: false, price: 0, value: undefined };
  playShopSpendFeedback(result, gameSession);
  if (result.committed && successSound) sessionFeedback(gameSession).playUISound(successSound);
  return result;
}

interface CommitShopServiceInput<T> {
  draft: RunTransaction;
  price: number;
  guard: boolean;
  failureValue: T;
  apply: () => T;
}

export function commitShopService<T>(input: CommitShopServiceInput<T>): ShopTransactionResult<T> {
  if (!input.guard || readDraftGold(input.draft) < input.price) {
    return { committed: false, price: input.price, value: input.failureValue };
  }
  deductGold(input.draft, input.price);
  const value = input.apply();
  return { committed: true, price: input.price, value };
}
