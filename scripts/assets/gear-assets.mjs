import { ART_PRESETS } from "./asset-constants.mjs";
import { artGroup } from "./art-group.mjs";
import { toGearTarget } from "./gear-filenames.mjs";

function gearVariants(names) {
  return artGroup(
    { folder: "Items/Equipment", preset: ART_PRESETS.gear },
    names.flatMap((name) =>
      ["Astral", "Basic"].map((rarity) => [`${name}/${name} - ${rarity}.jpeg`, toGearTarget(name, rarity)]),
    ),
  );
}

// Explicit item selection; both variants use the canonical Gear filename owner.
export const gearAssets = [
  ...gearVariants(["Crossbow", "Dagger", "Double Axe", "Emerald Amulet", "Emerald Ring", "Flail"]),
  ...artGroup({ folder: "Interface/Gear Slots", preset: ART_PRESETS.gear }, [
    ["Accessory Slot.jpeg", "gear-slot-accessory.webp"],
    ["Body Slot.jpeg", "gear-slot-body.webp"],
    ["Trinket Slot.jpeg", "gear-slot-trinket.webp"],
    ["Weapon Slot.jpeg", "gear-slot-weapon.webp"],
  ]),
  ...gearVariants([
    "Greatsword",
    "Hatchet",
    "Kite Shield",
    "Leather Armor",
    "Leather Buckler",
    "Longbow",
    "Longsword",
    "Mace",
    "Maul",
    "Plate Armor",
    "Quiver",
    "Recurve Bow",
    "Ruby Amulet",
    "Ruby Ring",
    "Sapphire Amulet",
    "Sapphire Ring",
    "Shortbow",
    "Shortsword",
    "Spellbook",
    "Staff",
    "Topaz Amulet",
    "Topaz Ring",
    "Wand",
  ]),
];
