import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/run-session-command";
import { deductGold, readDraftGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { guardProgressAction, sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import type { BattleCard } from "@/lib/game-data";
import { type playUISound } from "@/lib/audio";

export interface ShopTransactionResult {
  committed: boolean;
  price: number;
  value: BattleCard | null | undefined;
}

function playShopSpendFeedback(
  result: Pick<ShopTransactionResult, "committed" | "price">,
  gameSession: GameSession,
): void {
  if (result.committed && result.price > 0) sessionFeedback(gameSession).playGoldSpend();
}

export function runShopTransaction(
  activity: "shop" | "alchemist" | "trinket-shop" | "equipment-shop",
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
  playShopSpendFeedback(result, gameSession);
  if (result.committed && successSound) sessionFeedback(gameSession).playUISound(successSound);
  return result;
}

interface CommitShopServiceInput {
  draft: RunTransaction;
  price: number;
  guard: boolean;
  failureValue: BattleCard | null | undefined;
  apply: () => BattleCard | null | undefined;
}

export function commitShopService(input: CommitShopServiceInput): ShopTransactionResult {
  if (!input.guard || readDraftGold(input.draft) < input.price) {
    return { committed: false, price: input.price, value: input.failureValue };
  }
  deductGold(input.draft, input.price);
  const value = input.apply();
  return { committed: true, price: input.price, value };
}
