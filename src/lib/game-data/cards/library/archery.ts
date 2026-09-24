import type { BattleCard } from "../../types";
import * as assetRefs from "../../assets";
import * as cardBuilders from "../card-builders";

export const archeryCards: BattleCard[] = [
  cardBuilders.effectsCard({
    id: "fire-arrow",
    art: assetRefs.fireArrow,
    tags: ["archery"],
    effects: [{ kind: "damage", damageType: "burn", amount: 1 }],
  }),
  cardBuilders.effectsCard({
    id: "ice-shot",
    art: assetRefs.iceShot,
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
    art: assetRefs.venomArrow,
    tags: ["archery"],
    effects: [{ kind: "damage", damageType: "poison", damageTypePool: ["poison", "physical"], amount: 2 }],
  }),
  cardBuilders.damageCard({
    id: "serrated-arrowhead",
    art: assetRefs.serratedArrowhead,
    damageType: "bleed",
    amount: 2,
    tags: ["archery"],
  }),
  cardBuilders.effectsCard({
    id: "concussive-shot",
    art: assetRefs.concussiveShot,
    tags: ["archery"],
    effects: [{ kind: "damage", damageType: "stun", damageTypePool: ["stun", "physical"], amount: 2 }],
  }),
  cardBuilders.damageCard({
    id: "lightning-arrow",
    art: assetRefs.lightningArrow,
    damageType: "nature",
    amount: 3,
    tags: ["archery"],
  }),
  cardBuilders.effectsCard({
    id: "bounty-shot",
    art: assetRefs.bountyShot,
    tags: ["archery"],
    effects: [
      { kind: "damage", damageType: "physical", amount: 2 },
      { kind: "gain-gold", amount: 2 },
    ],
  }),
  cardBuilders.damageCard({
    id: "sap-arrow",
    art: assetRefs.sapArrow,
    damageType: "nature",
    amount: 2,
    lifesteal: true,
    tags: ["archery"],
  }),
  cardBuilders.effectsCard({
    id: "gamblers-shot",
    title: "Gambler's Shot",
    art: assetRefs.gamblersShot,
    tags: ["archery"],
    effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 4, damageTypePool: ["stun", "physical", "bleed"] }],
  }),
  cardBuilders.effectsCard({
    id: "astral-arrow",
    art: assetRefs.astralArrow,
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
