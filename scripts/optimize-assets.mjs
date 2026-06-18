import { mkdir, readdir, stat } from "node:fs/promises";
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
  // Crafting
  { source: "Crafting/Ascension Seal.jpeg", target: "crafting-ascension-seal.webp", width: 420, quality: 82 },
  { source: "Crafting/Discordant Dice.jpeg", target: "crafting-discordant-dice.webp", width: 420, quality: 82 },
  { source: "Crafting/Severance Maw.jpeg", target: "crafting-severance-maw.webp", width: 420, quality: 82 },
  { source: "Crafting/Smith's Whetstone.jpeg", target: "crafting-smiths-whetstone.webp", width: 420, quality: 82 },
  { source: "Crafting/Sprig of Growth.jpeg", target: "crafting-sprig-of-growth.webp", width: 420, quality: 82 },
  { source: "Crafting/Voidstone.jpeg", target: "crafting-voidstone.webp", width: 420, quality: 82 },
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
  { source: "Player Characters/Ranger.jpeg", target: "ranger.webp", width: characterWidth, quality: 82 },
  { source: "Player Characters/Rogue.png", target: "rogue.webp", width: characterWidth, quality: 82 },
  { source: "Player Characters/Wizard.png", target: "wizard.webp", width: characterWidth, quality: 82 },
  { source: "Player Characters/Alchemist.jpeg", target: "alchemist.webp", width: characterWidth, quality: 82 },
  { source: "Player Characters/Warlock.jpeg", target: "warlock.webp", width: characterWidth, quality: 82 },
  { source: "Player Characters/Druid.jpeg", target: "druid.webp", width: characterWidth, quality: 82 },
  { source: "Player Characters/Wildcard.jpeg", target: "wildcard.webp", width: characterWidth, quality: 82 },
  {
    source: "Player Characters/Placeholder Class.png",
    target: "placeholder-class.webp",
    width: characterWidth,
    quality: 82,
  },
  // Cards
  { source: "Cards/Anvil.png", target: "anvil.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Apple.png", target: "apple.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Bash.png", target: "bash.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Blessed Aegis.jpeg", target: "blessed-aegis.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Block.png", target: "block.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Bread.png", target: "bread.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Cleanse.jpeg", target: "cleanse.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Fangs.png", target: "fangs.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Concussive Shot.jpeg", target: "concussive-shot.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Fire Arrow.jpeg", target: "fire-arrow.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Fireball.jpeg", target: "fireball.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Ice Shot.jpeg", target: "ice-shot.webp", width: cardWidth, quality: cardQuality },
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
  {
    source: "Cards/Lizard Scout Companion.png",
    target: "lizard-scout-companion.webp",
    width: cardWidth,
    quality: cardQuality,
  },
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
  { source: "Cards/Venom Arrow.jpeg", target: "venom-arrow.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Venom Fangs.jpeg", target: "venom-fangs.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Bloodthorn.jpeg", target: "bloodthorn.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Cinderbloom.jpeg", target: "cinderbloom.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Grasping Vines.jpeg", target: "grasping-vines.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Briar Shield.jpeg", target: "briar-shield.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Thorn Mail.jpeg", target: "thorn-mail.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Pack Tactics.jpeg", target: "pack-tactics.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Prayer.jpeg", target: "prayer.webp", width: cardWidth, quality: cardQuality },
  {
    source: "Cards/Frost Whelp Companion.jpeg",
    target: "frost-whelp-companion.webp",
    width: cardWidth,
    quality: cardQuality,
  },
  { source: "Cards/Bear Companion.jpeg", target: "bear-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Panther Companion.jpeg", target: "panther-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Phoenix Companion.jpeg", target: "phoenix-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Cold Snap.jpeg", target: "cold-snap.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Combustion.jpeg", target: "combustion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Faustian Bargain.jpeg", target: "faustian-bargain.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Judgment.jpeg", target: "judgment.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Lightning Arrow.jpeg", target: "lightning-arrow.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Mana Shield.jpeg", target: "mana-shield.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Sanctified Plate.jpeg", target: "sanctified-plate.webp", width: cardWidth, quality: cardQuality },
  {
    source: "Cards/Serrated Arrowhead.jpeg",
    target: "serrated-arrowhead.webp",
    width: cardWidth,
    quality: cardQuality,
  },
  { source: "Cards/Serrated Edge.jpeg", target: "serrated-edge.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Smelling Salts.jpeg", target: "smelling-salts.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Smite.jpeg", target: "smite.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Sunder Armor.jpeg", target: "sunder-armor.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Antivenom Potion.jpeg", target: "antivenom-potion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Blood Offering.jpeg", target: "blood-offering.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Gold.png", target: "gold.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Ray of Frost.jpeg", target: "ray-of-frost.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Tithe.jpeg", target: "tithe.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Exorcism.jpeg", target: "exorcism.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Kindling.jpeg", target: "kindling.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Roulette.jpeg", target: "roulette.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Lightning Bolt.jpeg", target: "lightning-bolt.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Dark Pact.jpeg", target: "dark-pact.webp", width: cardWidth, quality: cardQuality },
  {
    source: "Cards/Raise Skeleton.jpeg",
    target: "raise-skeleton-companion.webp",
    width: cardWidth,
    quality: cardQuality,
  },
  { source: "Cards/Pixie.jpeg", target: "pixie-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Mana Moth.jpeg", target: "mana-moth-companion.webp", width: cardWidth, quality: cardQuality },
  {
    source: "Cards/Golden Retriever.jpeg",
    target: "golden-retriever-companion.webp",
    width: cardWidth,
    quality: cardQuality,
  },
  {
    source: "Cards/Shield Scarab.jpeg",
    target: "shield-scarab-companion.webp",
    width: cardWidth,
    quality: cardQuality,
  },
  { source: "Cards/Library Owl.jpeg", target: "library-owl-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Will-o-Wisp.jpeg", target: "will-o-wisp-companion.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Bounty Shot.jpeg", target: "bounty-shot.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Crystal Bulwark.jpeg", target: "crystal-bulwark.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Gambler's Shot.jpeg", target: "gamblers-shot.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Glacial Ward.jpeg", target: "glacial-ward.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Golden Plate.jpeg", target: "golden-plate.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Hemorrhage.jpeg", target: "hemorrhage.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Molten Bulwark.jpeg", target: "molten-bulwark.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Phoenix Feather.jpeg", target: "phoenix-feather.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Sap Arrow.jpeg", target: "sap-arrow.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Spiked Shield.jpeg", target: "spiked-shield.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Wishing Well.jpeg", target: "wishing-well.webp", width: cardWidth, quality: cardQuality },
  { source: "Cards/Placeholder Card.png", target: "placeholder-card.webp", width: cardWidth, quality: 60 },
  // Boons (raw source folder retains its historical name)
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
  // Gear
  // Destinations
  { source: "Destinations/Campfire.jpeg", target: "campfire.webp", width: 900, quality: 84 },
  { source: "Destinations/Alchemist's Shop.jpeg", target: "alchemist-shop.webp", width: 900, quality: 84 },
  { source: "Destinations/Merchant's Shop.jpeg", target: "merchant-shop.webp", width: 900, quality: 84 },
  { source: "Destinations/Elite Enemy.jpeg", target: "elite-enemy.webp", width: 900, quality: 84 },
  { source: "Destinations/Normal Enemy.png", target: "normal-enemy.webp", width: 900, quality: 84 },
  { source: "Destinations/Mystery.jpeg", target: "mystery.webp", width: 900, quality: 84 },
  { source: "Destinations/Corruption Altar.jpeg", target: "corruption-altar.webp", width: 900, quality: 84 },
  { source: "Destinations/Boss Enemy.jpeg", target: "boss-combat.webp", width: 900, quality: 84 },
  {
    source: "Destinations/Placeholder Destination.png",
    target: "placeholder-destination.webp",
    width: 900,
    quality: 60,
  },
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
  {
    source: "Mystery Events/Field of Glowing Mana Berries.jpeg",
    target: "mystery-mana-berries.webp",
    width: 900,
    quality: 84,
  },
  {
    source: "Mystery Events/Pool of Water Steams.jpeg",
    target: "mystery-enchanted-spring.webp",
    width: 900,
    quality: 84,
  },
  {
    source: "Mystery Events/Bioluminescent Mushrooms.jpeg",
    target: "mystery-fungal-grotto.webp",
    width: 900,
    quality: 84,
  },
  { source: "Mystery Events/Oak Tree with Face.jpeg", target: "mystery-wisdom-tree.webp", width: 900, quality: 84 },
  {
    source: "Mystery Events/Circle of Glowing Mushrooms.jpeg",
    target: "mystery-fairy-ring.webp",
    width: 900,
    quality: 84,
  },
  {
    source: "Mystery Events/Weathered Stone Altar.jpeg",
    target: "mystery-ancient-altar.webp",
    width: 900,
    quality: 84,
  },
  {
    source: "Mystery Events/Leather Bundle Between Roots.jpeg",
    target: "mystery-hidden-cache.webp",
    width: 900,
    quality: 84,
  },
  {
    source: "Mystery Events/Vines Carpet Mosaic Floors.jpeg",
    target: "mystery-overgrown-temple.webp",
    width: 900,
    quality: 84,
  },
  {
    source: "Mystery Events/Dusty Shelves in Tower.jpeg",
    target: "mystery-abandoned-study.webp",
    width: 900,
    quality: 84,
  },
  {
    source: "Mystery Events/Leather Book Floats.jpeg",
    target: "mystery-mysterious-tome.webp",
    width: 900,
    quality: 84,
  },
  { source: "Mystery Events/Amethyst Geode.jpeg", target: "mystery-crystal-geode.webp", width: 900, quality: 84 },
  { source: "Mystery Events/Smoldering Crater.jpeg", target: "mystery-meteorite-crash.webp", width: 900, quality: 84 },
  {
    source: "Mystery Events/Gold Coins among Bones.jpeg",
    target: "mystery-forgotten-hoard.webp",
    width: 900,
    quality: 84,
  },
  {
    source: "Mystery Events/Sunlight Breaks Canopy.jpeg",
    target: "mystery-sacred-grove.webp",
    width: 900,
    quality: 84,
  },
  {
    source: "Mystery Events/Narrow Pass Through Peaks.jpeg",
    target: "mystery-mountain-pass.webp",
    width: 900,
    quality: 84,
  },
  {
    source: "Mystery Events/Pond Reflects Gnarled Trees.jpeg",
    target: "mystery-murky-pond.webp",
    width: 900,
    quality: 84,
  },
  { source: "Mystery Events/Placeholder Mystery.png", target: "placeholder-mystery.webp", width: 900, quality: 60 },
  // Difficulties
  { source: "Difficulties/Placeholder Difficulty.png", target: "placeholder-difficulty.webp", width: 720, quality: 60 },
  { source: "Difficulties/Difficulty 1.jpeg", target: "difficulty-1.webp", width: 720, quality: 82 },
  { source: "Difficulties/Difficulty 2.jpeg", target: "difficulty-2.webp", width: 720, quality: 82 },
  { source: "Difficulties/Difficulty 3.jpeg", target: "difficulty-3.webp", width: 720, quality: 82 },
  // Talent Backgrounds
  { source: "Talent Backgrounds/Physical.jpeg", target: "talent-bg-physical.webp", width: 1200, quality: 84 },
  { source: "Talent Backgrounds/Stun.jpeg", target: "talent-bg-stun.webp", width: 1200, quality: 84 },
  { source: "Talent Backgrounds/Forge.jpeg", target: "talent-bg-forge.webp", width: 1200, quality: 84 },
  { source: "Talent Backgrounds/Armor.jpeg", target: "talent-bg-armor.webp", width: 1200, quality: 84 },
  { source: "Talent Backgrounds/Burn.jpeg", target: "talent-bg-burn.webp", width: 1200, quality: 84 },
  { source: "Talent Backgrounds/Bleed.jpeg", target: "talent-bg-bleed.webp", width: 1200, quality: 84 },
  { source: "Talent Backgrounds/Freeze.jpeg", target: "talent-bg-freeze.webp", width: 1200, quality: 84 },
  { source: "Talent Backgrounds/Mana.jpeg", target: "talent-bg-mana.webp", width: 1200, quality: 84 },
  { source: "Talent Backgrounds/Leech.jpeg", target: "talent-bg-leech.webp", width: 1200, quality: 84 },
  { source: "Talent Backgrounds/Nature.jpeg", target: "talent-bg-nature.webp", width: 1200, quality: 84 },
  { source: "Talent Backgrounds/Companion.jpeg", target: "talent-bg-companion.webp", width: 1200, quality: 84 },
];

