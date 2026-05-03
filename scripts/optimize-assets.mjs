import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");
const sourceDir = path.join(rootDir, "Raw Art Assets");
const outputDir = path.join(rootDir, "src", "assets", "optimized");

const assets = [
  { source: "Alchemy Logo.png", target: "alchemy-logo.webp", width: 1200, quality: 84 },
  { source: "Knight.png", target: "knight.webp", width: 720, quality: 82 },
  { source: "Skeleton.png", target: "skeleton.webp", width: 720, quality: 82 },
  { source: "Goblin.png", target: "goblin.webp", width: 720, quality: 82 },
  { source: "Imp.png", target: "imp.webp", width: 720, quality: 82 },
  { source: "Lizard Scout.png", target: "lizard-scout.webp", width: 720, quality: 82 },
  { source: "Mimic.png", target: "mimic.webp", width: 720, quality: 82 },
  { source: "Mud Elemental.png", target: "mud-elemental.webp", width: 720, quality: 82 },
  { source: "Necromancer.png", target: "necromancer.webp", width: 720, quality: 82 },
  { source: "Plague Doctor.png", target: "plague-doctor.webp", width: 720, quality: 82 },
  { source: "Card Back.png", target: "card-back.webp", width: 420, quality: 82 },
  { source: "Mana Crystal.png", target: "mana-crystal.webp", width: 120, quality: 88 },
  { source: "Anvil.png", target: "anvil.webp", width: 420, quality: 80 },
  { source: "Apple.png", target: "apple.webp", width: 420, quality: 80 },
  { source: "Bash.png", target: "bash.webp", width: 420, quality: 80 },
  { source: "Blessed Aegis.png", target: "blessed-aegis.webp", width: 420, quality: 80 },
  { source: "Block.png", target: "block.webp", width: 420, quality: 80 },
  { source: "Bread.png", target: "bread.webp", width: 420, quality: 80 },
  { source: "Cleanse.png", target: "cleanse.webp", width: 420, quality: 80 },
  { source: "Fangs.png", target: "fangs.webp", width: 420, quality: 80 },
  { source: "Fireball.png", target: "fireball.webp", width: 420, quality: 80 },
  { source: "Frostbolt.png", target: "frostbolt.webp", width: 420, quality: 80 },
  { source: "Haste.png", target: "haste.webp", width: 420, quality: 80 },
  { source: "Heal.png", target: "heal.webp", width: 420, quality: 80 },
  { source: "Health Potion.png", target: "health-potion.webp", width: 420, quality: 80 },
  { source: "Mana Berries.png", target: "mana-berries.webp", width: 420, quality: 80 },
  { source: "Mana Potion.png", target: "mana-potion.webp", width: 420, quality: 80 },
  { source: "Meteor.png", target: "meteor.webp", width: 420, quality: 80 },
  { source: "Panacea Potion.png", target: "panacea-potion.webp", width: 420, quality: 80 },
  { source: "Plate Mail.png", target: "plate-mail.webp", width: 420, quality: 80 },
  { source: "Poison Dagger.png", target: "poison-dagger.webp", width: 420, quality: 80 },
  { source: "Slash.png", target: "slash.webp", width: 420, quality: 80 },
  { source: "Stab.png", target: "stab.webp", width: 420, quality: 80 },
  { source: "Steal.png", target: "steal.webp", width: 420, quality: 80 },
  { source: "Wish.png", target: "wish.webp", width: 420, quality: 80 },
  { source: "Gold.png", target: "gold.webp", width: 420, quality: 80 },
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
