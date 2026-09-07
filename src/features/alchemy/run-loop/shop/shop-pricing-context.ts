import { activeLabyrinthBenefits } from "@/lib/content-systems/labyrinth/room-rules";
import { readActiveRun, readRunSession, readShopFirstPurchaseUsed } from "@/features/alchemy/shared/stores/run-reads";
import { readEquippedTrinketId } from "@/features/alchemy/shared/stores/gear-store";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { combineTrinketEffectIds } from "@/lib/trinkets";
import type { TalentEffectManifest } from "@/lib/game-data";
import type { ShopBuyPriceContext } from "./shop-pricing";

export type ShopSessionStateKey = "shopState" | "alchemistState" | "trinketShopState" | "equipmentShopState";

function resolveShopPricingContext(args: {
  talentEffects: TalentEffectManifest;
  runBoons: string[];
  firstPurchaseUsed: boolean;
  modifiers: NonNullable<ShopBuyPriceContext["modifiers"]>;
}): ShopBuyPriceContext {
  return args;
}

export function resolveReadShopPricingContext(
  talentEffects: TalentEffectManifest,
  shopKey: ShopSessionStateKey,
): ShopBuyPriceContext {
  const run = readActiveRun();
  return resolveShopPricingContext({
    talentEffects,
    modifiers: activeLabyrinthBenefits(run.contentSystemType, readRunSession().activeLabyrinthRewardModifiers),
    runBoons: combineTrinketEffectIds(run.runBoons, readEquippedTrinketId(run.characterId)),
    firstPurchaseUsed: readShopFirstPurchaseUsed(shopKey),
  });
}

export function resolveDraftShopPricingContext(
  talentEffects: TalentEffectManifest,
  draft: GameplayDraft,
  state: { firstPurchaseUsed: boolean },
): ShopBuyPriceContext {
  return resolveShopPricingContext({
    talentEffects,
    modifiers: activeLabyrinthBenefits(
      draft.run.activeRun.contentSystemType,
      draft.session.activeLabyrinthRewardModifiers,
    ),
    runBoons: combineTrinketEffectIds(
      draft.run.activeRun.runBoons,
      draft.gear.equippedTrinkets[draft.run.activeRun.characterId],
    ),
    firstPurchaseUsed: state.firstPurchaseUsed,
  });
}
