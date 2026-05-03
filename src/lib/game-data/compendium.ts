import { blessedAegis, goblin, imp, lizardScout, manaCrystal, meteor, mimic, mudElemental, necromancer, plagueDoctor, poisonDagger, skeleton, steal } from "./assets";
import type { BestiaryEntry, TrinketEntry } from "./types";

export const enemyBestiary: BestiaryEntry[] = [
  {
    id: "skeleton-marauder",
    title: "Skeleton Marauder",
    subtitle: "Shambling Raider",
    descriptionLines: ["A brittle frontliner that leans on raw pressure instead of defense.", "Best dropped quickly before lingering ailments start to matter."],
    art: skeleton,
  },
  {
    id: "ember-acolyte",
    title: "Ember Acolyte",
    subtitle: "Ash Chapel Fanatic",
    descriptionLines: ["A fire-bound cultist that turns every opening into searing attrition.", "Its curses build slowly, then burn out of control if ignored."],
    art: meteor,
  },
  {
    id: "venom-collector",
    title: "Venom Collector",
    subtitle: "Bogglass Hunter",
    descriptionLines: ["A patient stalker that layers poison and waits for panic.", "Long fights favor it, so tempo matters more than greed."],
    art: poisonDagger,
  },
  {
    id: "goblin-rogue",
    title: "Goblin Rogue",
    subtitle: "Sneaky Brigand",
    descriptionLines: ["A swift attacker that strikes from the shadows.", "Watch out for quick hits and opportunistic strikes."],
    art: goblin,
  },
  {
    id: "imp-wisp",
    title: "Imp Wisp",
    subtitle: "Chaos Ember",
    descriptionLines: ["A mischievous flame spirit that dances around the battlefield.", "Its attacks leave lingering burn damage."],
    art: imp,
  },
  {
    id: "lizard-scout",
    title: "Lizard Scout",
    subtitle: "Swamp Skirmisher",
    descriptionLines: ["A fast-moving hunter that strikes and retreats.", "Its poison weakens you over time."],
    art: lizardScout,
  },
  {
    id: "mimic-chest",
    title: "Mimic Chest",
    subtitle: "Treasure Trap",
    descriptionLines: ["A cunning trap disguised as loot.", "Think twice before grabbing that shiny treasure!"],
    art: mimic,
  },
  {
    id: "mud-elemental",
    title: "Mud Elemental",
    subtitle: "Swamp Golem",
    descriptionLines: ["A slow but resilient construct of mud and earth.", "Its thick shell reduces incoming damage."],
    art: mudElemental,
  },
  {
    id: "necromancer",
    title: "Necromancer",
    subtitle: "Death Speaker",
    descriptionLines: ["A dark mage that manipulates life force.", "Watch out for cursed attacks that leech your health."],
    art: necromancer,
  },
  {
    id: "plague-doctor",
    title: "Plague Doctor",
    subtitle: "Pestilence Carrier",
    descriptionLines: ["A masked healer of terrible diseases.", "Its miasma spreads poison to all who draw near."],
    art: plagueDoctor,
  },
];

export const trinketLibrary: TrinketEntry[] = [
  {
    id: "brass-censer",
    title: "Brass Censer",
    descriptionLines: ["Future Trinket", "Your first Holy attack each battle deals 2 extra damage."],
    art: blessedAegis,
  },
  {
    id: "crystal-phial",
    title: "Crystal Phial",
    descriptionLines: ["Future Trinket", "The first consumed card each battle restores 1 Mana."],
    art: manaCrystal,
  },
  {
    id: "gilded-ledger",
    title: "Gilded Ledger",
    descriptionLines: ["Future Trinket", "Gain 5 Gold after your first victory in each act."],
    art: steal,
  },
];
