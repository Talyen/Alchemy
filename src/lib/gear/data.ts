import { placeholderGear } from "@/lib/game-data/assets";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { GearDefinition, GearDefinitionId, GearSlot } from "./types";

function placeholder(id: GearDefinitionId, title: string, compatibleSlots: GearSlot[]): GearDefinition {
  return {
    id,
    title,
    compatibleSlots,
    descriptionLines: ["Increases Physical damage by 1."],
    art: placeholderGear,
    effects: { flatPhysicalDamage: 1 },
    salvageValue: { ...emptyInventory(), iron: 1 },
  };
}

export const gearDefinitions: Record<GearDefinitionId, GearDefinition> = {
  "placeholder-body": placeholder("placeholder-body", "Placeholder Body", ["body"]),
  "placeholder-helm": placeholder("placeholder-helm", "Placeholder Helm", ["helm"]),
  "placeholder-boots": placeholder("placeholder-boots", "Placeholder Boots", ["boots"]),
  "placeholder-gloves": placeholder("placeholder-gloves", "Placeholder Gloves", ["gloves"]),
  "placeholder-belt": placeholder("placeholder-belt", "Placeholder Belt", ["belt"]),
  "placeholder-main-hand": placeholder("placeholder-main-hand", "Placeholder Main Hand", ["main-hand"]),
  "placeholder-off-hand": placeholder("placeholder-off-hand", "Placeholder Off-Hand", ["off-hand"]),
  "placeholder-ring": placeholder("placeholder-ring", "Placeholder Ring", ["left-ring", "right-ring"]),
  "placeholder-amulet": placeholder("placeholder-amulet", "Placeholder Amulet", ["amulet"]),
};
export const gearDefinitionList = Object.values(gearDefinitions);
