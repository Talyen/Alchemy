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
  {
    id: "mana-berries",
    title: "Mana Berries",
    art: assetRefs.manaBerries,
    cost: 1,
    descriptionLines: ["Gain 1 Mana", "Draw a card", "Consume"],
    consume: true,
    effects: [
      { kind: "restore-mana", amount: 1 },
      { kind: "draw-cards", amount: 1 },
    ],
  },
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
    effect: { kind: "player-status", status: "armor", amount: 4 },
  }),
  cardBuilders.consumableCard({
    id: "acid-potion",
    art: assetRefs.acidPotion,
    effect: { kind: "damage", damageType: "poison", amount: 3 },
  }),
  {
    id: "apple",
    title: "Apple",
    art: assetRefs.apple,
    cost: 1,
    descriptionLines: ["Restore 4 Health", "Cleanse 1 harmful status effect", "Consume"],
    consume: true,
    effects: [
      { kind: "heal", amount: 4 },
      { kind: "remove-harmful-status", amount: 1 },
    ],
  },
  {
    id: "bread",
    title: "Bread",
    art: assetRefs.bread,
    cost: 1,
    descriptionLines: ["Restore 4 Health", "Restore 4 Health at the start of each of your next 2 turns", "Consume"],
    consume: true,
    effects: [
      { kind: "heal", amount: 4 },
      { kind: "repeat-over-turns", remainingTurns: 2, effects: [{ kind: "heal", amount: 4 }] },
    ],
  },
  {
    id: "luck-potion",
    title: "Luck Potion",
    descriptionLines: ["Gain 4 Mana or gain 4 Gold or gain 4 Block", CONSUME_DESCRIPTION_LINE],
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
    effect: { kind: "wish", amount: 2 },
  }),
  cardBuilders.loseHealthBenefitCard({ id: "blood-offering", art: assetRefs.bloodOffering, healthLoss: 1, draw: 2 }),
  cardBuilders.loseHealthBenefitCard({
    id: "faustian-bargain",
    art: assetRefs.faustianBargain,
    healthLoss: 2,
    wish: 3,
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
