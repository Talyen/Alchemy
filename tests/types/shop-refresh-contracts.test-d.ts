import { createShopRefreshAction } from "@/features/alchemy/run-loop/shop/shop-commands-core";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import { initializeShopVisit } from "@/features/alchemy/run-loop/run/room-visit-initialization";
import type { AlchemistState } from "@/lib/active-run-session";
import { setRunActivityData } from "@/features/alchemy/shared/stores/run-session-write-port";
import type { RunTransaction } from "@/features/alchemy/shared/stores/run-session-command";
import { defaultGameSession } from "@/app/application-session";
import type { TalentEffectManifest } from "@/lib/game-data";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";

declare const alchemistState: AlchemistState;
declare const draft: RunTransaction;
declare const cachedEffects: { talentEffects: TalentEffectManifest; homesteadEffects: HomesteadEffectManifest };

createShopActions(defaultGameSession);
// @ts-expect-error -- shop progression must come from the bound session
createShopActions(cachedEffects, defaultGameSession);
// @ts-expect-error -- Gear sampling cannot override transaction-owned Homestead effects
initializeShopVisit(draft, "equipment", 1);

createShopRefreshAction(
  {
    activity: "shop",
    // @ts-expect-error -- a Card Shop refresh must return a card shelf and its service state
    resample: () => alchemistState,
  },
  defaultGameSession,
);

createShopRefreshAction(
  {
    activity: "shop",
    resample: (_draft, state) => {
      // @ts-expect-error -- Card Shop samplers cannot read an Alchemist shelf
      void state.potions;
      return state;
    },
  },
  defaultGameSession,
);

// @ts-expect-error -- the canonical write target cannot be inferred from a mismatched payload
setRunActivityData(draft, "shop", alchemistState);
