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
  { source: "Misc/pointer_c_shaded.png", target: "pointer-c-shaded.webp", width: 26, quality: 90 },
  // Enemies
  { source: "Enemies/Skeleton.png", target: "skeleton.webp", width: 720, quality: 82 },
  { source: "Enemies/Goblin.jpeg", target: "goblin.webp", width: 720, quality: 82 },
  { source: "Enemies/Imp.png", target: "imp.webp", width: 720, quality: 82 },
  { source: "Enemies/Lizard Scout.png", target: "lizard-scout.webp", width: 720, quality: 82 },
  { source: "Enemies/Mimic.png", target: "mimic.webp", width: 720, quality: 82 },
  { source: "Enemies/Mud Elemental.png", target: "mud-elemental.webp", width: 720, quality: 82 },
  { source: "Enemies/Necromancer.jpeg", target: "necromancer.webp", width: 720, quality: 82 },
  { source: "Enemies/Plague Doctor.jpeg", target: "plague-doctor.webp", width: 720, quality: 82 },
  { source: "Enemies/The Frostwarden.jpeg", target: "the-frostwarden.webp", width: 720, quality: 82 },
  { source: "Enemies/The Forge Golem.jpeg", target: "the-forge-golem.webp", width: 720, quality: 82 },
  { source: "Enemies/The Blight Treant.jpeg", target: "the-blight-treant.webp", width: 720, quality: 82 },
  { source: "Enemies/Living Armor.jpeg", target: "living-armor.webp", width: 720, quality: 82 },
  { source: "Enemies/The Iron Bear.jpeg", target: "iron-bear.webp", width: 720, quality: 82 },
  { source: "Enemies/Placeholder Enemy.png", target: "placeholder-enemy.webp", width: 720, quality: 60 },
  // Characters
  { source: "Player Characters/Knight.png", target: "knight.webp", width: characterWidth, quality: 82 },
  { source: "Player Characters/Ranger.png", target: "ranger.webp", width: characterWidth, quality: 82 },
  { source: "Player Characters/Rogue.png", target: "rogue.webp", width: characterWidth, quality: 82 },
  { source: "Player Characters/Wizard.png", target: "wizard.webp", width: characterWidth, quality: 82 },
  // Cards
  { source: "Cards/Anvil.png", target: "anvil.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Apple.png", target: "apple.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Bash.png", target: "bash.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Blessed Aegis.jpeg", target: "blessed-aegis.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Block.png", target: "block.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Bread.png", target: "bread.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Cleanse.jpeg", target: "cleanse.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Fangs.png", target: "fangs.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Fireball.jpeg", target: "fireball.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Frostbolt.jpeg", target: "frostbolt.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Haste.jpeg", target: "haste.webp", width: cardWidth, quality: 88 },
  { source: "Cards/Heal.jpeg", target: "heal.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Health Potion.png", target: "health-potion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Mana Berries.png", target: "mana-berries.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Mana Crystals.jpeg", target: "mana-crystal.webp", width: cardWidth, quality: 88 },
  { source: "Cards/Mana Potion.png", target: "mana-potion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Meteor.jpeg", target: "meteor.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Panacea Potion.png", target: "panacea-potion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Plate Mail.png", target: "plate-mail.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Poison Dagger.jpeg", target: "poison-dagger.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Slash.png", target: "slash.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Stab.png", target: "stab.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Steal.jpeg", target: "steal.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Wish.jpeg", target: "wish.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Wolf Companion.jpeg", target: "wolf-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Lizard Scout Companion.png", target: "lizard-scout-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Imp Companion.png", target: "imp-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Mixed Potion.jpeg", target: "mixed-potion.webp", width: cardWidth, quality: 84 },
  { source: "Cards/Stoneskin Potion.jpeg", target: "stoneskin-potion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Acid Potion.jpeg", target: "acid-potion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Luck Potion.jpeg", target: "luck-potion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Wishing Potion.jpeg", target: "wishing-potion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Shield Bash.jpeg", target: "shield-bash.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Burning Blade.jpeg", target: "burning-blade.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Cauterize.jpeg", target: "cauterize.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Blackjack.jpeg", target: "blackjack.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Sunburst.png", target: "sunburst.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Holy Radiance.jpeg", target: "holy-radiance.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Venom Fangs.jpeg", target: "venom-fangs.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Bloodthorn.jpeg", target: "bloodthorn.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Cinderbloom.jpeg", target: "cinderbloom.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Grasping Vines.jpeg", target: "grasping-vines.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Briar Shield.jpeg", target: "briar-shield.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Thorn Mail.jpeg", target: "thorn-mail.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Pack Tactics.jpeg", target: "pack-tactics.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Prayer.jpeg", target: "prayer.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Frost Whelp Companion.jpeg", target: "frost-whelp-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Bear Companion.jpeg", target: "bear-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Panther Companion.jpeg", target: "panther-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Phoenix Companion.jpeg", target: "phoenix-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Cold Snap.jpeg", target: "cold-snap.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Combustion.jpeg", target: "combustion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Faustian Bargain.jpeg", target: "faustian-bargain.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Judgment.jpeg", target: "judgment.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Mana Shield.jpeg", target: "mana-shield.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Serrated Edge.jpeg", target: "serrated-edge.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Smelling Salts.jpeg", target: "smelling-salts.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Smite.jpeg", target: "smite.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Sunder Armor.jpeg", target: "sunder-armor.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Antivenom Potion.jpeg", target: "antivenom-potion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Blood Offering.jpeg", target: "blood-offering.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Gold.png", target: "gold.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Ray of Frost.jpeg", target: "ray-of-frost.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Placeholder Card.png", target: "placeholder-card.webp", width: cardWidth, quality: 60 },
  // Trinkets
  { source: "Trinkets/Bone Charm.jpeg", target: "bone-charm.webp", width: 420, quality: 82 },
  { source: "Trinkets/Brass Censer.jpeg", target: "brass-censer.webp", width: 420, quality: 82 },
  { source: "Trinkets/Companion's Collar.jpeg", target: "companions-collar.webp", width: 420, quality: 82 },
  { source: "Trinkets/Cutpurse Knife.jpeg", target: "cutpurse-knife.webp", width: 420, quality: 82 },
  { source: "Trinkets/Icy Heart.jpeg", target: "icy-heart.webp", width: 420, quality: 82 },
  { source: "Trinkets/Grove's Favor.jpeg", target: "groves-favor.webp", width: 420, quality: 82 },
  { source: "Trinkets/Ironwood Buckler.jpeg", target: "ironwood-buckler.webp", width: 420, quality: 82 },
  { source: "Trinkets/Lucky Clover.jpeg", target: "lucky-clover.webp", width: 420, quality: 82 },
  { source: "Trinkets/Merchant's Favor.jpeg", target: "merchants-favor.webp", width: 420, quality: 82 },
  { source: "Trinkets/Meteorite.jpeg", target: "meteorite.webp", width: 420, quality: 82 },
  { source: "Trinkets/Mortar and Pestle.jpeg", target: "mortar-and-pestle.webp", width: 420, quality: 82 },
  { source: "Trinkets/Obsidian Hammer.jpeg", target: "obsidian-hammer.webp", width: 420, quality: 82 },
  { source: "Trinkets/Parasitic Bloom.jpeg", target: "parasitic-bloom.webp", width: 420, quality: 82 },
  { source: "Trinkets/Placeholder Trinket.png", target: "placeholder-trinket.webp", width: 420, quality: 60 },
  { source: "Trinkets/Plague Doctor's Mask.jpeg", target: "plague-doctors-mask.webp", width: 420, quality: 82 },
  { source: "Trinkets/Frozen Pocketwatch.jpeg", target: "frozen-pocketwatch.webp", width: 420, quality: 82 },
  { source: "Trinkets/Resonant Chimes.jpeg", target: "resonant-chimes.webp", width: 420, quality: 82 },
  { source: "Trinkets/Runic Quill.jpeg", target: "runic-quill.webp", width: 420, quality: 82 },
  { source: "Trinkets/Sin-Eater's Lantern.jpeg", target: "sin-eaters-lantern.webp", width: 420, quality: 82 },
  { source: "Trinkets/Smuggler's Map.jpeg", target: "smugglers-map.webp", width: 420, quality: 82 },
  { source: "Trinkets/Sundering Charm.jpeg", target: "sundering-charm.webp", width: 420, quality: 82 },
  { source: "Trinkets/Tattered Pages.jpeg", target: "tattered-pages.webp", width: 420, quality: 82 },
  { source: "Trinkets/Thunderstone.jpeg", target: "thunderstone.webp", width: 420, quality: 82 },
  { source: "Trinkets/Vanguard's Crest.jpeg", target: "vanguards-crest.webp", width: 420, quality: 82 },
  { source: "Trinkets/Wishing Well Coin.jpeg", target: "wishing-well-coin.webp", width: 420, quality: 82 },
  // Destinations
  { source: "Destinations/Campfire.jpeg", target: "campfire.webp", width: 900, quality: 84 },
  { source: "Destinations/Alchemist's Shop.jpeg", target: "alchemist-shop.webp", width: 900, quality: 84 },
  { source: "Destinations/Merchant's Shop.jpeg", target: "merchant-shop.webp", width: 900, quality: 84 },
  { source: "Destinations/Elite Enemy.jpeg", target: "elite-enemy.webp", width: 900, quality: 84 },
  { source: "Destinations/Normal Enemy.png", target: "normal-enemy.webp", width: 900, quality: 84 },
  { source: "Destinations/Mystery.jpeg", target: "mystery.webp", width: 900, quality: 84 },
  { source: "Destinations/Corruption Altar.jpeg", target: "corruption-altar.webp", width: 900, quality: 84 },
  { source: "Destinations/Placeholder Destination.png", target: "placeholder-destination.webp", width: 900, quality: 60 },
  // Game Modes
  { source: "Game Modes/The Campaign.jpeg", target: "the-campaign.webp", width: 900, quality: 82 },
  { source: "Game Modes/The Labyrinth.jpeg", target: "the-labyrinth.webp", width: 900, quality: 82 },
  { source: "Game Modes/The Wildwoods.jpeg", target: "the-wildwoods.webp", width: 900, quality: 82 },
  { source: "Game Modes/Placeholder Game Mode.png", target: "placeholder-game-mode.webp", width: 900, quality: 60 },
  // Homestead
  { source: "Homestead/Wheat Field.jpeg", target: "wheat-field.webp", width: 900, quality: 82 },
  { source: "Homestead/Orchard.jpeg", target: "orchard.webp", width: 900, quality: 82 },
  { source: "Homestead/Herb Garden.jpeg", target: "herb-garden.webp", width: 900, quality: 82 },
  { source: "Homestead/Hunter's Lodge.jpeg", target: "hunters-lodge.webp", width: 900, quality: 82 },
  { source: "Homestead/Alchemy Lab.jpeg", target: "alchemy-lab.webp", width: 900, quality: 82 },
  { source: "Homestead/Crystal Garden.jpeg", target: "crystal-garden.webp", width: 900, quality: 82 },
  { source: "Homestead/Blacksmith's Forge.jpeg", target: "blacksmiths-forge.webp", width: 900, quality: 82 },
  { source: "Homestead/Chicken Coop.jpeg", target: "chicken-coop.webp", width: 900, quality: 82 },
  { source: "Homestead/Pasture.jpeg", target: "pasture.webp", width: 900, quality: 82 },
  { source: "Homestead/Placeholder Homestead.png", target: "placeholder-homestead.webp", width: 900, quality: 60 },
  { source: "Mystery Events/Placeholder Mystery.png", target: "placeholder-mystery.webp", width: 900, quality: 60 },
  // Difficulties
  { source: "Difficulties/Placeholder Difficulty.png", target: "placeholder-difficulty.webp", width: 720, quality: 60 },
  { source: "Difficulties/Difficulty 1.jpeg", target: "difficulty-1.webp", width: 720, quality: 82 },
  { source: "Difficulties/Difficulty 2.jpeg", target: "difficulty-2.webp", width: 720, quality: 82 },
  { source: "Difficulties/Difficulty 3.jpeg", target: "difficulty-3.webp", width: 720, quality: 82 },
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
