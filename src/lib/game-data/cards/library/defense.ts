import type { BattleCard } from "../../types";
import * as assetRefs from "../../assets";
import * as cardBuilders from "../card-builders";

export const defenseCards: BattleCard[] = [
  cardBuilders.effectsCard({
    id: "molten-bulwark",
    art: assetRefs.moltenBulwark,
    effects: [
      { kind: "player-status", status: "block", amount: 3 },
      { kind: "damage", damageType: "burn", amount: 1 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "glacial-ward",
    art: assetRefs.glacialWard,
    effects: [
      { kind: "player-status", status: "block", amount: 3 },
      { kind: "damage", damageType: "freeze", amount: 1 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "spiked-shield",
    art: assetRefs.spikedShield,
    effects: [
      { kind: "player-status", status: "block", amount: 2 },
      { kind: "player-status", status: "thorns", amount: 2 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "golden-plate",
    art: assetRefs.goldenPlate,
    consume: true,
    effects: [
      { kind: "player-status", status: "armor", amount: 3 },
      { kind: "gain-gold", amount: 3 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "crystal-bulwark",
    art: assetRefs.crystalBulwark,
    effects: [{ kind: "player-status", status: "block", amount: 0, perManaCrystal: 1 }],
  }),
  cardBuilders.effectsCard({
    id: "shadowstep",
    art: assetRefs.shadowstep,
    consume: true,
    effects: [{ kind: "damage", damageType: "physical", amount: 1 }, { kind: "play-next-card-twice" }],
  }),
  cardBuilders.effectsCard({
    id: "mana-shield",
    art: assetRefs.manaShield,
    effects: [{ kind: "player-status", status: "block", amount: 0, convertCurrentMana: 3 }],
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
  cardBuilders.effectsCard({
    id: "smelling-salts",
    art: assetRefs.smellingSalts,
    effects: [
      { kind: "remove-player-status", status: "stun" },
      { kind: "remove-player-status", status: "freeze" },
    ],
  }),
  cardBuilders.effectsCard({
    id: "cold-snap",
    art: assetRefs.coldSnap,
    effects: [
      { kind: "damage", damageType: "freeze", amount: 1 },
      { kind: "multiply-enemy-status", status: "freeze", factor: 2 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "sunder",
    art: assetRefs.sunder,
    effects: [
      { kind: "remove-enemy-armor", halve: true },
      { kind: "damage", damageType: "physical", amount: 3 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "smite",
    art: assetRefs.smite,
    effects: [{ kind: "damage", damageType: "holy", damageTypePool: ["holy", "burn"], amount: 2 }],
  }),
  cardBuilders.effectsCard({
    id: "judgment",
    art: assetRefs.judgment,
    effects: [{ kind: "damage", damageType: "holy", damageTypePool: ["holy", "stun"], amount: 3 }],
  }),
];
