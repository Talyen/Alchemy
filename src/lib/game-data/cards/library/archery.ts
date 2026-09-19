import type { BattleCard } from "../../types";
import * as assetRefs from "../../assets";
import * as cardBuilders from "../card-builders";

export const archeryCards: BattleCard[] = [
  cardBuilders.effectsCard({
    id: "fire-arrow",
    art: assetRefs.fireArrow,
    tags: ["archery"],
    effects: [
      { kind: "damage", damageType: "burn", amount: 1 },
      { kind: "remove-enemy-armor", amount: 2 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "ice-shot",
    art: assetRefs.iceShot,
    tags: ["archery"],
    effects: [{ kind: "damage", damageType: "freeze", amount: 1 }, { kind: "next-archery-free" }],
  }),
  cardBuilders.effectsCard({
    id: "venom-arrow",
    art: assetRefs.venomArrow,
    tags: ["archery"],
    effects: [
      { kind: "damage", damageType: "poison", amount: 1 },
      { kind: "damage", damageType: "physical", amount: 2 },
    ],
  }),
  cardBuilders.damageCard({
    id: "serrated-arrowhead",
    art: assetRefs.serratedArrowhead,
    damageType: "bleed",
    amount: 3,
    tags: ["archery"],
  }),
  cardBuilders.effectsCard({
    id: "concussive-shot",
    art: assetRefs.concussiveShot,
    tags: ["archery"],
    effects: [
      { kind: "damage", damageType: "stun", amount: 2 },
      {
        kind: "repeat-over-turns",
        remainingTurns: 1,
        effects: [{ kind: "damage", damageType: "physical", amount: 2 }],
      },
    ],
    descriptionLines: ["Deal 2 Stun damage", "Deal 2 Physical damage at the start of your next turn"],
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
    effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 6 }],
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
