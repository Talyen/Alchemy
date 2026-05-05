import { blessedAegis, goblin, imp, lizardScout, manaCrystal, mimic, mudElemental, necromancer, plagueDoctor, skeleton, steal } from "./assets";
import type { BestiaryEntry, TrinketEntry } from "./types";

export const enemyBestiary: BestiaryEntry[] = [
  {
    id: "skeleton",
    title: "Skeleton",
    subtitle: "Normal",
    descriptionLines: ["Attacks for 8 damage each turn."],
    art: skeleton,
    enemyType: "normal",
  },
  {
    id: "goblin",
    title: "Goblin",
    subtitle: "Normal",
    descriptionLines: ["Attacks for 8 damage each turn."],
    art: goblin,
    enemyType: "normal",
  },
  {
    id: "imp",
    title: "Imp",
    subtitle: "Normal",
    descriptionLines: ["Attacks for 8 damage each turn."],
    art: imp,
    enemyType: "normal",
  },
  {
    id: "lizard-scout",
    title: "Lizard Scout",
    subtitle: "Normal",
    descriptionLines: ["Attacks for 8 damage each turn."],
    art: lizardScout,
    enemyType: "normal",
  },
  {
    id: "mimic",
    title: "Mimic",
    subtitle: "Elite",
    descriptionLines: ["A devious trap that deals heavy damage. Attacks for 10 damage each turn."],
    art: mimic,
    enemyType: "elite",
  },
  {
    id: "mud-elemental",
    title: "Mud Elemental",
    subtitle: "Elite",
    descriptionLines: ["A resilient construct built of mud and stone. Attacks for 10 damage each turn."],
    art: mudElemental,
    enemyType: "elite",
  },
  {
    id: "necromancer",
    title: "Necromancer",
    subtitle: "Elite",
    descriptionLines: ["A dark mage wielding forbidden life magic. Attacks for 10 damage each turn."],
    art: necromancer,
    enemyType: "elite",
  },
  {
    id: "plague-doctor",
    title: "Plague Doctor",
    subtitle: "Elite",
    descriptionLines: ["A masked carrier of pestilence and plague. Attacks for 10 damage each turn."],
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
