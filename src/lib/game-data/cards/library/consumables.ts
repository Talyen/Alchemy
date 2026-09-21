import type { BattleCard } from "../../types";
import * as assetRefs from "../../assets";
import * as cardBuilders from "../card-builders";

export const consumableCards: BattleCard[] = [
  cardBuilders.effectsCard({
    id: "health-potion",
    art: assetRefs.healthPotion,
    consume: true,
    effects: [{ kind: "heal", amount: 8 }],
  }),
  cardBuilders.effectsCard({
    id: "mana-berries",
    art: assetRefs.manaBerries,
    consume: true,
    effects: [
      { kind: "restore-mana", amount: 1 },
      { kind: "draw-cards", amount: 1 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "mana-crystals",
    art: assetRefs.manaCrystal,
    consume: true,
    effects: [{ kind: "gain-max-mana", amount: 1 }],
  }),
  cardBuilders.effectsCard({
    id: "mana-potion",
    art: assetRefs.manaPotion,
    consume: true,
    effects: [{ kind: "restore-mana", amount: 2 }],
  }),
  cardBuilders.effectsCard({
    id: "panacea-potion",
    art: assetRefs.panaceaPotion,
    consume: true,
    effects: [{ kind: "remove-harmful-status", removeAll: true }],
  }),
  cardBuilders.effectsCard({
    id: "stoneskin-potion",
    art: assetRefs.stoneskinPotion,
    consume: true,
    effects: [{ kind: "player-status", status: "armor", amount: 4 }],
  }),
  cardBuilders.effectsCard({
    id: "acid-potion",
    art: assetRefs.acidPotion,
    consume: true,
    effects: [
      { kind: "remove-enemy-armor", halve: true },
      { kind: "damage", damageType: "poison", amount: 2 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "apple",
    art: assetRefs.apple,
    consume: true,
    effects: [
      { kind: "heal", amount: 4 },
      { kind: "remove-harmful-status", amount: 1 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "bread",
    art: assetRefs.bread,
    consume: true,
    effects: [{ kind: "heal", amount: 6 }],
  }),
  cardBuilders.effectsCard({
    id: "luck-potion",
    art: assetRefs.luckPotion,
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
    descriptionLines: ["Gain 4 Mana, Gold, or Block"],
  }),
  cardBuilders.effectsCard({
    id: "wishing-potion",
    art: assetRefs.wishingPotion,
    consume: true,
    effects: [
      { kind: "wish", amount: 1 },
      { kind: "draw-cards", amount: 1 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "blood-offering",
    art: assetRefs.bloodOffering,
    effects: [
      { kind: "lose-health", amount: 1 },
      { kind: "draw-cards", amount: 2 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "faustian-bargain",
    art: assetRefs.faustianBargain,
    consume: true,
    effects: [
      { kind: "lose-health", amount: 1 },
      { kind: "wish", amount: 2 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "dark-pact",
    art: assetRefs.darkPact,
    effects: [
      { kind: "damage", damageType: "burn", amount: 1 },
      { kind: "lose-health", amount: 1 },
      { kind: "wish", amount: 1 },
    ],
  }),
];
