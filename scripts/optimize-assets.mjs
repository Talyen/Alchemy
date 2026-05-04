import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");
const sourceDir = path.join(rootDir, "Raw Art Assets");
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
  // Characters — Female
  { source: "Player Characters/Female Knight.png", target: "female-knight.webp", width: characterWidth, quality: 82 },
  { source: "Player Characters/Female Rogue.png", target: "female-rogue.webp", width: characterWidth, quality: 82 },
  { source: "Player Characters/Female Wizard.png", target: "female-wizard.webp", width: characterWidth, quality: 82 },
  // Characters — Male
  { source: "Player Characters/Male Knight.png", target: "male-knight.webp", width: characterWidth, quality: 82 },
  { source: "Player Characters/Male Rogue.png", target: "male-rogue.webp", width: characterWidth, quality: 82 },
  { source: "Player Characters/Male Wizard.png", target: "male-wizard.webp", width: characterWidth, quality: 82 },
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
  // Destinations
  { source: "Destinations/Campfire.png", target: "campfire.webp", width: 900, quality: 84 },
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