const gearAssetWidth = 420;
const gearAssetQuality = 82;

const GEAR_SLOT_IDS = [
  "body",
  "helm",
  "boots",
  "gloves",
  "belt",
  "main-hand",
  "off-hand",
  "amulet",
  "left-ring",
  "right-ring",
];

const GEAR_SLOT_BACKGROUND_NAME_TO_ID = {
  amulet: "amulet",
  belt: "belt",
  body: "body",
  boots: "boots",
  gloves: "gloves",
  helm: "helm",
  "left ring": "left-ring",
  "main hand": "main-hand",
  "off-hand": "off-hand",
  "right ring": "right-ring",
};

function slugifyGearName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function discoverGearAssets() {
  const gearDir = path.join(sourceDir, "Gear");
  let entries;
  try {
    entries = await readdir(gearDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const discovered = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(/^(.+?)\s-\s(Basic|Astral)\.(jpe?g|png)$/i);
    if (!match) {
      if (!entry.name.toLowerCase().includes("placeholder")) {
        console.warn(`[gear] Skipping malformed gear file: ${entry.name}`);
      }
      continue;
    }
    const [, displayName, rarity] = match;
    discovered.push({
      source: `Gear/${entry.name}`,
      target: `gear-${slugifyGearName(displayName)}-${rarity.toLowerCase()}.webp`,
      width: gearAssetWidth,
      quality: gearAssetQuality,
    });
  }
  return discovered;
}

async function discoverGearSlotBackgrounds() {
  const slotDir = path.join(sourceDir, "Gear", "Gear Slot Backgrounds");
  let entries;
  try {
    entries = await readdir(slotDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const discovered = [];
  const foundSlotIds = new Set();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(/^(.+?)\sSlot\.(jpe?g|png)$/i);
    if (!match) {
      console.warn(`[gear-slot] Skipping malformed slot background file: ${entry.name}`);
      continue;
    }
    const displayName = match[1].trim().toLowerCase();
    const slotId = GEAR_SLOT_BACKGROUND_NAME_TO_ID[displayName];
    if (!slotId) {
      console.warn(`[gear-slot] Unknown slot background name: ${match[1]}`);
      continue;
    }
    foundSlotIds.add(slotId);
    discovered.push({
      source: `Gear/Gear Slot Backgrounds/${entry.name}`,
      target: `gear-slot-${slotId}.webp`,
      width: gearAssetWidth,
      quality: gearAssetQuality,
    });
  }

  for (const slotId of GEAR_SLOT_IDS) {
    if (!foundSlotIds.has(slotId)) {
      console.warn(`[gear-slot] Missing background art for slot: ${slotId}`);
    }
  }

  return discovered;
}

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

  try {
    await stat(sourcePath);
  } catch {
    return `${target} skipped (missing source)`;
  }

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

  const gearAssets = await discoverGearAssets();
  const gearSlotBackgrounds = await discoverGearSlotBackgrounds();
  const allAssets = [...assets, ...gearAssets, ...gearSlotBackgrounds];

  const results = [];
  for (const asset of allAssets) {
    results.push(await optimizeAsset(asset));
  }

  console.log(
    `Optimized ${results.length} art assets (${gearAssets.length} gear, ${gearSlotBackgrounds.length} gear slot backgrounds).`,
  );
}

main().catch((error) => {
  console.error("Asset optimization failed.");
  console.error(error);
  process.exitCode = 1;
});
