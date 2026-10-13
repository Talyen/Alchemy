import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session-capabilities";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { createAlchemistShopCommands } from "./alchemist-shop-commands";
import { createEquipmentShopCommands } from "./equipment-shop-commands";
import { createMerchantShopCommands } from "./merchant-shop-commands";
import type { ShopActions } from "./shop-action-types";
import { createTrinketShopCommands } from "./trinket-shop-commands";

export function createShopActions(gameSession: GameSession): ShopActions {
  const shops = {
    merchant: createMerchantShopCommands(gameSession),
    alchemist: createAlchemistShopCommands(gameSession),
    trinket: createTrinketShopCommands(gameSession),
    equipment: createEquipmentShopCommands(gameSession),
  };

  return bindSessionCapabilities(gameSession, shops);
}
