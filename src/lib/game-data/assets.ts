// Imported asset references (all .webp) consumed by game-data barrel readers and UI.
// The prebuild step optimizes PNG source files into webp; this file only sees the output.
import type { KeywordId } from "./types";

import alchemist from "@/assets/optimized/alchemist.webp";
import alchemyLogo from "@/assets/optimized/alchemy-logo.webp";
import alchemyLogoArcaneMana from "@/assets/optimized/alchemy-logo-arcane-mana.webp";
import alchemyLogoFireIron from "@/assets/optimized/alchemy-logo-fire-iron.webp";
import alchemyLogoFrost from "@/assets/optimized/alchemy-logo-frost.webp";
import alchemyLogoHolyBlock from "@/assets/optimized/alchemy-logo-holy-block.webp";
import alchemyLogoNatureBleed from "@/assets/optimized/alchemy-logo-nature-bleed.webp";
import alchemyLogoPoison from "@/assets/optimized/alchemy-logo-poison.webp";
import discardPile from "@/assets/optimized/discard-pile.webp";
import drawPile from "@/assets/optimized/draw-pile.webp";
import druid from "@/assets/optimized/druid.webp";
import gearSlotAmulet from "@/assets/optimized/gear-slot-amulet.webp";
import gearSlotBelt from "@/assets/optimized/gear-slot-belt.webp";
import gearSlotBody from "@/assets/optimized/gear-slot-body.webp";
import gearSlotBoots from "@/assets/optimized/gear-slot-boots.webp";
import gearSlotGloves from "@/assets/optimized/gear-slot-gloves.webp";
import gearSlotHelm from "@/assets/optimized/gear-slot-helm.webp";
import gearSlotLeftRing from "@/assets/optimized/gear-slot-left-ring.webp";
import gearSlotMainHand from "@/assets/optimized/gear-slot-main-hand.webp";
import gearSlotOffHand from "@/assets/optimized/gear-slot-off-hand.webp";
import gearSlotRightRing from "@/assets/optimized/gear-slot-right-ring.webp";
import knight from "@/assets/optimized/knight.webp";
import pointerCursor from "@/assets/optimized/pointer-c-shaded.webp";
import ranger from "@/assets/optimized/ranger.webp";
import rogue from "@/assets/optimized/rogue.webp";
import talentBgArmor from "@/assets/optimized/talent-bg-armor.webp";
import talentBgBleed from "@/assets/optimized/talent-bg-bleed.webp";
import talentBgBurn from "@/assets/optimized/talent-bg-burn.webp";
import talentBgCompanion from "@/assets/optimized/talent-bg-companion.webp";
import talentBgForge from "@/assets/optimized/talent-bg-forge.webp";
import talentBgFreeze from "@/assets/optimized/talent-bg-freeze.webp";
import talentBgLeech from "@/assets/optimized/talent-bg-leech.webp";
import talentBgMana from "@/assets/optimized/talent-bg-mana.webp";
import talentBgNature from "@/assets/optimized/talent-bg-nature.webp";
import talentBgPhysical from "@/assets/optimized/talent-bg-physical.webp";
import talentBgStun from "@/assets/optimized/talent-bg-stun.webp";
import warlock from "@/assets/optimized/warlock.webp";
import wildcard from "@/assets/optimized/wildcard.webp";
import wizard from "@/assets/optimized/wizard.webp";

// Locally imported for mysteryEventArt augmentation — also re-exported below.
import brassCenser from "@/assets/optimized/brass-censer.webp";
import crystalGarden from "@/assets/optimized/crystal-garden.webp";
import herbGarden from "@/assets/optimized/herb-garden.webp";
import huntersLodge from "@/assets/optimized/hunters-lodge.webp";
import necromancer from "@/assets/optimized/necromancer.webp";
import phoenixFeather from "@/assets/optimized/phoenix-feather.webp";
import wolfCompanion from "@/assets/optimized/wolf-companion.webp";
import theCampaign from "@/assets/optimized/the-campaign.webp";
import theLabyrinth from "@/assets/optimized/the-labyrinth.webp";
import theWildwoods from "@/assets/optimized/the-wildwoods.webp";
import placeholderGameMode from "@/assets/optimized/placeholder-game-mode.webp";

