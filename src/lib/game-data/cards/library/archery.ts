import type { BattleCard } from "../../types";
import * as cardBuilders from "../card-builders";

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
      { kind: "gain-gold", amount: 2 },
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
