import type { KeywordId } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { GearRarity, GearSlot } from "./types";

export type GearSlotRule = "two-handed" | "ranged" | "quiver" | "standard";

export interface GearBaseItemDefinition {
  id: string;
  displayName: string;
  compatibleSlots: GearSlot[];
  slotRule: GearSlotRule;
  affinityKeywords: KeywordId[];
  salvageByRarity: Record<GearRarity, MaterialInventory>;
}

// Each placement owns both its hand rule and legal slots.
function baseItem(slotRule: GearSlotRule, compatibleSlots: GearSlot[]) {
  return (
    displayName: string,
    affinityKeywords: KeywordId[],
    salvageByRarity: GearBaseItemDefinition["salvageByRarity"],
  ): Omit<GearBaseItemDefinition, "id"> => ({
    displayName,
    affinityKeywords,
    salvageByRarity,
    slotRule,
    compatibleSlots: [...compatibleSlots],
  });
}
const oneHanded = baseItem("standard", ["main-hand", "off-hand"]);
const twoHanded = baseItem("two-handed", ["main-hand"]);
const ranged = baseItem("ranged", ["main-hand"]);
const offHand = baseItem("standard", ["off-hand"]);
const quiver = baseItem("quiver", ["off-hand"]);
const bodyArmor = baseItem("standard", ["body"]);

function salvageBy(
  basic: Partial<MaterialInventory>,
  astral: Partial<MaterialInventory>,
  unique?: Partial<MaterialInventory>,
): Record<GearRarity, MaterialInventory> {
  return {
    basic: { ...emptyInventory(), ...basic },
    astral: { ...emptyInventory(), ...astral },
    unique: { ...emptyInventory(), ...(unique ?? astral) },
  };
}

const ironLight = salvageBy({ iron: 3 }, { iron: 6 });
const ironMedium = salvageBy({ iron: 6 }, { iron: 9 });
const ironHeavy = salvageBy({ iron: 9 }, { iron: 12 });
const woodLight = salvageBy({ wood: 3 }, { wood: 6 });
const woodMedium = salvageBy({ wood: 6 }, { wood: 9 });
const gemsLight = salvageBy({ gems: 3 }, { gems: 6 });
const hideLight = salvageBy({ hide: 3 }, { hide: 6 });
const woodHideLight = salvageBy({ wood: 3, hide: 3 }, { wood: 6, hide: 6 });

const JEWELRY_KINDS = ["ring", "amulet"] as const;

type JewelryGemSlug = "ruby" | "sapphire" | "emerald" | "topaz";

type JewelryBaseItemId = `${JewelryGemSlug}-${(typeof JEWELRY_KINDS)[number]}`;

const JEWELRY_GEMS: Array<{
  slug: JewelryGemSlug;
  label: string;
  keywords: KeywordId[];
  salvage: Record<GearRarity, MaterialInventory>;
}> = [
  { slug: "ruby", label: "Ruby", keywords: ["burn", "bleed", "leech"], salvage: gemsLight },
  { slug: "sapphire", label: "Sapphire", keywords: ["freeze", "mana", "block"], salvage: gemsLight },
  { slug: "emerald", label: "Emerald", keywords: ["nature", "poison", "archery", "dodge"], salvage: gemsLight },
  { slug: "topaz", label: "Topaz", keywords: ["holy", "gold", "forge", "stun"], salvage: gemsLight },
];

function jewelryBaseItems(): Record<JewelryBaseItemId, Omit<GearBaseItemDefinition, "id">> {
  const entries = {} as Record<JewelryBaseItemId, Omit<GearBaseItemDefinition, "id">>;
  for (const gem of JEWELRY_GEMS) {
    for (const kind of JEWELRY_KINDS) {
      const label = kind === "ring" ? "Ring" : "Amulet";
      entries[`${gem.slug}-${kind}`] = {
        displayName: `${gem.label} ${label}`,
        compatibleSlots: ["left-accessory", "right-accessory"],
        slotRule: "standard",
        affinityKeywords: [...gem.keywords],
        salvageByRarity: gem.salvage,
      };
    }
  }
  return entries;
}

const gearBaseItemCatalog = {
  "double-axe": twoHanded("Double Axe", ["physical", "stun", "bleed"], ironHeavy),
  maul: twoHanded("Maul", ["physical", "stun", "holy"], ironHeavy),
  greatsword: twoHanded("Greatsword", ["physical", "stun", "forge"], ironHeavy),
  hatchet: oneHanded("Hatchet", ["physical", "bleed"], salvageBy({ iron: 3, wood: 3 }, { iron: 6, wood: 3 })),
  longsword: oneHanded("Longsword", ["physical", "forge", "holy"], ironMedium),
  shortsword: oneHanded("Shortsword", ["physical", "forge", "bleed"], ironLight),
  dagger: oneHanded("Dagger", ["physical", "bleed", "poison", "dodge"], ironLight),
  mace: oneHanded("Mace", ["physical", "stun", "holy"], ironMedium),
  flail: oneHanded("Flail", ["physical", "stun"], ironMedium),
  longbow: ranged("Longbow", ["archery", "physical", "nature", "companion"], woodMedium),
  shortbow: ranged("Shortbow", ["archery", "physical", "nature", "companion", "dodge"], woodLight),
  "recurve-bow": ranged("Recurve Bow", ["archery", "nature", "physical", "companion"], woodMedium),
  crossbow: ranged("Crossbow", ["archery", "physical"], salvageBy({ wood: 6, iron: 3 }, { wood: 6, iron: 6 })),
  staff: twoHanded("Staff", ["burn", "freeze", "mana"], salvageBy({ wood: 3, gems: 3 }, { wood: 6, gems: 3 })),
  wand: oneHanded("Wand", ["burn", "freeze", "mana"], salvageBy({ wood: 3 }, { wood: 3, gems: 3 })),
  "leather-buckler": offHand("Leather Buckler", ["block", "armor", "physical", "dodge"], woodHideLight),
  "kite-shield": offHand("Kite Shield", ["block", "armor", "stun", "physical"], ironHeavy),
  quiver: quiver("Quiver", ["archery", "physical", "dodge"], hideLight),
  spellbook: offHand("Spellbook", ["burn", "freeze", "holy"], salvageBy({ gems: 6 }, { gems: 9 })),
  "leather-armor": bodyArmor("Leather Armor", ["physical", "health", "armor", "dodge"], hideLight),
  "plate-armor": bodyArmor("Plate Armor", ["armor", "block", "stun", "physical"], ironHeavy),
  ...jewelryBaseItems(),
} satisfies Record<string, Omit<GearBaseItemDefinition, "id">>;

export type GearBaseItemId = keyof typeof gearBaseItemCatalog;

export const gearBaseItems = Object.fromEntries(
  Object.entries(gearBaseItemCatalog).map(([id, item]) => [id, { ...item, id }]),
) as Record<GearBaseItemId, GearBaseItemDefinition>;

export const gearBaseItemList = Object.values(gearBaseItems);
