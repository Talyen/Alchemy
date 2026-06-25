import type { BattleCard } from "../types";
import {
  acidPotion,
  cleanse,
  fangs,
  fireball,
  frostbolt,
  haste,
  heal,
  healthPotion,
  manaBerries,
  manaCrystal,
  manaPotion,
  panaceaPotion,
  poisonDagger,
  slash,
  stab,
  stoneskinPotion,
} from "../assets";
import { consumableCard, damageCard, singleEffectCard } from "./card-builders";

export const cardLibraryPart1: BattleCard[] = [
  damageCard({ id: "slash", art: slash, damageType: "physical", amount: 6 }),
  damageCard({ id: "stab", art: stab, damageType: "bleed", amount: 2 }),
  singleEffectCard({
    id: "cleanse",
    art: cleanse,
    effect: { kind: "remove-harmful-status", amount: 1 },
    descriptionLine: "Cleanse 1 harmful status effect",
  }),
  singleEffectCard({ id: "heal", art: heal, effect: { kind: "heal", amount: 4 } }),
  {
    id: "haste",
    title: "Haste",
    descriptionLines: ["Take an extra turn after this one", "Consume"],
    art: haste,
    cost: 1,
    consume: true,
    effects: [{ kind: "player-status", status: "haste", amount: 1 }],
  },
  damageCard({ id: "poison-dagger", art: poisonDagger, damageType: "poison", amount: 2 }),
  damageCard({ id: "fireball", art: fireball, damageType: "burn", amount: 3 }),
  damageCard({ id: "fangs", art: fangs, damageType: "physical", amount: 3, lifesteal: true }),
  damageCard({ id: "frostbolt", art: frostbolt, damageType: "freeze", amount: 3 }),
  consumableCard({
    id: "health-potion",
    art: healthPotion,
    effect: { kind: "heal", amount: 8 },
  }),
  consumableCard({
    id: "mana-berries",
    art: manaBerries,
    effect: { kind: "restore-mana", amount: 2 },
  }),
  consumableCard({
    id: "mana-crystals",
    art: manaCrystal,
    effect: { kind: "gain-max-mana", amount: 1 },
  }),
  consumableCard({
    id: "mana-potion",
    art: manaPotion,
    effect: { kind: "restore-mana", amount: 2 },
  }),
  consumableCard({
    id: "panacea-potion",
    art: panaceaPotion,
    effect: { kind: "remove-harmful-status", amount: 1 },
  }),
  consumableCard({
    id: "stoneskin-potion",
    art: stoneskinPotion,
    effect: { kind: "player-status", status: "armor", amount: 2 },
  }),
  consumableCard({
    id: "acid-potion",
    art: acidPotion,
    effect: { kind: "damage", damageType: "poison", amount: 3 },
  }),
];
