import type { BattleCard } from "../../types";
import * as assetRefs from "../../assets";
import * as cardBuilders from "../card-builders";

export const consumableCards: BattleCard[] = [
  cardBuilders.effectsCard("health-potion", [{ kind: "heal", amount: 8 }], { consume: true }),
  cardBuilders.effectsCard(
    "mana-berries",
    [
      { kind: "restore-mana", amount: 1 },
      { kind: "draw-cards", amount: 1 },
    ],
    { consume: true },
  ),
  cardBuilders.effectsCard("mana-crystals", [{ kind: "gain-max-mana", amount: 1 }], {
    art: assetRefs.manaCrystal,
    consume: true,
  }),
  cardBuilders.effectsCard("mana-potion", [{ kind: "restore-mana", amount: 2 }], { consume: true }),
  cardBuilders.effectsCard(
    "panacea-potion",
    [
      { kind: "remove-harmful-status", removeAll: true },
      { kind: "heal", amount: 2 },
    ],
    { consume: true },
  ),
  cardBuilders.effectsCard("stoneskin-potion", [{ kind: "player-status", status: "armor", amount: 4 }], {
    consume: true,
  }),
  cardBuilders.effectsCard(
    "acid-potion",
    [
      { kind: "remove-enemy-armor", halve: true },
      { kind: "damage", damageType: "poison", amount: 2 },
    ],
    { consume: true },
  ),
  cardBuilders.effectsCard(
    "apple",
    [
      { kind: "heal", amount: 4 },
      { kind: "remove-harmful-status", amount: 1 },
    ],
    { consume: true },
  ),
  cardBuilders.effectsCard("bread", [{ kind: "heal", amount: 6 }], { consume: true }),
  cardBuilders.effectsCard(
    "luck-potion",
    [
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
    { consume: true },
  ),
  cardBuilders.effectsCard("wishing-potion", [{ kind: "wish", amount: 2 }], { consume: true }),
  cardBuilders.effectsCard(
    "blood-offering",
    [
      { kind: "lose-health", amount: 1 },
      { kind: "draw-cards", amount: 2 },
      { kind: "restore-mana", amount: 1 },
    ],
    { consume: true },
  ),
  cardBuilders.effectsCard("faustian-bargain", [
    { kind: "lose-health", amount: 1 },
    { kind: "restore-mana", amount: 1 },
    { kind: "wish", amount: 1 },
  ]),
  cardBuilders.effectsCard("dark-pact", [
    { kind: "damage", damageType: "burn", amount: 3 },
    { kind: "lose-health", amount: 1 },
    { kind: "wish", amount: 1 },
  ]),
];
