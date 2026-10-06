import { ART_PRESETS } from "./asset-constants.mjs";

// Explicit game selection; unrelated library files never become shipping assets.
export const gearAssets = [
  {
    source: "2d Assets/Game Sources/Items/Equipment/Crossbow/Crossbow - Astral.jpeg",
    target: "gear-crossbow-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Crossbow/Crossbow - Basic.jpeg",
    target: "gear-crossbow-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Dagger/Dagger - Astral.jpeg",
    target: "gear-dagger-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Dagger/Dagger - Basic.jpeg",
    target: "gear-dagger-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Double Axe/Double Axe - Astral.jpeg",
    target: "gear-double-axe-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Double Axe/Double Axe - Basic.jpeg",
    target: "gear-double-axe-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Emerald Amulet/Emerald Amulet - Astral.jpeg",
    target: "gear-emerald-amulet-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Emerald Amulet/Emerald Amulet - Basic.jpeg",
    target: "gear-emerald-amulet-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Emerald Ring/Emerald Ring - Astral.jpeg",
    target: "gear-emerald-ring-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Emerald Ring/Emerald Ring - Basic.jpeg",
    target: "gear-emerald-ring-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Flail/Flail - Astral.jpeg",
    target: "gear-flail-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Flail/Flail - Basic.jpeg",
    target: "gear-flail-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Interface/Gear Slots/Accessory Slot.jpeg",
    target: "gear-slot-accessory.webp",
  },
  {
    source: "2d Assets/Game Sources/Interface/Gear Slots/Body Slot.jpeg",
    target: "gear-slot-body.webp",
  },
  {
    source: "2d Assets/Game Sources/Interface/Gear Slots/Trinket Slot.jpeg",
    target: "gear-slot-trinket.webp",
  },
  {
    source: "2d Assets/Game Sources/Interface/Gear Slots/Weapon Slot.jpeg",
    target: "gear-slot-weapon.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Greatsword/Greatsword - Astral.jpeg",
    target: "gear-greatsword-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Greatsword/Greatsword - Basic.jpeg",
    target: "gear-greatsword-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Hatchet/Hatchet - Astral.jpeg",
    target: "gear-hatchet-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Hatchet/Hatchet - Basic.jpeg",
    target: "gear-hatchet-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Kite Shield/Kite Shield - Astral.jpeg",
    target: "gear-kite-shield-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Kite Shield/Kite Shield - Basic.jpeg",
    target: "gear-kite-shield-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Leather Armor/Leather Armor - Astral.jpeg",
    target: "gear-leather-armor-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Leather Armor/Leather Armor - Basic.jpeg",
    target: "gear-leather-armor-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Leather Buckler/Leather Buckler - Astral.jpeg",
    target: "gear-leather-buckler-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Leather Buckler/Leather Buckler - Basic.jpeg",
    target: "gear-leather-buckler-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Longbow/Longbow - Astral.jpeg",
    target: "gear-longbow-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Longbow/Longbow - Basic.jpeg",
    target: "gear-longbow-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Longsword/Longsword - Astral.jpeg",
    target: "gear-longsword-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Longsword/Longsword - Basic.jpeg",
    target: "gear-longsword-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Mace/Mace - Astral.jpeg",
    target: "gear-mace-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Mace/Mace - Basic.jpeg",
    target: "gear-mace-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Maul/Maul - Astral.jpeg",
    target: "gear-maul-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Maul/Maul - Basic.jpeg",
    target: "gear-maul-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Plate Armor/Plate Armor - Astral.jpeg",
    target: "gear-plate-armor-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Plate Armor/Plate Armor - Basic.jpeg",
    target: "gear-plate-armor-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Quiver/Quiver - Astral.jpeg",
    target: "gear-quiver-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Quiver/Quiver - Basic.jpeg",
    target: "gear-quiver-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Recurve Bow/Recurve Bow - Astral.jpeg",
    target: "gear-recurve-bow-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Recurve Bow/Recurve Bow - Basic.jpeg",
    target: "gear-recurve-bow-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Ruby Amulet/Ruby Amulet - Astral.jpeg",
    target: "gear-ruby-amulet-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Ruby Amulet/Ruby Amulet - Basic.jpeg",
    target: "gear-ruby-amulet-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Ruby Ring/Ruby Ring - Astral.jpeg",
    target: "gear-ruby-ring-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Ruby Ring/Ruby Ring - Basic.jpeg",
    target: "gear-ruby-ring-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Sapphire Amulet/Sapphire Amulet - Astral.jpeg",
    target: "gear-sapphire-amulet-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Sapphire Amulet/Sapphire Amulet - Basic.jpeg",
    target: "gear-sapphire-amulet-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Sapphire Ring/Sapphire Ring - Astral.jpeg",
    target: "gear-sapphire-ring-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Sapphire Ring/Sapphire Ring - Basic.jpeg",
    target: "gear-sapphire-ring-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Shortbow/Shortbow - Astral.jpeg",
    target: "gear-shortbow-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Shortbow/Shortbow - Basic.jpeg",
    target: "gear-shortbow-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Shortsword/Shortsword - Astral.jpeg",
    target: "gear-shortsword-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Shortsword/Shortsword - Basic.jpeg",
    target: "gear-shortsword-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Spellbook/Spellbook - Astral.jpeg",
    target: "gear-spellbook-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Spellbook/Spellbook - Basic.jpeg",
    target: "gear-spellbook-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Staff/Staff - Astral.jpeg",
    target: "gear-staff-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Staff/Staff - Basic.jpeg",
    target: "gear-staff-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Topaz Amulet/Topaz Amulet - Astral.jpeg",
    target: "gear-topaz-amulet-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Topaz Amulet/Topaz Amulet - Basic.jpeg",
    target: "gear-topaz-amulet-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Topaz Ring/Topaz Ring - Astral.jpeg",
    target: "gear-topaz-ring-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Topaz Ring/Topaz Ring - Basic.jpeg",
    target: "gear-topaz-ring-basic.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Wand/Wand - Astral.jpeg",
    target: "gear-wand-astral.webp",
  },
  {
    source: "2d Assets/Game Sources/Items/Equipment/Wand/Wand - Basic.jpeg",
    target: "gear-wand-basic.webp",
  },
].map((entry) => ({ ...entry, width: ART_PRESETS.gear.width, quality: ART_PRESETS.gear.quality }));