export * from "./assets.generated";
export { default as alchemistShopBg } from "@/assets/optimized/alchemist-shop.webp";
export { default as eliteEnemyBg } from "@/assets/optimized/elite-enemy.webp";
export { default as merchantShopBg } from "@/assets/optimized/merchant-shop.webp";
export { default as mysteryBg } from "@/assets/optimized/mystery.webp";
export { default as normalEnemyBg } from "@/assets/optimized/normal-enemy.webp";

export { alchemist };
export { alchemyLogo };
export { alchemyLogoArcaneMana };
export { alchemyLogoFireIron };
export { alchemyLogoFrost };
export { alchemyLogoHolyBlock };
export { alchemyLogoNatureBleed };
export { alchemyLogoPoison };
export { discardPile };
export { drawPile };
export { druid };
export { knight };
export { pointerCursor };
export { ranger };
export { rogue };
export { talentBgArmor };
export { talentBgBleed };
export { talentBgBurn };
export { talentBgCompanion };
export { talentBgForge };
export { talentBgFreeze };
export { talentBgLeech };
export { talentBgMana };
export { talentBgNature };
export { talentBgPhysical };
export { talentBgStun };
export { warlock };
export { wildcard };
export { wizard };

export { theCampaign, theLabyrinth, theWildwoods, placeholderGameMode };

export const menuLogo = alchemyLogo;
export const menuLogoVariants = [
  alchemyLogo,
  alchemyLogoArcaneMana,
  alchemyLogoFireIron,
  alchemyLogoFrost,
  alchemyLogoHolyBlock,
  alchemyLogoNatureBleed,
  alchemyLogoPoison,
];
export const pileDrawArt = drawPile;
export const pileDiscardArt = discardPile;

export const characterArt = {
  knight,
  ranger,
  rogue,
  wizard,
  alchemist,
  warlock,
  druid,
  wildcard,
} as const;

export const cursorArt = {
  pointer: pointerCursor,
} as const;

const mysteryArtModules = import.meta.glob("@/assets/optimized/mystery-*.webp", {
  eager: true,
  import: "default",
});

function mysteryEventArtKey(path: string): string {
  const filename = path.split("/").pop() ?? "";
  return filename.replace(/^mystery-/, "").replace(/\.webp$/, "");
}

export const mysteryEventArt: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(mysteryArtModules)
      .filter(([path]) => !path.includes("placeholder"))
      .map(([path, url]) => [mysteryEventArtKey(path), url as string]),
  ),
  "necromancers-offer": necromancer,
  "medicinal-herb-garden": herbGarden,
  "crystal-garden": crystalGarden,
  "hunters-lodge": huntersLodge,
  "roadside-censer": brassCenser,
  "the-phoenix": phoenixFeather,
  "the-wolf": wolfCompanion,
};

const assetModules = import.meta.glob("@/assets/optimized/*.webp", {
  eager: true,
  import: "default",
});
export const allGameArt = Object.entries(assetModules)
  .filter(([path]) => !path.includes("/mystery-"))
  .map(([, url]) => url as string);

export const talentBackgroundArt: Partial<Record<KeywordId, string>> = {
  physical: talentBgPhysical,
  stun: talentBgStun,
  forge: talentBgForge,
  armor: talentBgArmor,
  burn: talentBgBurn,
  bleed: talentBgBleed,
  freeze: talentBgFreeze,
  mana: talentBgMana,
  leech: talentBgLeech,
  nature: talentBgNature,
  companion: talentBgCompanion,
};

export const gearSlotBackgroundArt = {
  body: gearSlotBody,
  helm: gearSlotHelm,
  boots: gearSlotBoots,
  gloves: gearSlotGloves,
  belt: gearSlotBelt,
  "main-hand": gearSlotMainHand,
  "off-hand": gearSlotOffHand,
  "left-ring": gearSlotLeftRing,
  "right-ring": gearSlotRightRing,
  amulet: gearSlotAmulet,
} as const;
