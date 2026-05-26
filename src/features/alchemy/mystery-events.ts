// Defines declarative mystery event data and effect schemas for non-combat route nodes.
// Depends on game-data art/card libraries and homestead material types.
// Consumed by run navigation controllers, mystery flows, and UI screen views.
import {
  mysteryManaBerries,
  mysteryEnchantedSpring,
  mysteryFungalGrotto,
  mysteryWisdomTree,
  mysteryFairyRing,
  mysteryAncientAltar,
  mysteryHiddenCache,
  mysteryOvergrownTemple,
  mysteryAbandonedStudy,
  mysteryMysteriousTome,
  mysteryCrystalGeode,
  mysteryMeteoriteCrash,
  mysteryForgottenHoard,
  mysterySacredGrove,
  mysteryMountainPass,
  mysteryMurkyPond,
} from "@/lib/game-data";
import type { KeywordId } from "@/lib/game-data";
import type { MaterialId } from "@/lib/homestead/types";

export type MysteryEffect =
  | { kind: "addCard"; cardId: string }
  | { kind: "chooseCard" }
  | { kind: "healHealth"; amount: number; chance?: number }
  | { kind: "damageHealth"; amount: number }
  | { kind: "gainGold"; amount: number }
  | { kind: "loseGold"; amount: number }
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
    art: mysteryManaBerries,
    narrative:
      "You stumble upon a lush field of glowing Mana Berries. Their faint blue radiance pulses gently, promising restored mana.",
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
    ],
  },
  {
    id: "enchanted-spring",
    title: "Enchanted Spring",
    art: mysteryEnchantedSpring,
    narrative:
      "A pool of iridescent water steams gently in the cool air. Its surface shimmers with an inviting warmth, promising restoration.",
    choices: [
      {
        label: "Bathe in the Spring",
        description: "Restore 12 Health",
        effects: [
          { kind: "healHealth", amount: 12 },
          { kind: "gainMaterial", material: "herbs", amount: 2 },
        ],
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
    art: mysteryFungalGrotto,
    narrative:
      "Bioluminescent mushrooms pulse in the dark, their spores hanging thick in the air. The cave walls glitter with an otherworldly light.",
    choices: [
      {
        label: "Harvest Carefully",
        description: "Add Mana Berries to your deck",
        effects: [
          { kind: "addCard", cardId: "mana-berries" },
          { kind: "gainMaterial", material: "herbs", amount: 4 },
        ],
      },
      {
        label: "Inhale the Spores",
        description: "Gain 8 Mana XP",
        effects: [{ kind: "gainXP", keyword: "mana", amount: 8 }],
      },
    ],
  },
  {
    id: "wisdom-tree",
    title: "Wisdom Tree",
    art: mysteryWisdomTree,
    narrative:
      "An immense oak with a weathered face carved into its bark speaks in rustling leaves. Ancient wisdom emanates from its gnarled branches.",
    choices: [
      {
        label: "Ask for Knowledge",
        description: "Gain 8 Nature XP",
        effects: [{ kind: "gainXP", keyword: "nature", amount: 8 }],
      },
      {
        label: "Rest in its Shade",
        description: "Restore 15 Health",
        effects: [
          { kind: "healHealth", amount: 15 },
          { kind: "gainMaterial", material: "herbs", amount: 2 },
        ],
      },
    ],
  },
  {
    id: "fairy-ring",
    title: "Fairy Ring",
    art: mysteryFairyRing,
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
    art: mysteryAncientAltar,
    narrative:
      "A weathered stone altar stands beneath a shaft of light piercing the canopy. A rusted offering bowl rests before it, etched with forgotten symbols.",
    choices: [
      {
        label: "Pray",
        description: "Gain 8 Holy XP",
        effects: [{ kind: "gainXP", keyword: "holy", amount: 8 }],
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
    art: mysteryHiddenCache,
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
    art: mysteryOvergrownTemple,
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
        effects: [{ kind: "gainXP", keyword: "nature", amount: 8 }],
      },
    ],
  },
  {
    id: "abandoned-study",
    title: "Abandoned Study",
    art: mysteryAbandonedStudy,
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
        effects: [{ kind: "gainXP", keyword: "mana", amount: 8 }],
      },
    ],
  },
  {
    id: "mysterious-tome",
    title: "Mysterious Tome",
    art: mysteryMysteriousTome,
    narrative:
      "A leather-bound book floats above a pedestal, pages turning on their own. Arcane energy crackles around it as if it has been waiting for a reader.",
    choices: [
      {
        label: "Read Carefully",
        description: "Gain 8 Mana XP",
        effects: [{ kind: "gainXP", keyword: "mana", amount: 8 }],
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
    art: mysteryCrystalGeode,
    narrative:
      "A massive amethyst geode splits the cave floor, its resonant hum filling the chamber with a deep, soothing vibration.",
    choices: [
      {
        label: "Mine the Crystals",
        description: "Add Mana Crystals to your deck, +3 Crystal",
        effects: [
          { kind: "addCard", cardId: "mana-crystals" },
          { kind: "gainMaterial", material: "crystal", amount: 3 },
        ],
      },
      {
        label: "Meditate Under the Crystal",
        description: "Gain 8 Mana XP",
        effects: [{ kind: "gainXP", keyword: "mana", amount: 8 }],
      },
    ],
  },
  {
    id: "meteorite-crash",
    title: "Meteorite Crash",
    art: mysteryMeteoriteCrash,
    narrative:
      "A smoldering crater scars the forest floor. A strange metallic rock from beyond the sky sits at its center, radiating unfamiliar energy.",
    choices: [
      {
        label: "Collect a Fragment",
        description: "Gain Meteorite trinket, +3 Iron",
        effects: [
          { kind: "gainTrinket", trinketId: "meteorite" },
          { kind: "gainMaterial", material: "iron", amount: 3 },
        ],
      },
      {
        label: "Study the Impact Site",
        description: "Add Meteor to your deck, gain 4 Burn XP",
        effects: [
          { kind: "addCard", cardId: "meteor" },
          { kind: "gainXP", keyword: "burn", amount: 4 },
        ],
      },
    ],
  },
  {
    id: "forgotten-hoard",
    title: "Forgotten Hoard",
    art: mysteryForgottenHoard,
    narrative:
      "Gold coins glitter among scattered bones beside a massive, ancient skeleton. The remains of a once-great beast guard its treasure even in death.",
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
        label: "Take the Bones",
        description: "Gain Bone Charm trinket",
        effects: [{ kind: "gainTrinket", trinketId: "bone-charm" }],
      },
    ],
  },
  {
    id: "sacred-grove",
    title: "Sacred Grove",
    art: mysterySacredGrove,
    narrative:
      "Sunlight breaks through the canopy in golden rays. The air is thick with peace, and the ground hums with quiet vitality.",
    choices: [
      {
        label: "Bask in the Light",
        description: "Restore 12 Health",
        effects: [
          { kind: "healHealth", amount: 12 },
          { kind: "gainMaterial", material: "herbs", amount: 3 },
        ],
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
    art: mysteryMountainPass,
    narrative:
      "A narrow pass winds through jagged peaks. The wind howls and loose rocks scatter the path, but valuable minerals glint in the sunlight.",
    choices: [
      {
        label: "Mine the Cliffside",
        description: "Gain 4 Iron and 2 Crystal",
        effects: [
          { kind: "gainMaterial", material: "iron", amount: 4 },
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
    art: mysteryMurkyPond,
    narrative:
      "A still pond reflects the gnarled trees surrounding it. Bubbles rise from its murky depths, hinting at secrets beneath the surface.",
    choices: [
      {
        label: "Go Fishing",
        description: "Gain 6 Food",
        effects: [{ kind: "gainMaterial", material: "food", amount: 6 }],
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
