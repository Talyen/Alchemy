import type { BattleCard } from "../../types";
import * as assetRefs from "../../assets";
import * as cardBuilders from "../card-builders";

export const consumableCards: BattleCard[] = [
  cardBuilders.consumableCard({
    id: "health-potion",
    art: assetRefs.healthPotion,
    effect: { kind: "heal", amount: 8 },
  }),
  cardBuilders.consumableCard({
    id: "mana-berries",
    art: assetRefs.manaBerries,
    effect: { kind: "restore-mana", amount: 2 },
  }),
  cardBuilders.consumableCard({
    id: "mana-crystals",
    art: assetRefs.manaCrystal,
    effect: { kind: "gain-max-mana", amount: 1 },
  }),
  cardBuilders.consumableCard({
    id: "mana-potion",
    art: assetRefs.manaPotion,
    effect: { kind: "restore-mana", amount: 2 },
  }),
  cardBuilders.consumableCard({
    id: "panacea-potion",
    art: assetRefs.panaceaPotion,
    effect: { kind: "remove-harmful-status", amount: 5, removeAll: true },
  }),
  cardBuilders.consumableCard({
    id: "stoneskin-potion",
    art: assetRefs.stoneskinPotion,
    effect: { kind: "player-status", status: "armor", amount: 2 },
  }),
  cardBuilders.consumableCard({
    id: "acid-potion",
    art: assetRefs.acidPotion,
    effect: { kind: "damage", damageType: "poison", amount: 3 },
  }),
  cardBuilders.consumableCard({ id: "apple", art: assetRefs.apple, effect: { kind: "heal", amount: 8 } }),
  cardBuilders.consumableCard({ id: "bread", art: assetRefs.bread, effect: { kind: "heal", amount: 8 } }),
  cardBuilders.consumableCard({
    id: "luck-potion",
    art: assetRefs.luckPotion,
    effect: { kind: "gain-gold", amount: 7 },
  }),
  cardBuilders.consumableCard({
    id: "wishing-potion",
    art: assetRefs.wishingPotion,
    effect: { kind: "wish", amount: 1 },
  }),
  cardBuilders.loseHealthBenefitCard({ id: "blood-offering", art: assetRefs.bloodOffering, healthLoss: 1, draw: 2 }),
  cardBuilders.loseHealthBenefitCard({
    id: "faustian-bargain",
    art: assetRefs.faustianBargain,
    healthLoss: 2,
    wish: 2,
    consume: true,
  }),
  cardBuilders.loseHealthBenefitCard({
    id: "dark-pact",
    art: assetRefs.darkPact,
    healthLoss: 1,
    wish: 1,
    draw: 1,
  }),
];
