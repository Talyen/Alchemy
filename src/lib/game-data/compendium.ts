import { blessedAegis, goblin, imp, lizardScout, manaCrystal, mimic, mudElemental, necromancer, plagueDoctor, skeleton, steal } from "./assets";
import type { BestiaryEntry, TrinketEntry } from "./types";

export const enemyBestiary: BestiaryEntry[] = [
  {
    id: "skeleton",
    title: "Skeleton",
    subtitle: "Normal",
    descriptionLines: ["Trait — Brittle Bones: Receives double Holy and Stun damage.", "Attacks for physical damage each turn."],
    art: skeleton,
    enemyType: "normal",
    traits: [{ id: "brittle-bones", title: "Brittle Bones", description: "Receives double Holy and Stun damage." }],
    attackEffects: [],
  },
  {
    id: "goblin",
    title: "Goblin",
    subtitle: "Normal",
    descriptionLines: ["Trait — Fear the Light: Receives double Burn and Holy damage.", "Attacks for physical damage each turn."],
    art: goblin,
    enemyType: "normal",
    traits: [{ id: "fear-the-light", title: "Fear the Light", description: "Receives double Burn and Holy damage." }],
    attackEffects: [],
  },
  {
    id: "imp",
    title: "Imp",
    subtitle: "Normal",
    descriptionLines: ["Attack — Fiery Claws: Deal 2 Burn and 1 Physical.", "Trait — Burn Resistance: Receives half Burn damage."],
    art: imp,
    enemyType: "normal",
    traits: [{ id: "burn-resistance", title: "Burn Resistance", description: "Receives half Burn damage." }],
    attackEffects: [
      { kind: "damage", damageType: "physical", amount: 1 },
      { kind: "player-status", status: "burn", amount: 2 },
    ],
  },
  {
    id: "lizard-scout",
    title: "Lizard Scout",
    subtitle: "Normal",
    descriptionLines: ["Attack — Poison Dart: Deal 1 Poison and 1 Physical.", "Trait — Poison Resistance: Receives half Poison damage."],
    art: lizardScout,
    enemyType: "normal",
    traits: [{ id: "poison-resistance", title: "Poison Resistance", description: "Receives half Poison damage." }],
    attackEffects: [
      { kind: "damage", damageType: "physical", amount: 1 },
      { kind: "player-status", status: "poison", amount: 1 },
    ],
  },
  {
    id: "mimic",
    title: "Mimic",
    subtitle: "Elite",
    descriptionLines: ["Trait — Gold Trove: Gain 1 Gold when damaging a Mimic.", "Attacks for physical damage each turn."],
    art: mimic,
    enemyType: "elite",
    traits: [{ id: "gold-trove", title: "Gold Trove", description: "Gain 1 Gold when damaging a Mimic." }],
    attackEffects: [],
  },
  {
    id: "mud-elemental",
    title: "Mud Elemental",
    subtitle: "Elite",
    descriptionLines: ["Attack — Mudslide: Deals 2 Stun and 2 Poison.", "Trait — Regeneration: Gains 2 Health at the end of each of its turns."],
    art: mudElemental,
    enemyType: "elite",
    traits: [{ id: "regeneration", title: "Regeneration", description: "Gains 2 Health at the end of each of its turns." }],
    attackEffects: [
      { kind: "player-status", status: "stun", amount: 2 },
      { kind: "player-status", status: "poison", amount: 2 },
    ],
  },
  {
    id: "necromancer",
    title: "Necromancer",
    subtitle: "Elite",
    descriptionLines: ["Attack — Life Drain: Deal 2 Leech and 2 Bleed.", "Trait — Holy Vulnerability: Receives double Holy damage."],
    art: necromancer,
    enemyType: "elite",
    traits: [{ id: "holy-vulnerability", title: "Holy Vulnerability", description: "Receives double Holy damage." }],
    attackEffects: [
      { kind: "damage", damageType: "physical", amount: 2, lifesteal: true },
      { kind: "player-status", status: "bleed", amount: 2 },
    ],
  },
  {
    id: "plague-doctor",
    title: "Plague Doctor",
    subtitle: "Elite",
    descriptionLines: ["Attack — Poison Attack: Deal 2 Poison.", "Trait — Poison Resistance: Receives half Poison damage."],
    art: plagueDoctor,
    enemyType: "elite",
    traits: [{ id: "poison-resistance", title: "Poison Resistance", description: "Receives half Poison damage." }],
    attackEffects: [
      { kind: "player-status", status: "poison", amount: 2 },
    ],
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
