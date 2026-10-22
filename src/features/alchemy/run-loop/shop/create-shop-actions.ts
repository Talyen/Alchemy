import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session/session-capabilities";
import { type GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import { createAlchemistShopCommands } from "./alchemist-shop-commands";
import { createEquipmentShopCommands } from "./equipment-shop-commands";
import { createMerchantShopCommands } from "./merchant-shop-commands";
import { createTrinketShopCommands } from "./trinket-shop-commands";

export function createShopActions(gameSession: GameSession) {
  return bindSessionCapabilities(gameSession, {
    merchant: createMerchantShopCommands(gameSession),
    alchemist: createAlchemistShopCommands(gameSession),
    trinket: createTrinketShopCommands(gameSession),
    equipment: createEquipmentShopCommands(gameSession),
  });
}
