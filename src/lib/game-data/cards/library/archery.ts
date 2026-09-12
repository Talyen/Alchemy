import type { BattleCard } from "../../types";
import * as assetRefs from "../../assets";
import * as cardBuilders from "../card-builders";

export const archeryCards: BattleCard[] = [
  {
    id: "fire-arrow",
    title: "Fire Arrow",
    art: assetRefs.fireArrow,
    cost: 1,
    descriptionLines: ["Deal 1 Burn damage", "Remove 2 enemy Armor", "Archery"],
    tags: ["archery"],
    effects: [
      { kind: "damage", damageType: "burn", amount: 1 },
      { kind: "remove-enemy-armor", amount: 2 },
    ],
  },
  {
    id: "ice-shot",
    title: "Ice Shot",
    art: assetRefs.iceShot,
    cost: 1,
    descriptionLines: ["Deal 1 Freeze damage", "Your next Archery card is free", "Archery"],
    tags: ["archery"],
    effects: [{ kind: "damage", damageType: "freeze", amount: 1 }, { kind: "next-archery-free" }],
  },
  {
    id: "venom-arrow",
    title: "Venom Arrow",
    art: assetRefs.venomArrow,
    cost: 1,
    descriptionLines: ["Deal 1 Poison damage", "Deal 2 Physical damage", "Archery"],
    tags: ["archery"],
    effects: [
      { kind: "damage", damageType: "poison", amount: 1 },
      { kind: "damage", damageType: "physical", amount: 2 },
    ],
  },
  cardBuilders.archeryDamageCard({
    id: "serrated-arrowhead",
    art: assetRefs.serratedArrowhead,
    damageType: "bleed",
    amount: 3,
  }),
  {
    id: "concussive-shot",
    title: "Concussive Shot",
    art: assetRefs.concussiveShot,
    cost: 1,
    descriptionLines: ["Deal 2 Stun damage", "Deal 2 Physical damage at the start of your next turn", "Archery"],
    tags: ["archery"],
    effects: [
      { kind: "damage", damageType: "stun", amount: 2 },
      {
        kind: "repeat-over-turns",
        remainingTurns: 1,
        effects: [{ kind: "damage", damageType: "physical", amount: 2 }],
      },
    ],
  },
  cardBuilders.archeryDamageCard({
    id: "lightning-arrow",
    art: assetRefs.lightningArrow,
    damageType: "nature",
    amount: 3,
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
  {
    id: "sap-arrow",
    title: "Sap Arrow",
    descriptionLines: ["Deal 2 Nature damage", "Leech", "Archery"],
    art: assetRefs.sapArrow,
    cost: 1,
    tags: ["archery"],
    effects: [{ kind: "damage", damageType: "nature", amount: 2, lifesteal: true }],
  },
  {
    id: "gamblers-shot",
    title: "Gambler's Shot",
    descriptionLines: ["Deal 1–6 Random damage", "Archery"],
    art: assetRefs.gamblersShot,
    cost: 1,
    tags: ["archery"],
    effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 6 }],
  },
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
