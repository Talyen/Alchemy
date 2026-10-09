import { QUALITY, WIDTH } from "./asset-constants.mjs";

const talent = (source, target) => ({
  source,
  target,
  width: WIDTH.talent,
  quality: QUALITY.talent,
});

export const talentAssets = [
  talent("2d Assets/Game Sources/Interface/Talents/Archery.jpeg", "talent-archery.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Armor.jpeg", "talent-armor.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Bleed.jpeg", "talent-bleed.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Block.jpeg", "talent-block.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Burn.jpeg", "talent-burn.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Companion.jpeg", "talent-companion.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Consume.jpeg", "talent-consume.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Dodge.jpeg", "talent-dodge.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Forge.jpeg", "talent-forge.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Freeze.jpeg", "talent-freeze.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Gold.jpeg", "talent-gold.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Health.jpeg", "talent-health.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Holy.jpeg", "talent-holy.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Leech.jpeg", "talent-leech.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Mana.jpeg", "talent-mana.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Nature.jpeg", "talent-nature.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Physical.jpeg", "talent-physical.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Poison.jpeg", "talent-poison.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Stun.jpeg", "talent-stun.webp"),
  talent("2d Assets/Game Sources/Interface/Talents/Wish.jpeg", "talent-wish.webp"),
];
