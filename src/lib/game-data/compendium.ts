import { blessedAegis, manaCrystal, meteor, poisonDagger, skeleton, steal } from "./assets";
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
