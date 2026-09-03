import type { BattleCard } from "../../types";
import { CONSUME_DESCRIPTION_LINE } from "@/lib/game-constants";
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
  {
    id: "luck-potion",
    title: "Luck Potion",
    descriptionLines: ["Restore 4 Mana or Steal 4 Gold or Gain 4 Block", CONSUME_DESCRIPTION_LINE],
    art: assetRefs.luckPotion,
    cost: 1,
    consume: true,
    effects: [
      {
        kind: "chance",
        probability: 0.5,
        successEffects: [{ kind: "restore-mana", amount: 4 }],
        failureEffects: [
          {
            kind: "chance",
            probability: 0.5,
            successEffects: [{ kind: "gain-gold", amount: 4 }],
            failureEffects: [{ kind: "player-status", status: "block", amount: 4 }],
          },
        ],
      },
    ],
  },
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
