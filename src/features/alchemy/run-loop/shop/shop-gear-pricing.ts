import { EQUIPMENT_SHOP_ASTRAL_PRICE, EQUIPMENT_SHOP_BASIC_PRICE } from "@/lib/game-constants";
import { gearDefinitions, type GearInstance } from "@/lib/gear";

export function getEquipmentShopPrice(instance: GearInstance): number {
  const rarity = gearDefinitions[instance.definitionId]?.rarity;
  return rarity === "astral" ? EQUIPMENT_SHOP_ASTRAL_PRICE : EQUIPMENT_SHOP_BASIC_PRICE;
}
