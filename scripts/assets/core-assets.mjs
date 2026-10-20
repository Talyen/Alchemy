import { ART_PRESETS } from "./asset-constants.mjs";
import { artGroup } from "./art-group.mjs";

export const coreAssets = [
  ...artGroup(
    {
      folder: "Interface/Mana Dock",
      preset: ART_PRESETS.manaDockCrystal,
      requiresTransparency: true,
    },
    [
      ["Crystal - Octagonal Full.png", "mana-dock-full.webp"],
      ["Crystal - Octagonal Empty.png", "mana-dock-empty.webp"],
    ],
  ),
  {
    source: "2d Assets/Game Sources/Interface/Mana Dock/Frame - Charcoal and Gold Stitched Leather.png",
    target: "mana-dock-frame.webp",
    ...ART_PRESETS.manaDock,
    requiresTransparency: true,
  },
  // Logo and marketing
  {
    source: "2d Assets/Game Sources/Branding/Logos/Alchemy Logo/Alchemy Logo - 2400x1792.png",
    target: "alchemy-logo.webp",
    ...ART_PRESETS.logo,
  },
  {
    source: "2d Assets/Game Sources/Branding/Marketing/Unlock Full Game Demo Promo.jpg",
    target: "demo-feature-showcase.webp",
    ...ART_PRESETS.marketing,
  },
  ...artGroup({ folder: "Branding/Marketing", preset: ART_PRESETS.marketing }, [
    ["Unlock Full Game Demo Promo - de.png", "demo-feature-showcase-de.webp"],
    ["Unlock Full Game Demo Promo - zh-Hans.png", "demo-feature-showcase-zh-hans.webp"],
    ["Unlock Full Game Demo Promo - ru.png", "demo-feature-showcase-ru.webp"],
    ["Unlock Full Game Demo Promo - es.png", "demo-feature-showcase-es.webp"],
    ["Unlock Full Game Demo Promo - pt-BR.png", "demo-feature-showcase-pt-br.webp"],
  ]),
  // Piles share the boon quality (82): flat graphic fields band at card quality (80).
  ...artGroup(
    {
      folder: "Interface/Card Elements",
      preset: { ...ART_PRESETS.card, quality: ART_PRESETS.boon.quality },
      requiresTransparency: true,
    },
    [
      ["Draw Pile.png", "draw-pile.webp"],
      ["Discard Pile.png", "discard-pile.webp"],
      ["Card Back.png", "card-back.webp"],
    ],
  ),
  {
    source: "2d Assets/Game Sources/Interface/Cursors/Pointer - Shaded.png",
    target: "pointer-c-shaded.webp",
    ...ART_PRESETS.cursor,
  },
  // Crafting
  ...artGroup({ folder: "Items/Crafting", preset: ART_PRESETS.crafting }, [
    ["Salvage - Illustrated.png", "armory-salvage.webp"],
    ["Ascension Seal/Ascension Seal - Illustrated.png", "crafting-ascension-seal.webp"],
    ["Discordant Dice/Discordant Dice - Illustrated.png", "crafting-discordant-dice.webp"],
    ["Severance Maw/Severance Maw - Illustrated.png", "crafting-severance-maw.webp"],
    ["Smith's Whetstone/Smith's Whetstone - Illustrated.png", "crafting-smiths-whetstone.webp"],
    ["Sprig of Growth/Sprig of Growth - Illustrated.png", "crafting-sprig-of-growth.webp"],
    ["Voidstone/Voidstone - Illustrated.png", "crafting-voidstone.webp"],
  ]),
  // Enemies
  ...artGroup({ folder: "Characters", preset: ART_PRESETS.enemy }, [
    ["Enemies/Skeleton.jpeg", "skeleton.webp"],
    ["Enemies/Goblin.jpeg", "goblin.webp"],
    ["Enemies/Mimic.jpeg", "mimic.webp"],
    ["Enemies/Mud Elemental.jpeg", "mud-elemental.webp"],
    ["Enemies/Necromancer.jpeg", "necromancer.webp"],
    ["Enemies/Plague Doctor.jpeg", "plague-doctor.webp"],
    ["Bosses/The Frostwarden.jpeg", "the-frostwarden.webp"],
    ["Bosses/The Forge Golem.jpeg", "the-forge-golem.webp"],
    ["Bosses/The Blight Treant.jpeg", "the-blight-treant.webp"],
    ["Enemies/Living Armor.jpeg", "living-armor.webp"],
    ["Bosses/The Iron Bear.jpeg", "iron-bear.webp"],
    ["Enemies/Fire Elemental.jpeg", "fire-elemental.webp"],
    ["Enemies/Frost Elemental.jpeg", "frost-elemental.webp"],
    ["Enemies/Slime.jpeg", "slime.webp"],
    ["Enemies/Will-o-Wisp/Will-o-Wisp - 1200x896.jpeg", "will-o-wisp.webp"],
    ["Enemies/Bandit.jpeg", "bandit.webp"],
    ["Enemies/Ogre.jpeg", "ogre.webp"],
    ["Enemies/Fire Imp.jpeg", "fire-imp.webp"],
    ["Enemies/Hellhound.jpeg", "hellhound.webp"],
    ["Enemies/Pyromancer.jpeg", "pyromancer.webp"],
    ["Enemies/Giant Spider.jpeg", "giant-spider.webp"],
    ["Enemies/Giant Snake.jpeg", "giant-snake.webp"],
    ["Enemies/Blood Cultist.jpeg", "blood-cultist.webp"],
    ["Enemies/Dire Wolf.jpeg", "dire-wolf.webp"],
    ["Enemies/Vampire.jpeg", "vampire.webp"],
    ["Bosses/The Blood Countess.jpeg", "the-blood-countess.webp"],
    ["Enemies/Zealot.jpeg", "zealot.webp"],
    ["Enemies/Cleric.jpeg", "cleric.webp"],
    ["Enemies/Inquisitor.jpeg", "inquisitor.webp"],
    ["Enemies/Paladin.jpeg", "paladin.webp"],
    ["Bosses/The Seraph.jpeg", "the-seraph.webp"],
    ["Enemies/Winter Wolf.jpeg", "winter-wolf.webp"],
    ["Enemies/Ice Wraith.jpeg", "ice-wraith.webp"],
    ["Enemies/Yeti.jpeg", "yeti.webp"],
    ["Enemies/Banshee.jpeg", "banshee.webp"],
    ["Enemies/Brawler/Brawler - Facing Left.jpeg", "brawler.webp"],
    ["Enemies/Stone Golem.jpeg", "stone-golem.webp"],
    ["Enemies/Earth Elemental.jpeg", "earth-elemental.webp"],
    ["Bosses/The Stone Titan/The Stone Titan - Facing Left.jpeg", "the-stone-titan.webp"],
  ]),
  {
    source: "2d Assets/Game Sources/Interface/Placeholders/Placeholder.png",
    target: "placeholder-enemy.webp",
    ...ART_PRESETS.enemyPlaceholder,
  },
  // Heroes
  ...artGroup({ folder: "Characters/Heroes", preset: ART_PRESETS.hero }, [
    ["Knight.jpeg", "knight.webp"],
    ["Ranger.jpeg", "ranger.webp"],
    ["Rogue.jpeg", "rogue.webp"],
    ["Wizard.jpeg", "wizard.webp"],
    ["Alchemist.jpeg", "alchemist.webp"],
    ["Warlock.jpeg", "warlock.webp"],
    ["Druid.jpeg", "druid.webp"],
    ["Wildcard.jpeg", "wildcard.webp"],
  ]),
];
