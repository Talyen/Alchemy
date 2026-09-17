import type { BattleCard } from "../../types";
import * as assetRefs from "../../assets";
import * as cardBuilders from "../card-builders";

export const defenseCards: BattleCard[] = [
  cardBuilders.statusThenEffectCard({
    id: "molten-bulwark",
    art: assetRefs.moltenBulwark,
    status: "block",
    amount: 3,
    effect: { kind: "damage", damageType: "burn", amount: 1 },
  }),
  cardBuilders.statusThenEffectCard({
    id: "glacial-ward",
    art: assetRefs.glacialWard,
    status: "block",
    amount: 3,
    effect: { kind: "damage", damageType: "freeze", amount: 1 },
  }),
  cardBuilders.statusThenEffectCard({
    id: "spiked-shield",
    art: assetRefs.spikedShield,
    status: "block",
    amount: 2,
    effect: { kind: "player-status", status: "thorns", amount: 2 },
  }),
  cardBuilders.statusThenEffectCard({
    id: "golden-plate",
    art: assetRefs.goldenPlate,
    status: "armor",
    amount: 1,
    effect: { kind: "gain-gold", amount: 2 },
  }),
  cardBuilders.singleEffectCard({
    id: "crystal-bulwark",
    art: assetRefs.crystalBulwark,
    effect: { kind: "player-status", status: "block", amount: 0, perManaCrystal: 1 },
    descriptionLine: "Gain 1 Block per Mana Crystal",
  }),
  cardBuilders.effectsCard({
    id: "shadowstep",
    art: assetRefs.shadowstep,
    consume: true,
    effects: [{ kind: "play-next-card-twice" }],
  }),
  cardBuilders.singleEffectCard({
    id: "mana-shield",
    art: assetRefs.manaShield,
    effect: { kind: "player-status", status: "block", amount: 0, convertCurrentMana: 3 },
    descriptionLine: "Convert each of your Mana into 3 Block",
  }),
  cardBuilders.effectsCard({
    id: "prayer",
    art: assetRefs.prayer,
    consume: true,
    effects: [
      { kind: "wish", amount: 1 },
      { kind: "heal", amount: 3 },
    ],
  }),
  cardBuilders.singleEffectCard({
    id: "smelling-salts",
    art: assetRefs.smellingSalts,
    effect: { kind: "remove-player-status", status: "stun" },
    descriptionLine: "Cleanse Stun buildup",
  }),
  cardBuilders.effectsCard({
    id: "cold-snap",
    art: assetRefs.coldSnap,
    effects: [
      { kind: "damage", damageType: "freeze", amount: 1 },
      { kind: "multiply-enemy-status", status: "freeze", factor: 2 },
    ],
    descriptionLines: ["Deal 1 Freeze damage", "Double enemy's Freeze buildup"],
  }),
  cardBuilders.effectsCard({
    id: "sunder",
    art: assetRefs.sunder,
    effects: [
      { kind: "remove-enemy-armor", amount: 2 },
      { kind: "damage", damageType: "physical", amount: 4 },
    ],
  }),
  cardBuilders.dualDamageCard({
    id: "smite",
    art: assetRefs.smite,
    hits: [
      { damageType: "holy", amount: 2 },
      { damageType: "burn", amount: 1 },
    ],
  }),
  cardBuilders.dualDamageCard({
    id: "judgment",
    art: assetRefs.judgment,
    hits: [
      { damageType: "holy", amount: 2 },
      { damageType: "stun", amount: 1 },
    ],
  }),
];
