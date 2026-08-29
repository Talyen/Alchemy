import type { BattleCard } from "../../types";
import * as assetRefs from "../../assets";
import * as cardBuilders from "../card-builders";

export const archeryCards: BattleCard[] = [
  cardBuilders.archeryDamageCard({
    id: "fire-arrow",
    art: assetRefs.fireArrow,
    damageType: "burn",
    amount: 2,
  }),
  cardBuilders.archeryDamageCard({
    id: "ice-shot",
    art: assetRefs.iceShot,
    damageType: "freeze",
    amount: 2,
  }),
  cardBuilders.archeryDamageCard({
    id: "venom-arrow",
    art: assetRefs.venomArrow,
    damageType: "poison",
    amount: 2,
  }),
  cardBuilders.archeryDamageCard({
    id: "serrated-arrowhead",
    art: assetRefs.serratedArrowhead,
    damageType: "bleed",
    amount: 2,
  }),
  cardBuilders.archeryDamageCard({
    id: "concussive-shot",
    art: assetRefs.concussiveShot,
    damageType: "stun",
    amount: 3,
  }),
  cardBuilders.archeryDamageCard({
    id: "lightning-arrow",
    art: assetRefs.lightningArrow,
    damageType: "nature",
    amount: 2,
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
      { kind: "damage", damageType: "stun", amount: 2 },
      { kind: "damage", damageType: "freeze", amount: 2 },
      { kind: "damage", damageType: "burn", amount: 2 },
    ],
  }),
];
