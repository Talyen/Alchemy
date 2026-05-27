// Declarative mystery event pool for campaign route nodes.
import { mysteryEventArt, type KeywordId } from "@/lib/game-data";
import type { MaterialId } from "@/lib/homestead/types";

import type { MysteryEffect, MysteryEvent } from "./mystery-event-types";

const art = (eventId: string): string => mysteryEventArt[eventId] ?? "";

const xp = (keyword: KeywordId, amount = 8): MysteryEffect => ({ kind: "gainXP", keyword, amount });
const mat = (material: MaterialId, amount: number): MysteryEffect => ({ kind: "gainMaterial", material, amount });

export const mysteryPool: MysteryEvent[] = [
  {
    id: "mana-berries",
    title: "Mana Berries",
    art: art("mana-berries"),
    narrative:
      "You stumble upon a lush field of glowing Mana Berries. Their faint blue radiance pulses gently, promising restored mana.",
    choices: [
      {
        label: "Harvest",
        description: "Add Mana Berries to your deck",
        effects: [{ kind: "addCard", cardId: "mana-berries" }, mat("herbs", 2)],
      },
      {
        label: "Study the Glow",
        description: "Gain 8 Mana XP",
        effects: [xp("mana")],
      },
    ],
  },
  {
    id: "enchanted-spring",
    title: "Enchanted Spring",
    art: art("enchanted-spring"),
    narrative:
      "A pool of iridescent water steams gently in the cool air. Its surface shimmers with an inviting warmth, promising restoration.",
    choices: [
      {
        label: "Bathe in the Spring",
        description: "Restore 12 Health",
        effects: [{ kind: "healHealth", amount: 12 }, mat("herbs", 2)],
      },
      {
        label: "Bottle the Essence",
        description: "Add Health Potion to your deck",
        effects: [{ kind: "addCard", cardId: "health-potion" }],
      },
    ],
  },
  {
    id: "fungal-grotto",
    title: "Fungal Grotto",
    art: art("fungal-grotto"),
    narrative:
      "Bioluminescent mushrooms pulse in the dark, their spores hanging thick in the air. The cave walls glitter with an otherworldly light.",
    choices: [
      {
        label: "Harvest Carefully",
        description: "Add Mana Berries to your deck",
        effects: [{ kind: "addCard", cardId: "mana-berries" }, mat("herbs", 4)],
      },
      {
        label: "Inhale the Spores",
        description: "Gain 8 Mana XP",
        effects: [xp("mana")],
      },
    ],
  },
  {
    id: "wisdom-tree",
    title: "Wisdom Tree",
    art: art("wisdom-tree"),
    narrative:
      "An immense oak with a weathered face carved into its bark speaks in rustling leaves. Ancient wisdom emanates from its gnarled branches.",
    choices: [
      {
        label: "Ask for Knowledge",
        description: "Gain 8 Nature XP",
        effects: [xp("nature")],
      },
      {
        label: "Rest in its Shade",
        description: "Restore 15 Health",
        effects: [{ kind: "healHealth", amount: 15 }, mat("herbs", 2)],
      },
    ],
  },
  {
    id: "fairy-ring",
    title: "Fairy Ring",
    art: art("fairy-ring"),
    narrative:
      "A circle of glowing mushrooms hums with fey energy in a moonlit clearing. The air feels thick with mischief and ancient magic.",
    choices: [
      {
        label: "Leave an Offering",
        description: "Remove a Card (Choose)",
        effects: [{ kind: "removeCard", mode: "choose" }],
      },
      {
        label: "Make a Wish",
        description: "Add Wish to your deck",
        effects: [{ kind: "addCard", cardId: "wish" }],
      },
    ],
  },
  {
    id: "ancient-altar",
    title: "Ancient Altar",
    art: art("ancient-altar"),
    narrative:
      "A weathered stone altar stands beneath a shaft of light piercing the canopy. A rusted offering bowl rests before it, etched with forgotten symbols.",
    choices: [
      {
        label: "Pray",
        description: "Gain 8 Holy XP",
        effects: [xp("holy")],
      },
      {
        label: "Make an Offering",
        description: "Remove a Card (Choose)",
        effects: [{ kind: "removeCard", mode: "choose" }],
      },
    ],
  },
  {
    id: "hidden-cache",
    title: "Hidden Cache",
    art: art("hidden-cache"),
    narrative:
      "A leather-wrapped bundle tucked between exposed roots catches your eye. Whatever is inside has been hidden here for a long time.",
    choices: [
      {
        label: "Take Everything",
        description: "Gain 20 Gold and add Steal to your deck",
        effects: [
          { kind: "gainGold", amount: 20 },
          { kind: "addCard", cardId: "steal" },
        ],
      },
      {
        label: "Study the Map",
        description: "Gain Smuggler's Map trinket",
        effects: [{ kind: "gainTrinket", trinketId: "smugglers-map" }],
      },
    ],
  },
  {
    id: "overgrown-temple",
    title: "Overgrown Temple",
    art: art("overgrown-temple"),
    narrative:
      "Vines carpet ancient mosaic floors. A faint glow pulses from a cracked sarcophagus in the chamber beyond, hinting at preserved treasures.",
    choices: [
      {
        label: "Explore the Crypt",
        description: "Gain a random trinket",
        effects: [{ kind: "gainRandomTrinket" }],
      },
      {
        label: "Decipher the Inscriptions",
        description: "Gain 8 Nature XP",
        effects: [xp("nature")],
      },
    ],
  },
  {
    id: "abandoned-study",
    title: "Abandoned Study",
    art: art("abandoned-study"),
    narrative:
      "Dusty shelves line a circular tower room. A half-written thesis lies open on the desk, quill dried beside it centuries ago.",
    choices: [
      {
        label: "Search the Scrolls",
        description: "Choose 1 of 3 random cards to add to your deck",
        effects: [{ kind: "chooseCard" }],
      },
      {
        label: "Organize the Library",
        description: "Gain 8 Mana XP",
        effects: [xp("mana")],
      },
    ],
  },
  {
    id: "mysterious-tome",
    title: "Mysterious Tome",
    art: art("mysterious-tome"),
    narrative:
      "A leather-bound book floats above a pedestal, pages turning on their own. Arcane energy crackles around it as if it has been waiting for a reader.",
    choices: [
      {
        label: "Read Carefully",
        description: "Gain 8 Mana XP",
        effects: [xp("mana")],
      },
      {
        label: "Tear Out the Pages",
        description: "Gain Tattered Pages trinket",
        effects: [{ kind: "gainTrinket", trinketId: "tattered-pages" }],
      },
    ],
  },
  {
    id: "crystal-geode",
    title: "Crystal Geode",
    art: art("crystal-geode"),
    narrative:
      "A massive amethyst geode splits the cave floor, its resonant hum filling the chamber with a deep, soothing vibration.",
    choices: [
      {
        label: "Mine the Crystals",
        description: "Add Mana Crystals to your deck, +3 Crystal",
        effects: [{ kind: "addCard", cardId: "mana-crystals" }, mat("crystal", 3)],
      },
      {
        label: "Meditate Under the Crystal",
        description: "Gain 8 Mana XP",
        effects: [xp("mana")],
      },
    ],
  },
  {
    id: "meteorite-crash",
    title: "Meteorite Crash",
    art: art("meteorite-crash"),
    narrative:
      "A smoldering crater scars the forest floor. A strange metallic rock from beyond the sky sits at its center, radiating unfamiliar energy.",
    choices: [
      {
        label: "Collect a Fragment",
        description: "Gain Meteorite trinket, +3 Iron",
        effects: [{ kind: "gainTrinket", trinketId: "meteorite" }, mat("iron", 3)],
      },
      {
        label: "Study the Impact Site",
        description: "Add Meteor to your deck, gain 4 Burn XP",
        effects: [{ kind: "addCard", cardId: "meteor" }, xp("burn", 4)],
      },
    ],
  },
  {
    id: "forgotten-hoard",
    title: "Forgotten Hoard",
    art: art("forgotten-hoard"),
    narrative:
      "Gold coins glitter among scattered bones beside a massive, ancient skeleton. The remains of a once-great beast guard its treasure even in death.",
    choices: [
      {
        label: "Take the Coins",
        description: "Gain 30 Gold",
        effects: [{ kind: "gainGold", amount: 30 }, mat("iron", 3)],
      },
      {
        label: "Take the Bones",
        description: "Gain Bone Charm trinket",
        effects: [{ kind: "gainTrinket", trinketId: "bone-charm" }],
      },
    ],
  },
  {
    id: "sacred-grove",
    title: "Sacred Grove",
    art: art("sacred-grove"),
    narrative:
      "Sunlight breaks through the canopy in golden rays. The air is thick with peace, and the ground hums with quiet vitality.",
    choices: [
      {
        label: "Bask in the Light",
        description: "Restore 12 Health",
        effects: [{ kind: "healHealth", amount: 12 }, mat("herbs", 3)],
      },
      {
        label: "Search the Area",
        description: "Gain Grove's Favor trinket",
        effects: [{ kind: "gainTrinket", trinketId: "groves-favor" }],
      },
    ],
  },
  {
    id: "mountain-pass",
    title: "Mountain Pass",
    art: art("mountain-pass"),
    narrative:
      "A narrow pass winds through jagged peaks. The wind howls and loose rocks scatter the path, but valuable minerals glint in the sunlight.",
    choices: [
      {
        label: "Mine the Cliffside",
        description: "Gain 4 Iron and 2 Crystal",
        effects: [mat("iron", 4), mat("crystal", 2)],
      },
      {
        label: "Study the Alpine Flora",
        description: "Gain 8 Nature XP",
        effects: [xp("nature"), mat("herbs", 2)],
      },
    ],
  },
  {
    id: "murky-pond",
    title: "Murky Pond",
    art: art("murky-pond"),
    narrative:
      "A still pond reflects the gnarled trees surrounding it. Bubbles rise from its murky depths, hinting at secrets beneath the surface.",
    choices: [
      {
        label: "Go Fishing",
        description: "Gain 6 Food",
        effects: [mat("food", 6)],
      },
      {
        label: "Gather Medicinal Reeds",
        description: "Gain 4 Herbs and 2 Wood",
        effects: [mat("herbs", 4), mat("wood", 2)],
      },
    ],
  },
];
