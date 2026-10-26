import type { BattleCard } from "../../types";
import * as cardBuilders from "../card-builders";
import { cardMagnitude } from "../../card-description-model";

export const archeryCards: BattleCard[] = [
  cardBuilders.effectsCard({
    id: "fire-arrow",
    tags: ["archery"],
    effects: [{ kind: "damage", damageType: "burn", amount: 1 }],
  }),
  cardBuilders.effectsCard({
    id: "ice-shot",
    tags: ["archery"],
    effects: [
      {
        kind: "damage",
        damageType: "freeze",
        amount: 2,
        damageTypeIfTargetFrozen: "freeze",
        amountIfTargetFrozen: 4,
      },
    ],
  }),
  cardBuilders.effectsCard({
    id: "venom-arrow",
    tags: ["archery"],
    effects: [{ kind: "damage", damageType: "poison", damageTypePool: ["poison", "physical"], amount: 2 }],
  }),
  cardBuilders.damageCard({
    id: "serrated-arrowhead",
    damageType: "bleed",
    amount: 2,
    tags: ["archery"],
  }),
  cardBuilders.effectsCard({
    id: "concussive-shot",
    tags: ["archery"],
    effects: [{ kind: "damage", damageType: "stun", damageTypePool: ["stun", "physical"], amount: 2 }],
  }),
  cardBuilders.damageCard({
    id: "lightning-arrow",
    damageType: "nature",
    amount: 3,
    tags: ["archery"],
  }),
  cardBuilders.effectsCard({
    id: "bounty-shot",
    tags: ["archery"],
    effects: [
      { kind: "damage", damageType: "physical", amount: 2 },
      {
        kind: "chance",
        probability: 0.1,
        successEffects: [{ kind: "gain-gold", amount: 4 }],
        failureEffects: [],
      },
    ],
    describe: () => [
      {
        role: "effect",
        parts: ["Deal ", cardMagnitude({ effectIndex: 0, kind: "damage", field: "amount" }), " Physical damage"],
      },
      {
        role: "effect",
        parts: [
          "10% chance to Steal ",
          cardMagnitude({ effectIndex: 1, effectPath: [0], kind: "gain-gold", field: "amount" }),
          " Gold",
        ],
      },
    ],
  }),
  cardBuilders.damageCard({
    id: "sap-arrow",
    damageType: "nature",
    amount: 2,
    lifesteal: true,
    tags: ["archery"],
  }),
  cardBuilders.effectsCard({
    id: "gamblers-shot",
    title: "Gambler's Shot",
    tags: ["archery"],
    effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 4, damageTypePool: ["stun", "physical", "bleed"] }],
  }),
  cardBuilders.effectsCard({
    id: "astral-arrow",
    consume: true,
    tags: ["archery"],
    effects: [
      {
        kind: "damage",
        damageType: "holy",
        damageTypePool: ["freeze", "burn", "holy"],
        amount: 4,
      },
    ],
  }),
];
