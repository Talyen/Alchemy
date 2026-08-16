import type { KeywordId } from "./types";
import * as assetRefs from "./assets.generated";

export * from "./assets.generated";

export const alchemistShopBg = assetRefs.alchemistShop;
export const eliteEnemyBg = assetRefs.eliteEnemy;
export const merchantShopBg = assetRefs.merchantShop;
export const mysteryBg = assetRefs.mystery;
export const normalEnemyBg = assetRefs.normalEnemy;
const pointerCursor = assetRefs.pointerCShaded;

export const menuLogo = assetRefs.alchemyLogo;
export const menuLogoVariants = [
  assetRefs.alchemyLogo,
  assetRefs.alchemyLogoArcaneMana,
  assetRefs.alchemyLogoFireIron,
  assetRefs.alchemyLogoFrost,
  assetRefs.alchemyLogoHolyBlock,
  assetRefs.alchemyLogoNatureBleed,
  assetRefs.alchemyLogoPoison,
];
export const pileDrawArt = assetRefs.drawPile;
export const pileDiscardArt = assetRefs.discardPile;

export const characterArt = {
  knight: assetRefs.knight,
  ranger: assetRefs.ranger,
  rogue: assetRefs.rogue,
  wizard: assetRefs.wizard,
  alchemist: assetRefs.alchemist,
  warlock: assetRefs.warlock,
  druid: assetRefs.druid,
  wildcard: assetRefs.wildcard,
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

export const mysteryEventArt: Record<string, string> = Object.fromEntries(
  Object.entries(mysteryArtModules).map(([path, url]) => [mysteryEventArtKey(path), url as string]),
);

const assetModules = import.meta.glob("@/assets/optimized/*.webp", {
  eager: true,
  import: "default",
});
export const allGameArt = Object.values(assetModules) as string[];

export const gearSlotBackgroundArt = {
  body: assetRefs.gearSlotBody,
  "main-hand": assetRefs.gearSlotMainHand,
  "off-hand": assetRefs.gearSlotOffHand,
  "left-ring": assetRefs.gearSlotLeftRing,
  "right-ring": assetRefs.gearSlotRightRing,
  amulet: assetRefs.gearSlotAmulet,
} as const;

export const talentArt: Partial<Record<KeywordId, string>> = {
  archery: assetRefs.talentArchery,
  armor: assetRefs.talentArmor,
  bleed: assetRefs.talentBleed,
  block: assetRefs.talentBlock,
  burn: assetRefs.talentBurn,
  companion: assetRefs.talentCompanion,
  consume: assetRefs.talentConsume,
  forge: assetRefs.talentForge,
  freeze: assetRefs.talentFreeze,
  gold: assetRefs.talentGold,
  health: assetRefs.talentHealth,
  holy: assetRefs.talentHoly,
  leech: assetRefs.talentLeech,
  mana: assetRefs.talentMana,
  nature: assetRefs.talentNature,
  physical: assetRefs.talentPhysical,
  poison: assetRefs.talentPoison,
  stun: assetRefs.talentStun,
  wish: assetRefs.talentWish,
};
