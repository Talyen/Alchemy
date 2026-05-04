import { blessedAegis, goblin, imp, lizardScout, manaCrystal, mimic, mudElemental, necromancer, plagueDoctor, skeleton, steal } from "./assets";
import type { BestiaryEntry, TrinketEntry } from "./types";

export const enemyBestiary: BestiaryEntry[] = [
  {
    id: "skeleton",
    title: "Skeleton",
    subtitle: "Shambling Raider",
    descriptionLines: ["A brittle frontliner that leans on raw pressure instead of defense.", "Best dropped quickly before lingering ailments start to matter."],
    art: skeleton,
    enemyType: "normal",
  },
  {
    id: "goblin",
    title: "Goblin",
    subtitle: "Sneaky Brigand",
    descriptionLines: ["A swift attacker that strikes from the shadows.", "Watch out for quick hits and opportunistic strikes."],
    art: goblin,
    enemyType: "normal",
  },
  {
    id: "imp",
    title: "Imp",
    subtitle: "Chaos Ember",
    descriptionLines: ["A mischievous flame spirit that dances around the battlefield.", "Its attacks leave lingering burn damage."],
    art: imp,
    enemyType: "normal",
  },
  {
    id: "lizard-scout",
    title: "Lizard Scout",
    subtitle: "Swamp Skirmisher",
    descriptionLines: ["A fast-moving hunter that strikes and retreats.", "Its poison weakens you over time."],
    art: lizardScout,
    enemyType: "normal",
  },
  {
    id: "mimic",
    title: "Mimic",
    subtitle: "Treasure Trap",
    descriptionLines: ["A cunning trap disguised as loot.", "Think twice before grabbing that shiny treasure!"],
    art: mimic,
    enemyType: "elite",
  },
  {
    id: "mud-elemental",
    title: "Mud Elemental",
    subtitle: "Swamp Golem",
    descriptionLines: ["A slow but resilient construct of mud and earth.", "Its thick shell reduces incoming damage."],
    art: mudElemental,
    enemyType: "elite",
  },
  {
    id: "necromancer",
    title: "Necromancer",
    subtitle: "Death Speaker",
    descriptionLines: ["A dark mage that manipulates life force.", "Watch out for cursed attacks that leech your health."],
    art: necromancer,
    enemyType: "elite",
  },
  {
    id: "plague-doctor",
    title: "Plague Doctor",
    subtitle: "Pestilence Carrier",
    descriptionLines: ["A masked healer of terrible diseases.", "Its miasma spreads poison to all who draw near."],
    art: plagueDoctor,
    enemyType: "elite",
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
