// Declarative mystery event pool for campaign route nodes.
import {
  brassCenser,
  crystalGarden,
  herbGarden,
  huntersLodge,
  mysteryEventArt,
  necromancer,
  phoenixFeather,
  wolfCompanion,
  type KeywordId,
} from "@/lib/game-data";
import type { MaterialId } from "@/lib/homestead/types";

import type { MysteryEffect, MysteryEvent } from "./types";

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
        effects: [{ kind: "addCard", cardId: "mana-berries" }, mat("herbs", 2)],
      },
      {
        label: "Study the Glow",
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
        effects: [{ kind: "healHealth", amount: 12 }, mat("herbs", 2)],
      },
      {
        label: "Bottle the Essence",
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
        effects: [{ kind: "addCard", cardId: "mana-berries" }, mat("herbs", 4)],
      },
      {
        label: "Inhale the Spores",
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
        effects: [xp("nature")],
      },
      {
        label: "Rest in its Shade",
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
        effects: [{ kind: "removeCard", mode: "choose" }],
      },
      {
        label: "Make a Wish",
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
        effects: [xp("holy")],
      },
      {
        label: "Make an Offering",
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
        effects: [
          { kind: "gainGold", amount: 20 },
          { kind: "addCard", cardId: "steal" },
        ],
      },
      {
        label: "Study the Map",
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
        effects: [{ kind: "gainRandomTrinket" }],
      },
      {
        label: "Decipher the Inscriptions",
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
        effects: [{ kind: "chooseCard" }],
      },
      {
        label: "Organize the Library",
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
        effects: [xp("mana")],
      },
      {
        label: "Tear Out the Pages",
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
        effects: [{ kind: "addCard", cardId: "mana-crystals" }, mat("crystal", 3)],
      },
      {
        label: "Meditate Under the Crystal",
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
        effects: [{ kind: "gainTrinket", trinketId: "meteorite" }, mat("iron", 3)],
      },
      {
        label: "Study the Impact Site",
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
        effects: [{ kind: "gainGold", amount: 30 }, mat("iron", 3)],
      },
      {
        label: "Take the Bones",
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
        effects: [{ kind: "healHealth", amount: 12 }, mat("herbs", 3)],
      },
      {
        label: "Search the Area",
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
        effects: [mat("iron", 4), mat("crystal", 2)],
      },
      {
        label: "Study the Alpine Flora",
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
        effects: [mat("food", 6)],
      },
      {
        label: "Gather Medicinal Reeds",
        effects: [mat("herbs", 4), mat("wood", 2)],
      },
    ],
  },
  {
    id: "necromancers-offer",
    title: "The Necromancer's Offer",
    art: necromancer,
    narrative: "A robed figure tends a circle of salt and bone. Without looking up, they extend a skeletal hand.",
    choices: [
      {
        label: "Accept the Rite",
        effects: [xp("bleed"), { kind: "addCard", cardId: "skeleton-companion" }],
      },
      {
        label: "Take the Salts",
        effects: [{ kind: "addCard", cardId: "smelling-salts" }],
      },
    ],
  },
  {
    id: "medicinal-herb-garden",
    title: "Medicinal Herb Garden",
    art: herbGarden,
    narrative: "Cultivated beds have run wild as medicinal herbs grow through cracked paving, rich with scent.",
    choices: [
      {
        label: "Harvest Supplies",
        effects: [mat("herbs", 5), { kind: "addCard", cardId: "panacea-potion" }],
      },
      {
        label: "Read the Research",
        effects: [xp("nature")],
      },
    ],
  },
  {
    id: "crystal-garden",
    title: "Crystal Garden",
    art: crystalGarden,
    narrative: "Faceted crystalline blooms catch stray light, chiming softly when the wind passes by.",
    choices: [
      {
        label: "Harvest the Crystals",
        effects: [mat("crystal", 4), { kind: "addCard", cardId: "mana-crystals" }],
      },
      {
        label: "Study the Crystals",
        effects: [xp("mana")],
      },
    ],
  },
  {
    id: "hunters-lodge",
    title: "Hunter's Lodge",
    art: huntersLodge,
    narrative:
      "A deserted lodge still smells of smoke, wood, and leather. A hunter's bow and quiver hang near the door, and a loyal Wolf companion protects the homestead.",
    choices: [
      {
        label: "Take the Arrows",
        effects: [{ kind: "chooseCard", tag: "archery" }],
      },
      {
        label: "Befriend the Wolf",
        effects: [{ kind: "addCard", cardId: "wolf-companion" }],
      },
    ],
  },
  {
    id: "roadside-censer",
    title: "Roadside Censer",
    art: brassCenser,
    narrative:
      "Incense smoke coils from a hanging brass censer at a fork in the path. The air tastes of sanctified ash and old vows.",
    choices: [
      {
        label: "Breathe the Smoke",
        effects: [xp("holy")],
      },
      {
        label: "Claim the Censer",
        effects: [{ kind: "gainTrinket", trinketId: "brass-censer" }],
      },
    ],
  },
  {
    id: "the-phoenix",
    title: "The Phoenix",
    art: phoenixFeather,
    narrative: "A single feather glows with warm radiance, asking to be reborn.",
    choices: [
      {
        label: "Claim the Feather",
        effects: [{ kind: "addCard", cardId: "phoenix-feather" }],
      },
      {
        label: "Fan the Embers",
        effects: [{ kind: "addCard", cardId: "phoenix-companion" }],
      },
    ],
  },
  {
    id: "the-wolf",
    title: "The Wolf",
    art: wolfCompanion,
    narrative:
      "A grey wolf steps from the treeline, watching you with amber eyes. It does not flee â€” only waits, as if deciding whether you are worth knowing.",
    choices: [
      {
        label: "Answer the Howl",
        effects: [{ kind: "addCard", cardId: "wolf-companion" }],
      },
      {
        label: "Study the Pack's Tactics",
        effects: [xp("companion")],
      },
    ],
  },
];
