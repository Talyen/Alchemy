import { createShopRefreshAction, initializeShop } from "@/features/alchemy/run-loop/shop/shop-commands-core";
import type { AlchemistState } from "@/lib/active-run-session";
import { setRunActivityData } from "@/features/alchemy/shared/stores/run-session-write-port";
import type { RunTransaction } from "@/features/alchemy/shared/stores/run-session-command";
import type { TalentEffectManifest } from "@/lib/game-data";

declare const alchemistState: AlchemistState;
declare const draft: RunTransaction;
declare const talents: TalentEffectManifest;

createShopRefreshAction({
  activity: "shop",
  talentEffects: talents,
  // @ts-expect-error -- a Card Shop refresh must return a card shelf and its service state
  resample: () => alchemistState,
});

// @ts-expect-error -- initialization uses the same activity-to-state contract as refresh
initializeShop("shop", () => alchemistState);

createShopRefreshAction({
  activity: "shop",
  talentEffects: talents,
  resample: (_draft, state) => {
    // @ts-expect-error -- Card Shop samplers cannot read an Alchemist shelf
    void state.potions;
    return state;
  },
});

// @ts-expect-error -- the canonical write target cannot be inferred from a mismatched payload
setRunActivityData(draft, "shop", alchemistState);
