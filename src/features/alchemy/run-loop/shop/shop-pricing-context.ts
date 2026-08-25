import { readActiveRun, readShopFirstPurchaseUsed } from "@/features/alchemy/shared/stores/run-session-read-port";
import { readEquippedTrinketId } from "@/features/alchemy/shared/stores/gear-store";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { combineTrinketEffectIds } from "@/lib/trinkets";
import type { TalentEffectManifest } from "@/lib/game-data";
import type { ShopBuyPriceContext } from "./shop-pricing";

export type ShopSessionStateKey = "shopState" | "alchemistState" | "trinketShopState" | "equipmentShopState";

export function resolveReadShopPricingContext(
  talentEffects: TalentEffectManifest,
  shopKey: ShopSessionStateKey,
): ShopBuyPriceContext {
  const run = readActiveRun();
  return {
    talentEffects,
    runBoons: combineTrinketEffectIds(run.runBoons, readEquippedTrinketId(run.characterId)),
    firstPurchaseUsed: readShopFirstPurchaseUsed(shopKey),
  };
}

export function resolveDraftShopPricingContext(
  talentEffects: TalentEffectManifest,
  draft: GameplayDraft,
  state: { firstPurchaseUsed: boolean },
): ShopBuyPriceContext {
  return {
    talentEffects,
    runBoons: combineTrinketEffectIds(
      draft.run.activeRun.runBoons,
      draft.gear.equippedTrinkets[draft.run.activeRun.characterId],
    ),
    firstPurchaseUsed: state.firstPurchaseUsed,
  };
}
