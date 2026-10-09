import { mysteryEventArt, type KeywordId } from "@/lib/game-data";
import type { MaterialId } from "@/lib/homestead/types";
import { pickRandom } from "@/lib/rng";

import { resolveMysteryEventTrinkets } from "./resolve-trinkets";
import type { MysteryEffect, MysteryEvent } from "./types";

const xp = (keyword: KeywordId, amount = 8): MysteryEffect => ({ kind: "gainXP", keyword, amount });
const mat = (material: MaterialId, amount = 3): MysteryEffect => ({ kind: "gainMaterial", material, amount });
const gold = (amount = 20): MysteryEffect => ({ kind: "gainGold", amount });
const trinket = (trinketId: string): MysteryEffect => ({ kind: "gainTrinket", trinketId });
const randomGear = (): MysteryEffect => ({ kind: "gainRandomGear" });
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
    "Glowing mana berries fill a tangled patch, with blue crystals clustered along their stems.",
    [
      ["Harvest Berries", [xp("mana"), gear("sapphire-ring"), mat("herbs")]],
      ["Gather Crystals", [xp("mana"), card("mana-berries"), mat("gems", 3)]],
    ],
  ),
  ev(
    "enchanted-spring",
    "Enchanted Spring",
    "Moss carpets an iridescent spring, and an icy charm rests just beneath the water.",
    [
      ["Gather the Moss", [xp("nature"), trinket("groves-favor"), mat("herbs")]],
      ["Take the Charm", [xp("nature"), trinket("icy-heart"), mat("gems")]],
    ],
  ),
  ev(
    "fungal-grotto",
    "Fungal Grotto",
    "Glowing mushrooms carpet the grotto floor, while crystals glitter along its dark walls.",
    [
      ["Harvest Mushrooms", [xp("nature"), trinket("plague-doctors-mask"), mat("herbs")]],
      ["Collect Crystals", [xp("mana"), trinket("frozen-pocketwatch"), mat("gems", 3)]],
    ],
  ),
  ev(
    "wisdom-tree",
    "Wisdom Tree",
    "A weathered oak whispers above fallen branches and herbs growing between its roots.",
    [
      ["Collect Branches", [xp("nature"), gear("staff"), mat("wood", 3)]],
      ["Forage Herbs", [xp("nature"), gear("emerald-amulet"), mat("herbs")]],
    ],
  ),
  ev("fairy-ring", "Fairy Ring", "Gold coins lie within a circle of glowing mushrooms in a moonlit clearing.", [
    ["Take the Gold", [trinket("lucky-clover"), gold()]],
    ["Pick Mushrooms", [trinket("parasitic-bloom"), mat("herbs", 3)]],
  ]),
  ev("ancient-altar", "Ancient Altar", "A sunlit stone altar holds a bowl of gold and a gleaming topaz relic.", [
    ["Take the Offering", [xp("holy"), gear("topaz-ring"), gold(20)]],
    ["Claim the Relic", [xp("holy"), gear("topaz-amulet"), mat("gems")]],
  ]),
  ev("hidden-cache", "Hidden Cache", "A leather bundle hidden between roots holds an old coinpurse and a blade.", [
    ["Take the Coinpurse", [trinket("merchants-favor"), gold(20), mat("food", 3)]],
    ["Claim the Blade", [xp("bleed"), gear("dagger"), mat("iron")]],
  ]),
  ev(
    "overgrown-temple",
    "Overgrown Temple",
    "Vines cover loose mosaic tiles beside an open crypt, where something glimmers in the darkness.",
    [
      ["Search the Crypt", [randomGear(), gold(), mat("iron")]],
      ["Take a Tile", [xp("nature"), trinket("vanguards-crest"), mat("stone", 3)]],
    ],
  ),
  ev(
    "abandoned-study",
    "Abandoned Study",
    "Dusty scrolls fill the tower shelves, and a forgotten quill rests on the desk.",
    [
      ["Search the Scrolls", [gear("spellbook"), mat("wood", 3)]],
      ["Take the Quill", [xp("mana"), trinket("runic-quill")]],
    ],
  ),
  ev(
    "mysterious-tome",
    "Mysterious Tome",
    "A floating tome sheds loose pages as its worn binding slowly comes apart.",
    [
      ["Take the Pages", [xp("mana"), trinket("tattered-pages")]],
      ["Repair the Binding", [xp("mana"), gear("spellbook")]],
    ],
  ),
  ev(
    "crystal-geode",
    "Crystal Geode",
    "An enormous geode lies cracked open, exposing bright crystals within its broken stone shell.",
    [
      ["Collect Crystal", [xp("mana"), gear("sapphire-ring"), mat("gems")]],
      ["Take the Shell", [xp("mana"), gear("sapphire-amulet"), mat("stone", 3)]],
    ],
  ),
  ev(
    "meteorite-crash",
    "Meteorite Crash",
    "A smoldering meteorite lies in a forest crater, surrounded by scattered metallic fragments.",
    [
      ["Take a Fragment", [xp("burn"), trinket("meteorite"), mat("iron")]],
      ["Search the Crater", [xp("burn"), gear("ruby-ring"), mat("stone", 3)]],
    ],
  ),
  ev(
    "forgotten-hoard",
    "Forgotten Hoard",
    "An ancient beast’s scattered bones surround a shield still nestled beneath its massive skeleton.",
    [
      ["Collect the Bones", [trinket("bone-charm"), mat("iron", 3)]],
      ["Claim the Shield", [gear("kite-shield"), gold()]],
    ],
  ),
  ev(
    "sacred-grove",
    "Sacred Grove",
    "Wild blooms fill a sunlit grove, and an emerald ring hangs among exposed roots.",
    [
      ["Pick the Blooms", [xp("nature"), gear("emerald-amulet"), mat("herbs", 3)]],
      ["Take the Ring", [xp("nature"), gear("emerald-ring"), mat("wood")]],
    ],
  ),
  ev(
    "mountain-pass",
    "Mountain Pass",
    "Iron glints in the windswept cliffside above alpine herbs growing between the rocks.",
    [
      ["Mine the Cliffside", [xp("stun"), trinket("thunderstone"), mat("iron")]],
      ["Gather Herbs", [xp("nature"), card("fox-companion"), mat("herbs")]],
    ],
  ),
  ev("murky-pond", "Murky Pond", "Fish drift through a murky pond beneath medicinal reeds crowding the quiet bank.", [
    ["Catch Fish", [xp("nature"), card("lizard-scout-companion"), mat("food")]],
    ["Pull the Reeds", [xp("nature"), card("will-o-wisp-companion"), mat("herbs")]],
  ]),
  ev(
    "necromancers-offer",
    "The Necromancer's Offer",
    "A robed necromancer offers a forbidden rite beside a circle of crystal salts and bone.",
    [
      ["Accept the Rite", [xp("bleed"), card("skeleton-companion")]],
      ["Take the Salts", [trinket("bone-charm"), mat("gems", 3)]],
    ],
  ),
  ev(
    "medicinal-herb-garden",
    "Medicinal Herb Garden",
    "Medicinal herbs overrun cracked garden beds, with a sheaf of remedy notes lying nearby.",
    [
      ["Harvest Remedies", [trinket("mortar-and-pestle"), mat("herbs")]],
      ["Take the Notes", [xp("nature"), trinket("tattered-pages")]],
    ],
  ),
  ev(
    "crystal-garden",
    "Crystal Garden",
    "Crystal shards glitter in a garden bed beneath chimes humming with arcane energy.",
    [
      ["Harvest Shards", [gear("sapphire-amulet"), mat("gems")]],
      ["Take the Chimes", [xp("mana"), trinket("resonant-chimes")]],
    ],
  ),
  ev(
    "hunters-lodge",
    "Hunter's Lodge",
    "A bow hangs inside the deserted lodge, where a watchful wolf shelters by the hearth.",
    [
      ["Claim the Bow", [gear("shortbow"), mat("hide", 3)]],
      ["Befriend the Wolf", [card("wolf-companion"), mat("food", 3)]],
    ],
  ),
  ev(
    "roadside-censer",
    "Roadside Censer",
    "A brass censer hangs at a fork in the path, filled with fragrant incense.",
    [
      ["Gather Incense", [xp("holy"), gear("mace"), mat("herbs", 3)]],
      ["Claim the Censer", [xp("holy"), trinket("brass-censer"), gold()]],
    ],
  ),
  ev(
    "the-phoenix",
    "The Phoenix",
    "A radiant feather rests atop a charred nest, where embers still glow beneath the wood.",
    [
      ["Claim the Feather", [gear("ruby-amulet"), mat("food", 3)]],
      ["Fan the Embers", [card("phoenix-companion"), mat("wood", 3)]],
    ],
  ),
  ev("the-wolf", "The Wolf", "A grey wolf howls beside its den, where a hunter’s cache lies tucked among the roots.", [
    ["Answer the Howl", [xp("companion"), card("wolf-companion"), mat("hide", 3)]],
    ["Open the Cache", [xp("companion"), gear("recurve-bow"), mat("food", 3)]],
  ]),
  ev(
    "locked-treatise",
    "The Locked Treatise",
    "A broken lock exposes a scholar’s cleansing rite, with loose pages scattered across the desk.",
    [
      ["Learn the Cleansing Rite", [xp("holy"), card("exorcism")]],
      ["Keep the Loose Pages", [xp("mana"), trinket("tattered-pages")]],
    ],
  ),
  ev(
    "altars-afterglow",
    "The Altar's Afterglow",
    "A brass censer rests on the altar beside a topaz amulet glowing like captured sunlight.",
    [
      ["Kindle the Censer", [xp("holy"), trinket("brass-censer")]],
      ["Lift the Sunstone", [gear("topaz-amulet"), mat("gems", 3)]],
    ],
  ),
  ev(
    "singing-crystal",
    "The Singing Crystal",
    "Chimes ring among crystal branches, above charged shards scattered across the garden bed.",
    [
      ["Tune the Chimes", [xp("mana"), trinket("resonant-chimes")]],
      ["Gather the Charged Shards", [card("mana-crystals"), mat("gems", 3)]],
    ],
  ),
  ev(
    "clearwater-remedy",
    "Clearwater Remedy",
    "Clear spring water pools beside thick restorative moss, its strands supple enough to weave.",
    [
      ["Bottle the Spring Water", [card("health-potion"), mat("herbs", 3)]],
      ["Weave the Spring Moss", [xp("nature"), trinket("groves-favor")]],
    ],
  ),
  ev(
    "fae-lanterns",
    "Fae Lanterns",
    "A pixie flits among moonlit mushrooms, leaving their caps glittering with enchanted dew.",
    [
      ["Follow the Pixie", [xp("companion"), card("pixie-companion")]],
      ["Bottle the Dew", [card("wishing-potion"), mat("herbs", 3)]],
    ],
  ),
  ev(
    "sporekeepers-tools",
    "The Sporekeeper's Tools",
    "A mortar and empty bottles sit beside glowing mushroom caps dusted with bitter spores.",
    [
      ["Grind the Mushroom Caps", [trinket("mortar-and-pestle"), mat("herbs", 3)]],
      ["Bottle the Bitter Spores", [xp("poison"), card("acid-potion")]],
    ],
  ),
  ev(
    "rootbound-dispatch",
    "Rootbound Dispatch",
    "A bundle beneath the roots holds a marked route map and a well-kept dagger.",
    [
      ["Follow the Marked Route", [trinket("smugglers-map"), gold(20)]],
      ["Claim the Dagger", [gear("dagger"), mat("iron", 3)]],
    ],
  ),
  ev(
    "moth-in-the-thicket",
    "Moth in the Thicket",
    "A mana moth hovers above ripe berries glowing within a dense thicket of herbs.",
    [
      ["Coax the Moth Closer", [xp("mana"), card("mana-moth-companion")]],
      ["Dry the Ripe Berries", [card("mana-berries"), mat("herbs", 3)]],
    ],
  ),
  ev(
    "healers-recipe",
    "The Healer's Recipe",
    "A remedy recipe rests beside a sturdy mortar, surrounded by the herbs it calls for.",
    [
      ["Prepare the Remedy", [xp("health"), card("panacea-potion")]],
      ["Keep the Mortar", [trinket("mortar-and-pestle"), mat("herbs", 3)]],
    ],
  ),
  ev(
    "cooled-core",
    "The Cooled Core",
    "A fallen meteorite has split open, revealing a warm heart and veins of blue crystal.",
    [
      ["Lift the Warm Heart", [xp("burn"), trinket("meteorite")]],
      ["Chip the Blue Veins", [card("mana-crystals"), mat("gems", 3)]],
    ],
  ),
  ev(
    "drowned-toll",
    "The Drowned Toll",
    "A coin purse glints beneath the pond’s surface, beside reeds rich with healing sap.",
    [
      ["Dredge the Coin Purse", [trinket("wishing-well-coin"), gold(20)]],
      ["Cut the Healing Reeds", [card("health-potion"), mat("herbs", 3)]],
    ],
  ),
  ev(
    "forgotten-door",
    "The Forgotten Door",
    "Roots split a ruined doorway, revealing a prayer book and an old shield in shallow alcoves.",
    [
      ["Take the Prayer Book", [xp("holy"), gear("spellbook")]],
      ["Claim the Shield", [xp("block"), gear("kite-shield")]],
    ],
  ),
  ev(
    "fallen-bough",
    "The Fallen Bough",
    "A fallen ironwood bough lies across the grove, beside a bark charm glossy with healing sap.",
    [
      ["Shape the Ironwood", [trinket("ironwood-buckler"), mat("wood", 3)]],
      ["Take the Sap Charm", [trinket("groves-favor"), mat("herbs", 3)]],
    ],
  ),
  ev(
    "seed-in-the-ash",
    "A Seed in the Ash",
    "An ember-bloom grows from a charred phoenix nest, beside a ruby amulet glowing in the ash.",
    [
      ["Nurture the Bloom", [card("cinderbloom"), mat("wood", 3)]],
      ["Take the Ruby Amulet", [gear("ruby-amulet"), mat("gems", 3)]],
    ],
  ),
  ev(
    "patient-scout",
    "The Patient Scout",
    "A patient wolf waits beside its den, where an old companion’s collar hangs near the entrance.",
    [
      ["Earn Its Trust", [xp("companion"), card("wolf-companion")]],
      ["Recover the Collar", [trinket("companions-collar"), mat("hide", 3)]],
    ],
  ),
];

export function findMysteryEvent(eventId: string): MysteryEvent | null {
  return mysteryPool.find((event) => event.id === eventId) ?? null;
}

function pickMysteryEvent(rng: () => number, eligible: (event: MysteryEvent) => boolean = () => true): MysteryEvent {
  const event = pickRandom(mysteryPool.filter(eligible), rng);
  if (!event) throw new Error("mysteryPool is empty");
  return event;
}

export function pickResolvedMysteryEvent(
  rng: () => number,
  ownedTrinketIds: readonly string[],
  eligible?: (event: MysteryEvent) => boolean,
): MysteryEvent {
  return resolveMysteryEventTrinkets(pickMysteryEvent(rng, eligible), ownedTrinketIds, rng);
}
