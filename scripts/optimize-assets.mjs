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
  { source: "Logo/Alchemy Logo Arcane Mana.png", target: "alchemy-logo-arcane-mana.webp", width: 1200, quality: 84 },
  { source: "Logo/Alchemy Logo Fire Iron.png", target: "alchemy-logo-fire-iron.webp", width: 1200, quality: 84 },
  { source: "Logo/Alchemy Logo Frost.png", target: "alchemy-logo-frost.webp", width: 1200, quality: 84 },
  { source: "Logo/Alchemy Logo Holy Block.png", target: "alchemy-logo-holy-block.webp", width: 1200, quality: 84 },
  { source: "Logo/Alchemy Logo Nature Bleed.png", target: "alchemy-logo-nature-bleed.webp", width: 1200, quality: 84 },
  { source: "Logo/Alchemy Logo Poison.png", target: "alchemy-logo-poison.webp", width: 1200, quality: 84 },
  // Misc
  { source: "Misc/Draw Pile.png", target: "draw-pile.webp", width: 420, quality: 82 },
  { source: "Misc/Discard Pile.png", target: "discard-pile.webp", width: 420, quality: 82 },
  { source: "Misc/Card Back.png", target: "card-back.webp", width: 420, quality: 82 },
  // Enemies
  { source: "Enemies/Skeleton.png", target: "skeleton.webp", width: 720, quality: 82 },
  { source: "Enemies/Goblin.png", target: "goblin.webp", width: 720, quality: 82 },
  { source: "Enemies/Imp.png", target: "imp.webp", width: 720, quality: 82 },
  { source: "Enemies/Lizard Scout.png", target: "lizard-scout.webp", width: 720, quality: 82 },
  { source: "Enemies/Mimic.png", target: "mimic.webp", width: 720, quality: 82 },
  { source: "Enemies/Mud Elemental.png", target: "mud-elemental.webp", width: 720, quality: 82 },
  { source: "Enemies/Necromancer.png", target: "necromancer.webp", width: 720, quality: 82 },
  { source: "Enemies/Plague Doctor.png", target: "plague-doctor.webp", width: 720, quality: 82 },
  { source: "Enemies/The Frostwarden.png", target: "the-frostwarden.webp", width: 720, quality: 82 },
  { source: "Enemies/The Forge Golem.png", target: "the-forge-golem.webp", width: 720, quality: 82 },
  { source: "Enemies/The Blight Treant.png", target: "the-blight-treant.webp", width: 720, quality: 82 },
  { source: "Enemies/Living Armor.png", target: "living-armor.webp", width: 720, quality: 82 },
  { source: "Enemies/The Iron Bear.png", target: "iron-bear.webp", width: 720, quality: 82 },
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
  { source: "Cards/Stoneskin Potion.png", target: "stoneskin-potion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Acid Potion.png", target: "acid-potion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Luck Potion.png", target: "luck-potion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Wishing Potion.png", target: "wishing-potion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Shield Bash.png", target: "shield-bash.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Burning Blade.png", target: "burning-blade.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Cauterize.png", target: "cauterize.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Blackjack.png", target: "blackjack.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Sunburst.png", target: "sunburst.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Holy Radiance.png", target: "holy-radiance.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Venom Fangs.png", target: "venom-fangs.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Bloodthorn.png", target: "bloodthorn.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Cinderbloom.png", target: "cinderbloom.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Grasping Vines.png", target: "grasping-vines.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Briar Shield.png", target: "briar-shield.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Thorn Mail.png", target: "thorn-mail.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Pack Tactics.png", target: "pack-tactics.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Frost Whelp Companion.png", target: "frost-whelp-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Bear Companion.png", target: "bear-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Panther Companion.png", target: "panther-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Phoenix Companion.png", target: "phoenix-companion.webp", width: cardWidth, quality: cardQuality },
  // Destinations
  { source: "Destinations/Campfire.png", target: "campfire.webp", width: 900, quality: 84 },
  { source: "Destinations/Alchemist's Shop.png", target: "alchemist-shop.webp", width: 900, quality: 84 },
  { source: "Destinations/Merchant's Shop.png", target: "merchant-shop.webp", width: 900, quality: 84 },
  { source: "Destinations/Elite Enemy.png", target: "elite-enemy.webp", width: 900, quality: 84 },
  { source: "Destinations/Normal Enemy.png", target: "normal-enemy.webp", width: 900, quality: 84 },
  { source: "Destinations/Mystery.png", target: "mystery.webp", width: 900, quality: 84 },
  { source: "Destinations/Corruption Altar.png", target: "corruption-altar.webp", width: 900, quality: 84 },
  // Game Modes
  { source: "Game Modes/The Campaign.png", target: "the-campaign.webp", width: 900, quality: 82 },
  { source: "Game Modes/The Labyrinth.png", target: "the-labyrinth.webp", width: 900, quality: 82 },
  { source: "Game Modes/The Wildwoods.png", target: "the-wildwoods.webp", width: 900, quality: 82 },
  // Homestead
  { source: "Homestead/Wheat Field.png", target: "wheat-field.webp", width: 900, quality: 82 },
  { source: "Homestead/Orchard.png", target: "orchard.webp", width: 900, quality: 82 },
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
