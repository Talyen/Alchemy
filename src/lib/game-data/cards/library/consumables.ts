import type { BattleCard } from "../../types";
import * as assetRefs from "../../assets";
import * as cardBuilders from "../card-builders";

export const consumableCards: BattleCard[] = [
  cardBuilders.effectsCard({
    id: "health-potion",
    consume: true,
    effects: [{ kind: "heal", amount: 8 }],
  }),
  cardBuilders.effectsCard({
    id: "mana-berries",
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
    consume: true,
    effects: [{ kind: "restore-mana", amount: 2 }],
  }),
  cardBuilders.effectsCard({
    id: "panacea-potion",
    consume: true,
    effects: [
      { kind: "remove-harmful-status", removeAll: true },
      { kind: "heal", amount: 2 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "stoneskin-potion",
    consume: true,
    effects: [{ kind: "player-status", status: "armor", amount: 4 }],
  }),
  cardBuilders.effectsCard({
    id: "acid-potion",
    consume: true,
    effects: [
      { kind: "remove-enemy-armor", halve: true },
      { kind: "damage", damageType: "poison", amount: 2 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "apple",
    consume: true,
    effects: [
      { kind: "heal", amount: 4 },
      { kind: "remove-harmful-status", amount: 1 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "bread",
    consume: true,
    effects: [{ kind: "heal", amount: 6 }],
  }),
  cardBuilders.effectsCard({
    id: "luck-potion",
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
  }),
  cardBuilders.effectsCard({
    id: "wishing-potion",
    consume: true,
    effects: [{ kind: "wish", amount: 2 }],
  }),
  cardBuilders.effectsCard({
    id: "blood-offering",
    consume: true,
    effects: [
      { kind: "lose-health", amount: 1 },
      { kind: "draw-cards", amount: 2 },
      { kind: "restore-mana", amount: 1 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "faustian-bargain",
    consume: true,
    effects: [
      { kind: "lose-health", amount: 1 },
      { kind: "wish", amount: 2 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "dark-pact",
    effects: [
      { kind: "damage", damageType: "burn", amount: 2 },
      { kind: "lose-health", amount: 1 },
      { kind: "wish", amount: 1 },
    ],
  }),
];
