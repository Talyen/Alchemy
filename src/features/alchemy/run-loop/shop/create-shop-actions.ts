import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { createAlchemistShopCommands } from "./alchemist-shop-commands";
import { createEquipmentShopCommands } from "./equipment-shop-commands";
import { createMerchantShopCommands } from "./merchant-shop-commands";
import type { CreateShopActionsDeps, ShopActions, ShopKind } from "./shop-action-types";
import { createTrinketShopCommands } from "./trinket-shop-commands";

export function createShopActions(
  deps: CreateShopActionsDeps,
  gameSession: GameSession = defaultGameSession,
): ShopActions {
  const shops = {
    merchant: createMerchantShopCommands(deps, gameSession),
    alchemist: createAlchemistShopCommands(deps, gameSession),
    trinket: createTrinketShopCommands(deps, gameSession),
    equipment: createEquipmentShopCommands(
      {
        talentEffects: deps.talentEffects,
        gearAstralChanceBonus: deps.homesteadEffects.gearAstralChanceBonus,
      },
      gameSession,
    ),
  };

  return {
    initialize: (kind: ShopKind) => shops[kind].initialize(),
    ...shops,
  };
}
