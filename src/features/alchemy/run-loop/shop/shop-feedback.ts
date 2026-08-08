import { playGoldSpend } from "@/lib/audio";
import type { ShopTransactionResult } from "../shop-transactions";

export function playShopSpendFeedback(result: Pick<ShopTransactionResult<unknown>, "committed" | "price">): void {
  if (result.committed && result.price > 0) playGoldSpend();
}
