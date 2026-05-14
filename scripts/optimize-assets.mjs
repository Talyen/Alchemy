import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");
const sourceDir = path.join(rootDir, "Raw Assets");
const outputDir = path.join(rootDir, "src", "assets", "optimized");

const cardWidth = 420;
const cardQuality = 80;
const characterWidth = 720;

const assets = [
  // Logo
  { source: "Logo/Alchemy Logo.png", target: "alchemy-logo.webp", width: 1200, quality: 84 },
  // Misc
  { source: "Misc/Card Back.png", target: "card-back.webp", width: 420, quality: 82 },
  { source: "Misc/Draw Pile.png", target: "draw-pile.webp", width: 420, quality: 82 },
  { source: "Misc/Discard Pile.png", target: "discard-pile.webp", width: 420, quality: 82 },
  // Enemies
  { source: "Enemies/Skeleton.png", target: "skeleton.webp", width: 720, quality: 82 },
  { source: "Enemies/Goblin.png", target: "goblin.webp", width: 720, quality: 82 },
  { source: "Enemies/Imp.png", target: "imp.webp", width: 720, quality: 82 },
  { source: "Enemies/Lizard Scout.png", target: "lizard-scout.webp", width: 720, quality: 82 },
  { source: "Enemies/Mimic.png", target: "mimic.webp", width: 720, quality: 82 },
  { source: "Enemies/Mud Elemental.png", target: "mud-elemental.webp", width: 720, quality: 82 },
  { source: "Enemies/Necromancer.png", target: "necromancer.webp", width: 720, quality: 82 },
  { source: "Enemies/Plague Doctor.png", target: "plague-doctor.webp", width: 720, quality: 82 },
  // Characters
  { source: "Player Characters/Knight.png", target: "knight.webp", width: characterWidth, quality: 82 },
  { source: "Player Characters/Ranger.png", target: "ranger.webp", width: characterWidth, quality: 82 },
  { source: "Player Characters/Rogue.png", target: "rogue.webp", width: characterWidth, quality: 82 },
  { source: "Player Characters/Wizard.png", target: "wizard.webp", width: characterWidth, quality: 82 },
  // Cards
  { source: "Cards/Anvil.png", target: "anvil.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Apple.png", target: "apple.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Bash.png", target: "bash.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Blessed Aegis.png", target: "blessed-aegis.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Block.png", target: "block.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Bread.png", target: "bread.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Cleanse.png", target: "cleanse.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Fangs.png", target: "fangs.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Fireball.png", target: "fireball.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Frostbolt.png", target: "frostbolt.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Gold.png", target: "gold.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Haste.png", target: "haste.webp", width: cardWidth, quality: 88 },
  { source: "Cards/Heal.png", target: "heal.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Health Potion.png", target: "health-potion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Mana Berries.png", target: "mana-berries.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Mana Crystal.png", target: "mana-crystal.webp", width: cardWidth, quality: 88 },
  { source: "Cards/Mana Potion.png", target: "mana-potion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Meteor.png", target: "meteor.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Panacea Potion.png", target: "panacea-potion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Plate Mail.png", target: "plate-mail.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Poison Dagger.png", target: "poison-dagger.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Slash.png", target: "slash.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Stab.png", target: "stab.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Steal.png", target: "steal.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Wish.png", target: "wish.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Wolf Companion.png", target: "wolf-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Lizard Scout Companion.png", target: "lizard-scout-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Imp Companion.png", target: "imp-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Mixed Potion.png", target: "mixed-potion.webp", width: cardWidth, quality: 84 },
  // Destinations
  { source: "Destinations/Campfire.png", target: "campfire.webp", width: 900, quality: 84 },
  { source: "Destinations/Alchemist's Shop.png", target: "alchemist-shop.webp", width: 900, quality: 84 },
  { source: "Destinations/Merchant's Shop.png", target: "merchant-shop.webp", width: 900, quality: 84 },
  { source: "Destinations/Elite Enemy.png", target: "elite-enemy.webp", width: 900, quality: 84 },
  { source: "Destinations/Normal Enemy.png", target: "normal-enemy.webp", width: 900, quality: 84 },
  { source: "Destinations/Mystery.png", target: "mystery.webp", width: 900, quality: 84 },
  // Homestead
  { source: "Homestead/Blacksmith's Forge.png", target: "blacksmiths-forge.webp", width: 900, quality: 84 },
  { source: "Homestead/Chicken Coop.png", target: "chicken-coop.webp", width: 900, quality: 84 },
  { source: "Homestead/Herb Garden.png", target: "herb-garden.webp", width: 900, quality: 84 },
  { source: "Homestead/Pasture.png", target: "pasture.webp", width: 900, quality: 84 },
  // Trinkets
  { source: "Trinkets/Bone Charm.png", target: "bone-charm.webp", width: 420, quality: 82 },
  { source: "Trinkets/Brass Censer.png", target: "brass-censer.webp", width: 420, quality: 82 },
  { source: "Trinkets/Frozen Heart.png", target: "frozen-heart.webp", width: 420, quality: 82 },
  { source: "Trinkets/Ironwood Buckler.png", target: "ironwood-buckler.webp", width: 420, quality: 82 },
  { source: "Trinkets/Meteorite.png", target: "meteorite.webp", width: 420, quality: 82 },
  { source: "Trinkets/Obsidian Hammer.png", target: "obsidian-hammer.webp", width: 420, quality: 82 },
  { source: "Trinkets/Runic Quill.png", target: "runic-quill.webp", width: 420, quality: 82 },
  { source: "Trinkets/Tattered Pages.png", target: "tattered-pages.webp", width: 420, quality: 82 },
  { source: "Trinkets/Sin-Eater's Lantern.png", target: "sin-eaters-lantern.webp", width: 420, quality: 82 },
  { source: "Trinkets/Vanguard's Crest.png", target: "vanguards-crest.webp", width: 420, quality: 82 },
  { source: "Trinkets/Parasitic Bloom.png", target: "parasitic-bloom.webp", width: 420, quality: 82 },
  { source: "Trinkets/Cutpurse Knife.png", target: "cutpurse-knife.webp", width: 420, quality: 82 },
  { source: "Trinkets/Wishing Well Coin.png", target: "wishing-well-coin.webp", width: 420, quality: 82 },
  { source: "Trinkets/Merchant's Favor.png", target: "merchants-favor.webp", width: 420, quality: 82 },
  { source: "Trinkets/Plague Doctor's Mask.png", target: "plague-doctors-mask.webp", width: 420, quality: 82 },
  { source: "Trinkets/Mortar and Pestle.png", target: "mortar-and-pestle.webp", width: 420, quality: 82 },
  { source: "Trinkets/Sundering Charm.png", target: "sundering-charm.webp", width: 420, quality: 82 },
  { source: "Trinkets/Resonant Chime.png", target: "resonant-chime.webp", width: 420, quality: 82 },
  { source: "Trinkets/Smuggler's Map.png", target: "smugglers-map.webp", width: 420, quality: 82 },
  { source: "Trinkets/Grove's Favor.png", target: "groves-favor.webp", width: 420, quality: 82 },
  // Placeholders
  { source: "Cards/Placeholder Card.png", target: "placeholder-card.webp", width: cardWidth, quality: 60 },
  { source: "Enemies/Placeholder Enemy.png", target: "placeholder-enemy.webp", width: 720, quality: 60 },
  { source: "Trinkets/Placeholder Trinket.png", target: "placeholder-trinket.webp", width: 420, quality: 60 },
  { source: "Destinations/Placeholder Destination.png", target: "placeholder-destination.webp", width: 900, quality: 60 },
  { source: "Homestead/Placeholder Homestead.png", target: "placeholder-homestead.webp", width: 900, quality: 60 },
  { source: "Mystery Events/Placeholder Mystery.png", target: "placeholder-mystery.webp", width: 900, quality: 60 },
  // Difficulties
  { source: "Difficulties/Placeholder Difficulty.png", target: "placeholder-difficulty.webp", width: 720, quality: 60 },
  { source: "Difficulties/Difficulty 1.png", target: "difficulty-1.webp", width: 720, quality: 82 },
  { source: "Difficulties/Difficulty 2.png", target: "difficulty-2.webp", width: 720, quality: 82 },
  { source: "Difficulties/Difficulty 3.png", target: "difficulty-3.webp", width: 720, quality: 82 },
];

async function fileIsFresh(sourcePath, outputPath) {
  try {
    const [sourceInfo, outputInfo] = await Promise.all([stat(sourcePath), stat(outputPath)]);
    return outputInfo.mtimeMs >= sourceInfo.mtimeMs;
  } catch {
    return false;
  }
}

async function optimizeAsset({ source, target, width, quality }) {
  const sourcePath = path.join(sourceDir, source);
  const outputPath = path.join(outputDir, target);

  const isFresh = await fileIsFresh(sourcePath, outputPath);
  if (isFresh) {
    return `${target} already up to date`;
  }

  await sharp(sourcePath)
    .resize({ width, fit: "inside", withoutEnlargement: true })
    .webp({ quality, alphaQuality: 90, effort: 6 })
    .toFile(outputPath);

  return `${target} optimized`;
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const results = [];
  for (const asset of assets) {
    results.push(await optimizeAsset(asset));
  }

  console.log(`Optimized ${results.length} art assets.`);
  for (const result of results) {
    console.log(`- ${result}`);
  }
}

main().catch((error) => {
  console.error("Asset optimization failed.");
  console.error(error);
  process.exitCode = 1;
});
