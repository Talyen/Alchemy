import { mysteryEventArt, type KeywordId } from "@/lib/game-data";
import type { MaterialId } from "@/lib/homestead/types";
import { pickRandom } from "@/lib/utils";

import type { MysteryEffect, MysteryEvent } from "./types";

const xp = (keyword: KeywordId, amount = 8): MysteryEffect => ({ kind: "gainXP", keyword, amount });
const mat = (material: MaterialId, amount: number): MysteryEffect => ({ kind: "gainMaterial", material, amount });

function ev(
  id: string,
  title: string,
  narrative: string,
  choices: Array<[label: string, effects: MysteryEffect[]]>,
): MysteryEvent {
  return {
    id,
    title,
    art: mysteryEventArt[id] ?? "",
    narrative,
    choices: choices.map(([label, effects]) => ({ label, effects })),
  };
}

export const mysteryPool: MysteryEvent[] = [
  ev(
    "mana-berries",
    "Mana Berries",
    "You stumble upon a lush field of glowing Mana Berries. Their faint blue radiance pulses gently, promising restored mana.",
    [
      ["Harvest", [{ kind: "addCard", cardId: "mana-berries" }, mat("herbs", 2)]],
      ["Study the Glow", [xp("mana")]],
    ],
  ),
  ev(
    "enchanted-spring",
    "Enchanted Spring",
    "A pool of iridescent water steams gently in the cool air. Its surface shimmers with an inviting warmth, promising restoration.",
    [
      ["Bathe in the Spring", [{ kind: "healHealth", amount: 12 }, mat("herbs", 2)]],
      ["Bottle the Essence", [{ kind: "addCard", cardId: "health-potion" }]],
    ],
  ),
  ev(
    "fungal-grotto",
    "Fungal Grotto",
    "Bioluminescent mushrooms pulse in the dark, their spores hanging thick in the air. The cave walls glitter with an otherworldly light.",
    [
      ["Harvest Carefully", [{ kind: "addCard", cardId: "mana-berries" }, mat("herbs", 4)]],
      ["Inhale the Spores", [xp("mana")]],
    ],
  ),
  ev(
    "wisdom-tree",
    "Wisdom Tree",
    "An immense oak with a weathered face carved into its bark speaks in rustling leaves. Ancient wisdom emanates from its gnarled branches.",
    [
      ["Ask for Knowledge", [xp("nature")]],
      ["Rest in its Shade", [{ kind: "healHealth", amount: 15 }, mat("herbs", 2)]],
    ],
  ),
  ev(
    "fairy-ring",
    "Fairy Ring",
    "A circle of glowing mushrooms hums with fey energy in a moonlit clearing. The air feels thick with mischief and ancient magic.",
    [
      ["Leave an Offering", [{ kind: "removeCard", mode: "choose" }]],
      ["Make a Wish", [{ kind: "addCard", cardId: "wish" }]],
    ],
  ),
  ev(
    "ancient-altar",
    "Ancient Altar",
    "A weathered stone altar stands beneath a shaft of light piercing the canopy. A rusted offering bowl rests before it, etched with forgotten symbols.",
    [
      ["Pray", [xp("holy")]],
      ["Make an Offering", [{ kind: "removeCard", mode: "choose" }]],
    ],
  ),
  ev(
    "hidden-cache",
    "Hidden Cache",
    "A leather-wrapped bundle tucked between exposed roots catches your eye. Whatever is inside has been hidden here for a long time.",
    [
      [
        "Take Everything",
        [
          { kind: "gainGold", amount: 20 },
          { kind: "addCard", cardId: "steal" },
        ],
      ],
      ["Study the Map", [{ kind: "gainTrinket", trinketId: "smugglers-map" }]],
    ],
  ),
  ev(
    "overgrown-temple",
    "Overgrown Temple",
    "Vines carpet ancient mosaic floors. A faint glow pulses from a cracked sarcophagus in the chamber beyond, hinting at preserved treasures.",
    [
      ["Explore the Crypt", [{ kind: "gainRandomTrinket" }]],
      ["Decipher the Inscriptions", [xp("nature")]],
    ],
  ),
  ev(
    "abandoned-study",
    "Abandoned Study",
    "Dusty shelves line a circular tower room. A half-written thesis lies open on the desk, quill dried beside it centuries ago.",
    [
      ["Search the Scrolls", [{ kind: "chooseCard" }]],
      ["Organize the Library", [xp("mana")]],
    ],
  ),
  ev(
    "mysterious-tome",
    "Mysterious Tome",
    "A leather-bound book floats above a pedestal, pages turning on their own. Arcane energy crackles around it as if it has been waiting for a reader.",
    [
      ["Read Carefully", [xp("mana")]],
      ["Tear Out the Pages", [{ kind: "gainTrinket", trinketId: "tattered-pages" }]],
    ],
  ),
  ev(
    "crystal-geode",
    "Crystal Geode",
    "A massive amethyst geode splits the cave floor, its resonant hum filling the chamber with a deep, soothing vibration.",
    [
      ["Mine the Crystals", [{ kind: "addCard", cardId: "mana-crystals" }, mat("crystal", 3)]],
      ["Meditate Under the Crystal", [xp("mana")]],
    ],
  ),
  ev(
    "meteorite-crash",
    "Meteorite Crash",
    "A smoldering crater scars the forest floor. A strange metallic rock from beyond the sky sits at its center, radiating unfamiliar energy.",
    [
      ["Collect a Fragment", [{ kind: "gainTrinket", trinketId: "meteorite" }, mat("iron", 3)]],
      ["Study the Impact Site", [{ kind: "addCard", cardId: "meteor" }, xp("burn", 4)]],
    ],
  ),
  ev(
    "forgotten-hoard",
    "Forgotten Hoard",
    "Gold coins glitter among scattered bones beside a massive, ancient skeleton. The remains of a once-great beast guard its treasure even in death.",
    [
      ["Take the Coins", [{ kind: "gainGold", amount: 30 }, mat("iron", 3)]],
      ["Take the Bones", [{ kind: "gainTrinket", trinketId: "bone-charm" }]],
    ],
  ),
  ev(
    "sacred-grove",
    "Sacred Grove",
    "Sunlight breaks through the canopy in golden rays. The air is thick with peace, and the ground hums with quiet vitality.",
    [
      ["Bask in the Light", [{ kind: "healHealth", amount: 12 }, mat("herbs", 3)]],
      ["Search the Area", [{ kind: "gainTrinket", trinketId: "groves-favor" }]],
    ],
  ),
  ev(
    "mountain-pass",
    "Mountain Pass",
    "A narrow pass winds through jagged peaks. The wind howls and loose rocks scatter the path, but valuable minerals glint in the sunlight.",
    [
      ["Mine the Cliffside", [mat("iron", 4), mat("crystal", 2)]],
      ["Study the Alpine Flora", [xp("nature"), mat("herbs", 2)]],
    ],
  ),
  ev(
    "murky-pond",
    "Murky Pond",
    "A still pond reflects the gnarled trees surrounding it. Bubbles rise from its murky depths, hinting at secrets beneath the surface.",
    [
      ["Go Fishing", [mat("food", 6)]],
      ["Gather Medicinal Reeds", [mat("herbs", 4), mat("wood", 2)]],
    ],
  ),
  ev(
    "necromancers-offer",
    "The Necromancer's Offer",
    "A robed figure tends a circle of salt and bone. Without looking up, they extend a skeletal hand.",
    [
      ["Accept the Rite", [xp("bleed"), { kind: "addCard", cardId: "skeleton-companion" }]],
      ["Take the Salts", [{ kind: "addCard", cardId: "smelling-salts" }]],
    ],
  ),
  ev(
    "medicinal-herb-garden",
    "Medicinal Herb Garden",
    "Cultivated beds have run wild as medicinal herbs grow through cracked paving, rich with scent.",
    [
      ["Harvest Supplies", [mat("herbs", 5), { kind: "addCard", cardId: "panacea-potion" }]],
      ["Read the Research", [xp("nature")]],
    ],
  ),
  ev(
    "crystal-garden",
    "Crystal Garden",
    "Faceted crystalline blooms catch stray light, chiming softly when the wind passes by.",
    [
      ["Harvest the Crystals", [mat("crystal", 4), { kind: "addCard", cardId: "mana-crystals" }]],
      ["Study the Crystals", [xp("mana")]],
    ],
  ),
  ev(
    "hunters-lodge",
    "Hunter's Lodge",
    "A deserted lodge still smells of smoke, wood, and leather. A hunter's bow and quiver hang near the door, and a loyal Wolf companion protects the homestead.",
    [
      ["Take the Arrows", [{ kind: "chooseCard", tag: "archery" }]],
      ["Befriend the Wolf", [{ kind: "addCard", cardId: "wolf-companion" }]],
    ],
  ),
  ev(
    "roadside-censer",
    "Roadside Censer",
    "Incense smoke coils from a hanging brass censer at a fork in the path. The air tastes of sanctified ash and old vows.",
    [
      ["Breathe the Smoke", [xp("holy")]],
      ["Claim the Censer", [{ kind: "gainTrinket", trinketId: "brass-censer" }]],
    ],
  ),
  ev("the-phoenix", "The Phoenix", "A single feather glows with warm radiance, asking to be reborn.", [
    ["Claim the Feather", [{ kind: "addCard", cardId: "phoenix-feather" }]],
    ["Fan the Embers", [{ kind: "addCard", cardId: "phoenix-companion" }]],
  ]),
  ev(
    "the-wolf",
    "The Wolf",
    "A grey wolf steps from the treeline, watching you with amber eyes. It does not flee — only waits, as if deciding whether you are worth knowing.",
    [
      ["Answer the Howl", [{ kind: "addCard", cardId: "wolf-companion" }]],
      ["Study the Pack's Tactics", [xp("companion")]],
    ],
  ),
];

export function findMysteryEvent(eventId: string): MysteryEvent | null {
  return mysteryPool.find((event) => event.id === eventId) ?? null;
}

export function pickMysteryEvent(rng: () => number): MysteryEvent {
  const event = pickRandom(mysteryPool, rng);
  if (!event) throw new Error("mysteryPool is empty");
  return event;
}
