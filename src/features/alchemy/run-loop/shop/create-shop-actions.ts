// Compose stable, domain-shaped shop commands. Domain behavior lives in the sibling command modules.
import { createAlchemistShopCommands } from "./alchemist-shop-commands";
import { createEquipmentShopCommands } from "./equipment-shop-commands";
import { createMerchantShopCommands } from "./merchant-shop-commands";
import type { CreateShopActionsDeps, ShopActions, ShopKind } from "./shop-action-types";
import { createTrinketShopCommands } from "./trinket-shop-commands";

export function createShopActions(deps: CreateShopActionsDeps): ShopActions {
  const merchant = createMerchantShopCommands(deps);
  const alchemist = createAlchemistShopCommands(deps);
  const trinket = createTrinketShopCommands(deps);
  const equipment = createEquipmentShopCommands({
    talentEffects: deps.talentEffects,
    gearAstralChanceBonus: deps.homesteadEffects.gearAstralChanceBonus,
    rng: deps.rng,
  });

  const initializers: Record<ShopKind, () => void> = {
    merchant: merchant.initialize,
    alchemist: alchemist.initialize,
    trinket: trinket.initialize,
    equipment: equipment.initialize,
  };

  return {
    initialize: (kind) => initializers[kind](),
    merchant,
    alchemist,
    trinket,
    equipment,
  };
}
