import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { deductGold, readDraftGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { playGoldSpend, playUISound } from "@/lib/audio";

export interface ShopTransactionResult<T = undefined> {
  committed: boolean;
  price: number;
  value: T;
}

function playShopSpendFeedback(result: Pick<ShopTransactionResult<unknown>, "committed" | "price">): void {
  if (result.committed && result.price > 0) playGoldSpend();
}

export function runShopTransaction<T>(
  activity: "shop" | "alchemist" | "trinket-shop" | "equipment-shop",
  recipe: (draft: GameplayDraft) => ShopTransactionResult<T>,
  successSound?: Parameters<typeof playUISound>[0],
): ShopTransactionResult<T | undefined> {
  const result = dispatchRunSessionCommand((draft) =>
    draft.session.activity.kind === activity ? recipe(draft) : null,
  );
  if (!result) return { committed: false, price: 0, value: undefined };
  playShopSpendFeedback(result);
  if (result.committed && successSound) playUISound(successSound);
  return result;
}

interface CommitShopServiceInput<T> {
  draft: GameplayDraft;
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
