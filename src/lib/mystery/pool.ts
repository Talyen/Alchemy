import { mysteryEventArt, type KeywordId } from "@/lib/game-data";
import type { MaterialId } from "@/lib/homestead/types";
import { pickRandom } from "@/lib/utils";

import { resolveMysteryEventTrinkets } from "./resolve-trinkets";
import type { MysteryEffect, MysteryEvent } from "./types";

// Effect order: portrait reward → XP → gold → materials (matches MysteryRewardSummary + tooltips)
const xp = (keyword: KeywordId, amount = 8): MysteryEffect => ({ kind: "gainXP", keyword, amount });
const mat = (material: MaterialId, amount: number): MysteryEffect => ({ kind: "gainMaterial", material, amount });
const gold = (amount: number): MysteryEffect => ({ kind: "gainGold", amount });
const trinket = (trinketId: string): MysteryEffect => ({ kind: "gainTrinket", trinketId });
const gear = (baseItemId: string): MysteryEffect => ({ kind: "gainGeneratedGear", baseItemId });
const card = (cardId: string): MysteryEffect => ({ kind: "addCard", cardId });

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
    "You stumble upon a lush field of glowing Mana Berries. Crystal has formed along the stems, and a sapphire ring lies half-buried in the tangle, pulsing with the same blue light.",
    [
      ["Harvest Berries", [gear("sapphire-ring"), mat("herbs", 2)]],
      ["Gather Crystals", [card("mana-berries"), xp("mana"), mat("crystal", 3)]],
    ],
  ),
  ev(
    "enchanted-spring",
    "Enchanted Spring",
    "A pool of iridescent water steams gently in the cool air. Moss carpets the bank, and a charm of icy crystal rests just below the surface.",
    [
      ["Gather the Moss", [trinket("groves-favor"), xp("nature"), mat("herbs", 2)]],
      ["Take the Charm", [trinket("icy-heart"), mat("crystal", 3)]],
    ],
  ),
  ev(
    "fungal-grotto",
    "Fungal Grotto",
    "Bioluminescent mushrooms pulse in the dark, their spores hanging thick in the air. Crystals glitter on the cave walls, and an emerald ring sits among the caps.",
    [
      ["Harvest Mushrooms", [gear("emerald-ring"), mat("herbs", 4)]],
      ["Collect Crystals", [trinket("frozen-pocketwatch"), xp("mana"), mat("crystal", 3)]],
    ],
  ),
  ev(
    "wisdom-tree",
    "Wisdom Tree",
    "An immense oak with a weathered face carved into its bark speaks in rustling leaves. Fallen branches litter the ground, and herbs crowd the roots.",
    [
      ["Collect Branches", [gear("staff"), xp("nature"), mat("wood", 3)]],
      ["Forage Herbs", [gear("emerald-amulet"), xp("nature"), mat("herbs", 2)]],
    ],
  ),
  ev(
    "fairy-ring",
    "Fairy Ring",
    "A circle of glowing mushrooms hums with fey energy in a moonlit clearing. Gold coins and a lucky clover rest in the grass as if left for you.",
    [
      ["Take the Gold", [trinket("lucky-clover"), gold(25)]],
      ["Pick Mushrooms", [trinket("parasitic-bloom"), mat("herbs", 3)]],
    ],
  ),
  ev(
    "ancient-altar",
    "Ancient Altar",
    "A weathered stone altar stands beneath a shaft of light piercing the canopy. Gold fills a rusted offering bowl, and a topaz relic set with crystal rests beside it.",
    [
      ["Take the Offering", [gear("topaz-ring"), xp("holy"), gold(20)]],
      ["Claim the Relic", [gear("topaz-amulet"), mat("crystal", 3)]],
    ],
  ),
  ev(
    "hidden-cache",
    "Hidden Cache",
    "A leather-wrapped bundle tucked between exposed roots catches your eye. Inside wait a coinpurse and a blade, hidden here for a long time.",
    [
      ["Take the Coinpurse", [trinket("merchants-favor"), gold(20), mat("food", 3)]],
      ["Claim the Blade", [gear("dagger"), mat("food", 3)]],
    ],
  ),
  ev(
    "overgrown-temple",
    "Overgrown Temple",
    "Vines carpet ancient mosaic tiles. A faint glow pulses from a cracked sarcophagus in the crypt beyond, hinting at gold and preserved treasures.",
    [
      ["Search the Crypt", [{ kind: "gainRandomTrinket", fromIds: ["bone-charm", "sin-eaters-lantern"] }, gold(20)]],
      ["Take a Tile", [trinket("vanguards-crest"), xp("nature"), mat("iron", 3)]],
    ],
  ),
  ev(
    "abandoned-study",
    "Abandoned Study",
    "Dusty wooden shelves of scrolls line a circular tower room. A spellbook lies open on the desk, a quill dried beside it centuries ago.",
    [
      ["Search the Scrolls", [gear("spellbook"), mat("wood", 3)]],
      ["Take the Quill", [trinket("runic-quill"), xp("mana")]],
    ],
  ),
  ev(
    "mysterious-tome",
    "Mysterious Tome",
    "A leather-bound book floats above a pedestal, loose pages turning on their own. Its binding is splitting, as if it has been waiting to be read — or repaired.",
    [
      ["Take the Pages", [trinket("tattered-pages"), xp("mana")]],
      ["Repair the Binding", [gear("spellbook"), xp("mana")]],
    ],
  ),
  ev(
    "crystal-geode",
    "Crystal Geode",
    "A massive amethyst geode splits the cave floor, gems crowding its hollow. A sapphire ring has formed among the crystal, and the stone shell has broken open beside it.",
    [
      ["Collect Gems", [gear("sapphire-ring"), mat("crystal", 3)]],
      ["Take the Shell", [gear("sapphire-amulet"), xp("mana"), mat("iron", 3)]],
    ],
  ),
  ev(
    "meteorite-crash",
    "Meteorite Crash",
    "A smoldering crater scars the forest floor. A metallic meteorite from beyond the sky sits at its center, iron fragments in the stone where the pit was torn open.",
    [
      ["Take a Fragment", [trinket("meteorite"), mat("iron", 3)]],
      ["Search the Crater", [gear("ruby-ring"), xp("burn"), mat("iron", 3)]],
    ],
  ),
  ev(
    "forgotten-hoard",
    "Forgotten Hoard",
    "Scattered bones and a bone charm lie beside a massive, ancient skeleton. Iron scraps rest among the remains, and gold coins spill around a shield the beast still guards.",
    [
      ["Collect the Bones", [trinket("bone-charm"), mat("iron", 3)]],
      ["Claim the Shield", [gear("kite-shield"), gold(30)]],
    ],
  ),
  ev(
    "sacred-grove",
    "Sacred Grove",
    "Sunlight breaks through the canopy in golden rays, falling on wild blooms and herbs. An emerald ring hangs in the roots of a fallen wooden bough.",
    [
      ["Pick the Blooms", [gear("emerald-amulet"), xp("nature"), mat("herbs", 3)]],
      ["Take the Ring", [gear("emerald-ring"), mat("wood", 3)]],
    ],
  ),
  ev(
    "mountain-pass",
    "Mountain Pass",
    "A narrow pass winds through jagged peaks. Iron and a thunderstone glint in the cliffside, and alpine herbs cling to the rocks where the wind howls.",
    [
      ["Mine the Cliffside", [trinket("thunderstone"), mat("iron", 4)]],
      ["Gather Herbs", [card("fox-companion"), xp("nature"), mat("herbs", 2)]],
    ],
  ),
  ev(
    "murky-pond",
    "Murky Pond",
    "A still pond reflects the gnarled trees surrounding it. Fish drift in the murky depths, and medicinal reeds crowd the bank as bubbles rise from below.",
    [
      ["Catch Fish", [card("lizard-scout-companion"), xp("nature"), mat("food", 6)]],
      ["Pull the Reeds", [card("will-o-wisp-companion"), xp("nature"), mat("herbs", 4)]],
    ],
  ),
  ev(
    "necromancers-offer",
    "The Necromancer's Offer",
    "A robed figure tends a circle of crystal salts and bone. Without looking up, they extend a staff in a skeletal hand, offering a forbidden rite.",
    [
      ["Accept the Rite", [card("skeleton-companion"), xp("bleed")]],
      ["Take the Salts", [trinket("bone-charm"), mat("crystal", 3)]],
    ],
  ),
  ev(
    "medicinal-herb-garden",
    "Medicinal Herb Garden",
    "Cultivated beds have run wild as medicinal herbs grow through cracked paving. A mortar and pestle sit beside a sheaf of notes, rich with scent and curative promise.",
    [
      ["Harvest Remedies", [trinket("mortar-and-pestle"), mat("herbs", 5)]],
      ["Take the Notes", [trinket("tattered-pages"), xp("nature")]],
    ],
  ),
  ev(
    "crystal-garden",
    "Crystal Garden",
    "Faceted crystalline blooms catch stray light, and chimes hang among the shards. A sapphire amulet rests in the bed, each shard thrumming with latent power.",
    [
      ["Harvest Shards", [gear("sapphire-amulet"), mat("crystal", 4)]],
      ["Take the Chimes", [trinket("resonant-chimes"), xp("mana")]],
    ],
  ),
  ev(
    "hunters-lodge",
    "Hunter's Lodge",
    "A deserted lodge still smells of smoke, wood, and leather. A hunter's bow and hatchet hang near the door, preserved and waiting.",
    [
      ["Claim the Bow", [gear("shortbow"), mat("food", 3)]],
      ["Befriend the Wolf", [card("wolf-companion"), mat("food", 3)]],
    ],
  ),
  ev(
    "roadside-censer",
    "Roadside Censer",
    "Incense smoke coils from a hanging brass censer at a fork in the path. Gold coins lie at its base, and the air tastes of sanctified ash and old vows.",
    [
      ["Gather Incense", [gear("mace"), xp("holy"), mat("herbs", 3)]],
      ["Claim the Censer", [trinket("brass-censer"), gold(20)]],
    ],
  ),
  ev(
    "the-phoenix",
    "The Phoenix",
    "A single feather glows with warm radiance on a nest of charred wood, a ruby gleam caught in the down. A burning brand leans in the embers as if the flame that created it still burns nearby.",
    [
      ["Claim the Feather", [gear("ruby-amulet"), mat("food", 3)]],
      ["Fan the Embers", [card("phoenix-companion"), mat("wood", 3)]],
    ],
  ),
  ev(
    "the-wolf",
    "The Wolf",
    "A grey wolf steps from the treeline, watching you with amber eyes. It does not flee — only waits, then leads you toward a den of hides and a hunter's cache of food and a bow.",
    [
      ["Answer the Howl", [card("wolf-companion"), xp("companion")]],
      ["Open the Cache", [gear("recurve-bow"), mat("food", 3)]],
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

/** Draws a new event and resolves its trinket grants against owned trinkets so badges match payouts. */
export function pickResolvedMysteryEvent(rng: () => number, ownedTrinketIds: readonly string[]): MysteryEvent {
  return resolveMysteryEventTrinkets(pickMysteryEvent(rng), ownedTrinketIds, rng);
}
