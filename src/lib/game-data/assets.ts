// Imported asset references (all .webp) consumed by game-data barrel readers and UI.
// The prebuild step optimizes PNG source files into webp; this file only sees the output.
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
