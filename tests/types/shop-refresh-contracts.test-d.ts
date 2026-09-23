import { createShopRefreshAction } from "@/features/alchemy/run-loop/shop/shop-commands-core";
import type { DraftStateWriter } from "@/features/alchemy/run-loop/shop/shop-transactions";
import type { AlchemistState, ShopState } from "@/lib/active-run-session";
import type { TalentEffectManifest } from "@/lib/game-data";

declare const alchemistWriter: DraftStateWriter<AlchemistState>;
declare const shopWriter: DraftStateWriter<ShopState>;
declare const talents: TalentEffectManifest;

createShopRefreshAction({
  activity: "shop",
  kind: "merchant",
  talentEffects: talents,
  // @ts-expect-error -- a Card Shop refresh cannot write Alchemist state
  setState: alchemistWriter,
  mapState: (previous) => previous,
  resample: () => [],
});

createShopRefreshAction({
  activity: "shop",
  // @ts-expect-error -- a Card Shop refresh cannot use Trinket pricing
  kind: "trinket",
  talentEffects: talents,
  setState: shopWriter,
  mapState: (previous) => previous,
  resample: () => [],
});
