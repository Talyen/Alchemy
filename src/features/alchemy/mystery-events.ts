// Declarative mystery event data and effect schema for non-combat route nodes.
// Depends on game-data art/card IDs and homestead material IDs.
// Consumed by run navigation and mystery screens; this file should not mutate run state.
import { manaBerries } from "@/lib/game-data";
import type { KeywordId } from "@/lib/game-data";
import type { MaterialId } from "@/lib/homestead/types";

export type MysteryEffect =
  | { kind: "addCard"; cardId: string }
  | { kind: "addRandomCard" }
  | { kind: "chooseCard" }
  | { kind: "healHP"; amount: number; chance?: number }
  | { kind: "damageHP"; amount: number }
  | { kind: "gainGold"; amount: number }
  | { kind: "loseGold"; amount: number }
  | { kind: "gainMaxMana"; amount: number }
  | { kind: "gainXP"; keyword: KeywordId; amount: number }
  | { kind: "removeCard"; mode: "random" | "choose" }
  | { kind: "gainTrinket"; trinketId: string }
  | { kind: "gainRandomTrinket" }
  | { kind: "gainMaterial"; material: MaterialId; amount: number }
  | { kind: "none" };

export type MysteryChoice = {
  label: string;
  description: string;
  effects: MysteryEffect[];
};

export type MysteryEvent = {
  id: string;
  title: string;
  art: string;
  narrative: string;
  choices: MysteryChoice[];
};

