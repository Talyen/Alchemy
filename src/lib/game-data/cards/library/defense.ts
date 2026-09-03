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
  {
    id: "crystal-bulwark",
    title: "Crystal Bulwark",
    descriptionLines: ["Gain 1 Block per Mana Crystal"],
    art: assetRefs.crystalBulwark,
    cost: 1,
    effects: [{ kind: "player-status", status: "block", amount: 0, perManaCrystal: 1 }],
  },
  cardBuilders.effectsCard({
    id: "shadowstep",
    art: assetRefs.shadowstep,
    consume: true,
    effects: [{ kind: "play-next-card-twice" }],
  }),
  {
    id: "mana-shield",
    title: "Mana Shield",
    descriptionLines: ["Convert each of your Mana into 3 Block"],
    art: assetRefs.manaShield,
    cost: 1,
    effects: [{ kind: "player-status", status: "block", amount: 0, convertCurrentMana: 3 }],
  },
  cardBuilders.effectsCard({
    id: "prayer",
    art: assetRefs.prayer,
    effects: [
      { kind: "wish", amount: 1 },
      { kind: "heal", amount: 3 },
    ],
  }),
  cardBuilders.singleEffectCard({
    id: "smelling-salts",
    art: assetRefs.smellingSalts,
    effect: { kind: "remove-player-status", status: "stun" },
    descriptionLine: "Cleanse Stun build-up",
  }),
  cardBuilders.damageThenMultiplyEnemyStatusCard({
    id: "cold-snap",
    art: assetRefs.coldSnap,
    damageType: "freeze",
    damageAmount: 1,
    status: "freeze",
    factor: 2,
    multiplyLine: "Double enemy's Freeze build-up",
  }),
  cardBuilders.effectsCard({
    id: "sunder",
    art: assetRefs.sunder,
    effects: [
      { kind: "damage", damageType: "physical", amount: 4 },
      { kind: "remove-enemy-armor", amount: 2 },
    ],
  }),
  cardBuilders.dualDamageCard({
    id: "smite",
    art: assetRefs.smite,
    hits: [
      { damageType: "holy", amount: 2 },
      { damageType: "burn", amount: 2 },
    ],
  }),
  cardBuilders.dualDamageCard({
    id: "judgment",
    art: assetRefs.judgment,
    hits: [
      { damageType: "holy", amount: 3 },
      { damageType: "stun", amount: 1 },
    ],
  }),
];
