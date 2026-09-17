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
    effects: [
      { kind: "restore-mana", amount: 1 },
      { kind: "draw-cards", amount: 1 },
    ],
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
    effect: { kind: "remove-harmful-status", removeAll: true },
  }),
  cardBuilders.consumableCard({
    id: "stoneskin-potion",
    art: assetRefs.stoneskinPotion,
    effect: { kind: "player-status", status: "armor", amount: 4 },
  }),
  cardBuilders.consumableCard({
    id: "acid-potion",
    art: assetRefs.acidPotion,
    effects: [
      { kind: "remove-enemy-armor", removeAll: true },
      { kind: "damage", damageType: "poison", amount: 1 },
    ],
  }),
  cardBuilders.consumableCard({
    id: "apple",
    art: assetRefs.apple,
    effects: [
      { kind: "heal", amount: 4 },
      { kind: "remove-harmful-status", amount: 1 },
    ],
  }),
  cardBuilders.consumableCard({
    id: "bread",
    art: assetRefs.bread,
    effects: [
      { kind: "heal", amount: 4 },
      { kind: "repeat-over-turns", remainingTurns: 2, effects: [{ kind: "heal", amount: 4 }] },
    ],
    descriptionLines: ["Restore 4 Health", "Restore 4 Health at the start of each of your next 2 turns"],
  }),
  cardBuilders.consumableCard({
    id: "luck-potion",
    art: assetRefs.luckPotion,
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
    descriptionLines: ["Gain 4 Mana or gain 4 Gold or gain 4 Block"],
  }),
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