export const mysteryPool: MysteryEvent[] = [
  {
    id: "mana-berries",
    title: "Mana Berries",
    art: manaBerries,
    narrative: "You stumble upon a lush field of glowing Mana Berries. Their faint blue radiance pulses gently, promising restored mana.",
    choices: [
      {
        label: "Harvest",
        description: "Add Mana Berries to your deck",
        effects: [
          { kind: "addCard", cardId: "mana-berries" },
          { kind: "gainMaterial", material: "herbs", amount: 2 },
        ],
      },
      {
        label: "Study the Glow",
        description: "Gain 8 Mana XP",
        effects: [{ kind: "gainXP", keyword: "mana", amount: 8 }],
      },
      {
        label: "Feast",
        description: "Restore 6 HP",
        effects: [
          { kind: "healHP", amount: 6 },
          { kind: "gainMaterial", material: "food", amount: 2 },
        ],
      },
    ],
  },
  {
    id: "enchanted-spring",
    title: "Enchanted Spring",
    art: "",
    narrative: "A pool of iridescent water steams gently in the cool air. Its surface shimmers with an inviting warmth, promising restoration.",
    choices: [
      {
        label: "Bathe in the Spring",
        description: "Restore 12 HP",
        effects: [
          { kind: "healHP", amount: 12 },
          { kind: "gainMaterial", material: "herbs", amount: 2 },
        ],
      },
      {
        label: "Bottle the Essence",
        description: "Add Health Potion to your deck",
        effects: [{ kind: "addCard", cardId: "health-potion" }],
      },
      {
        label: "Search the Springbed",
        description: "Take 2 damage, gain 4 Crystal",
        effects: [
          { kind: "damageHP", amount: 2 },
          { kind: "gainMaterial", material: "crystal", amount: 4 },
          { kind: "gainMaterial", material: "food", amount: 2 },
        ],
      },
    ],
  },
  {
    id: "fungal-grotto",
    title: "Fungal Grotto",
    art: "",
    narrative: "Bioluminescent mushrooms pulse in the dark, their spores hanging thick in the air. The cave walls glitter with an otherworldly light.",
    choices: [
      {
        label: "Harvest Carefully",
        description: "Add Mana Berries to your deck",
        effects: [
          { kind: "addCard", cardId: "mana-berries" },
          { kind: "gainMaterial", material: "food", amount: 2 },
        ],
      },
      {
        label: "Inhale the Spores",
        description: "Take 4 damage, gain 12 Mana XP",
        effects: [
          { kind: "damageHP", amount: 4 },
          { kind: "gainXP", keyword: "mana", amount: 12 },
        ],
      },
      {
        label: "Collect Rare Mold",
        description: "Gain 20 Gold",
        effects: [
          { kind: "gainGold", amount: 20 },
          { kind: "gainMaterial", material: "herbs", amount: 3 },
        ],
      },
    ],
  },
  {
    id: "wisdom-tree",
    title: "Wisdom Tree",
    art: "",
    narrative: "An immense oak with a weathered face carved into its bark speaks in rustling leaves. Ancient wisdom emanates from its gnarled branches.",
    choices: [
      {
        label: "Ask for Knowledge",
        description: "Gain +1 Mana Crystal",
        effects: [{ kind: "gainMaxMana", amount: 1 }],
      },
      {
        label: "Rest in its Shade",
        description: "Restore 15 HP",
        effects: [
          { kind: "healHP", amount: 15 },
          { kind: "gainMaterial", material: "herbs", amount: 2 },
        ],
      },
    ],
  },
  {
    id: "fairy-ring",
    title: "Fairy Ring",
    art: "",
    narrative: "A circle of glowing mushrooms hums with fey energy in a moonlit clearing. The air feels thick with mischief and ancient magic.",
    choices: [
      {
        label: "Leave an Offering",
        description: "Lose 20 Gold and remove a card from your deck",
        effects: [
          { kind: "loseGold", amount: 20 },
          { kind: "removeCard", mode: "choose" },
        ],
      },
      {
        label: "Dance Until Dawn",
        description: "Restore 5 HP (50% chance for 8 more)",
        effects: [
          { kind: "healHP", amount: 5 },
          { kind: "healHP", amount: 8, chance: 0.5 },
        ],
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
    art: "",
    narrative: "A weathered stone altar stands beneath a shaft of light piercing the canopy. A rusted offering bowl rests before it, etched with forgotten symbols.",
    choices: [
      {
        label: "Pray",
        description: "Restore 15 HP",
        effects: [{ kind: "healHP", amount: 15 }],
      },
      {
        label: "Make an Offering",
        description: "Lose 20 Gold and remove a card from your deck",
        effects: [
          { kind: "loseGold", amount: 20 },
          { kind: "removeCard", mode: "choose" },
        ],
      },
      {
        label: "Decipher the Symbols",
        description: "Gain 10 Holy XP",
        effects: [{ kind: "gainXP", keyword: "holy", amount: 10 }],
      },
    ],
  },
  {
    id: "hidden-cache",
    title: "Hidden Cache",
    art: "",
    narrative: "A leather-wrapped bundle tucked between exposed roots catches your eye. Whatever is inside has been hidden here for a long time.",
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
        description: "Gain 10 Gold XP and add Smuggler's Map to your Inventory",
        effects: [
          { kind: "gainXP", keyword: "gold", amount: 10 },
          { kind: "gainTrinket", trinketId: "smugglers-map" },
        ],
      },
      {
        label: "Follow the Trail",
        description: "Take 3 damage, gain 30 Gold",
        effects: [
          { kind: "damageHP", amount: 3 },
          { kind: "gainGold", amount: 30 },
          { kind: "gainMaterial", material: "iron", amount: 2 },
        ],
      },
    ],
  },
  {
    id: "overgrown-temple",
    title: "Overgrown Temple",
    art: "",
    narrative: "Vines carpet ancient mosaic floors. A faint glow pulses from a cracked sarcophagus in the chamber beyond, hinting at preserved treasures.",
    choices: [
      {
        label: "Explore the Crypt",
        description: "Take 6 damage and gain a random trinket",
        effects: [
          { kind: "damageHP", amount: 6 },
          { kind: "gainRandomTrinket" },
        ],
      },
      {
        label: "Decipher the Inscriptions",
        description: "Gain 15 Holy XP",
        effects: [
          { kind: "gainXP", keyword: "holy", amount: 15 },
          { kind: "gainMaterial", material: "herbs", amount: 3 },
        ],
      },
      {
        label: "Gather Offerings",
        description: "Gain 3 Food and 2 Wood",
        effects: [
          { kind: "gainMaterial", material: "food", amount: 3 },
          { kind: "gainMaterial", material: "wood", amount: 2 },
        ],
      },
    ],
  },
  {
    id: "abandoned-study",
    title: "Abandoned Study",
    art: "",
    narrative: "Dusty shelves line a circular tower room. A half-written thesis lies open on the desk, quill dried beside it centuries ago.",
    choices: [
      {
        label: "Search the Scrolls",
        description: "Choose 1 of 3 random cards to add to your deck",
        effects: [{ kind: "chooseCard" }],
      },
      {
        label: "Organize the Library",
        description: "Gain 12 Mana XP",
        effects: [
          { kind: "gainXP", keyword: "mana", amount: 12 },
          { kind: "gainMaterial", material: "wood", amount: 2 },
        ],
      },
      {
        label: "Salvage the Furnishings",
        description: "Gain 3 Wood and 2 Iron",
        effects: [
          { kind: "gainMaterial", material: "wood", amount: 3 },
          { kind: "gainMaterial", material: "iron", amount: 2 },
        ],
      },
    ],
  },
  {
    id: "mysterious-tome",
    title: "Mysterious Tome",
    art: "",
    narrative: "A leather-bound book floats above a pedestal, pages turning on their own. Arcane energy crackles around it as if it has been waiting for a reader.",
    choices: [
      {
        label: "Read Carefully",
        description: "Add Wish to your deck",
        effects: [{ kind: "addCard", cardId: "wish" }],
      },
      {
        label: "Tear Out the Pages",
        description: "Gain 20 Gold and add Tattered Pages to your Inventory",
        effects: [
          { kind: "gainGold", amount: 20 },
          { kind: "gainTrinket", trinketId: "tattered-pages" },
        ],
      },
      {
        label: "Copy the Diagrams",
        description: "Gain 10 Mana XP",
        effects: [
          { kind: "gainXP", keyword: "mana", amount: 10 },
          { kind: "gainMaterial", material: "crystal", amount: 2 },
        ],
      },
    ],
  },
  {
    id: "crystal-geode",
    title: "Crystal Geode",
    art: "",
    narrative: "A massive amethyst geode splits the cave floor, its resonant hum filling the chamber with a deep, soothing vibration.",
    choices: [
      {
        label: "Mine the Crystals",
        description: "Gain 20 Gold and add Mana Crystals to your deck",
        effects: [
          { kind: "gainGold", amount: 20 },
          { kind: "addCard", cardId: "mana-crystals" },
          { kind: "gainMaterial", material: "crystal", amount: 3 },
        ],
      },
      {
        label: "Meditate Under the Crystal",
        description: "Gain +1 Mana Crystal",
        effects: [{ kind: "gainMaxMana", amount: 1 }],
      },
      {
        label: "Collect Crystal Dust",
        description: "Gain 5 Crystal",
        effects: [
          { kind: "gainMaterial", material: "crystal", amount: 5 },
          { kind: "gainMaterial", material: "food", amount: 1 },
        ],
      },
    ],
  },
  {
    id: "meteorite-crash",
    title: "Meteorite Crash",
    art: "",
    narrative: "A smoldering crater scars the forest floor. A strange metallic rock from beyond the sky sits at its center, radiating unfamiliar energy.",
    choices: [
      {
        label: "Collect a Fragment",
        description: "Add Meteor to your deck",
        effects: [
          { kind: "addCard", cardId: "meteor" },
          { kind: "gainMaterial", material: "iron", amount: 3 },
        ],
      },
      {
        label: "Scavenge the Metal",
        description: "Gain 25 Gold and add Meteorite to your Inventory",
        effects: [
          { kind: "gainGold", amount: 25 },
          { kind: "gainTrinket", trinketId: "meteorite" },
        ],
      },
      {
        label: "Study the Impact Site",
        description: "Gain 12 Burn XP",
        effects: [{ kind: "gainXP", keyword: "burn", amount: 12 }],
      },
    ],
  },
  {
    id: "forgotten-hoard",
    title: "Forgotten Hoard",
    art: "",
    narrative: "Gold coins glitter among scattered bones beside a massive, ancient skeleton. The remains of a once-great beast guard its treasure even in death.",
    choices: [
      {
        label: "Take the Coins",
        description: "Gain 30 Gold",
        effects: [
          { kind: "gainGold", amount: 30 },
          { kind: "gainMaterial", material: "iron", amount: 3 },
        ],
      },
      {
        label: "Search the Bones",
        description: "Take 4 damage, gain 40 Gold, and add Bone Charm to your Inventory",
        effects: [
          { kind: "damageHP", amount: 4 },
          { kind: "gainGold", amount: 40 },
          { kind: "gainTrinket", trinketId: "bone-charm" },
        ],
      },
      {
        label: "Study the Remains",
        description: "Gain 12 Physical XP",
        effects: [{ kind: "gainXP", keyword: "physical", amount: 12 }],
      },
    ],
  },
  {
    id: "sacred-grove",
    title: "Sacred Grove",
    art: "",
    narrative: "Sunlight breaks through the canopy in golden rays. The air is thick with peace, and the ground hums with quiet vitality.",
    choices: [
      {
        label: "Bask in the Light",
        description: "Restore 20 HP",
        effects: [
          { kind: "healHP", amount: 20 },
          { kind: "gainMaterial", material: "herbs", amount: 3 },
        ],
      },
      {
        label: "Collect Holy Dew",
        description: "Add Health Potion to your deck",
        effects: [{ kind: "addCard", cardId: "health-potion" }],
      },
      {
        label: "Plant a Seed",
        description: "Take 3 damage, gain 15 Health XP, and add Grove's Favor to your Inventory",
        effects: [
          { kind: "damageHP", amount: 3 },
          { kind: "gainXP", keyword: "health", amount: 15 },
          { kind: "gainTrinket", trinketId: "groves-favor" },
        ],
      },
    ],
  },
  {
    id: "mountain-pass",
    title: "Mountain Pass",
    art: "",
    narrative: "A narrow pass winds through jagged peaks. The wind howls and loose rocks scatter the path, but valuable minerals glint in the sunlight.",
    choices: [
      {
        label: "Scout the Path Ahead",
        description: "Restore 5 HP",
        effects: [
          { kind: "healHP", amount: 5 },
          { kind: "gainMaterial", material: "food", amount: 3 },
        ],
      },
      {
        label: "Mine the Cliffside",
        description: "Take 3 damage, gain 5 Iron and 2 Crystal",
        effects: [
          { kind: "damageHP", amount: 3 },
          { kind: "gainMaterial", material: "iron", amount: 5 },
          { kind: "gainMaterial", material: "crystal", amount: 2 },
        ],
      },
      {
        label: "Study the Alpine Flora",
        description: "Gain 8 Nature XP",
        effects: [
          { kind: "gainXP", keyword: "nature", amount: 8 },
          { kind: "gainMaterial", material: "herbs", amount: 2 },
        ],
      },
    ],
  },
  {
    id: "murky-pond",
    title: "Murky Pond",
    art: "",
    narrative: "A still pond reflects the gnarled trees surrounding it. Bubbles rise from its murky depths, hinting at secrets beneath the surface.",
    choices: [
      {
        label: "Fish for Dinner",
        description: "Gain 3 Food",
        effects: [{ kind: "gainMaterial", material: "food", amount: 3 }],
      },
      {
        label: "Dredge the Bottom",
        description: "Take 2 damage, gain 20 Gold and 2 Crystal",
        effects: [
          { kind: "damageHP", amount: 2 },
          { kind: "gainGold", amount: 20 },
          { kind: "gainMaterial", material: "crystal", amount: 2 },
        ],
      },
      {
        label: "Gather Medicinal Reeds",
        description: "Gain 4 Herbs and 2 Wood",
        effects: [
          { kind: "gainMaterial", material: "herbs", amount: 4 },
          { kind: "gainMaterial", material: "wood", amount: 2 },
        ],
      },
    ],
  },
];
