import type { BattleCard } from "../../types";
import * as cardBuilders from "../card-builders";

export const defenseCards: BattleCard[] = [
  cardBuilders.effectsCard({
    id: "molten-bulwark",
    effects: [
      { kind: "player-status", status: "block", amount: 3 },
      { kind: "damage", damageType: "burn", amount: 1 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "glacial-ward",
    effects: [
      { kind: "player-status", status: "block", amount: 3 },
      { kind: "damage", damageType: "freeze", amount: 1 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "spiked-shield",
    effects: [
      { kind: "player-status", status: "block", amount: 2 },
      { kind: "player-status", status: "thorns", amount: 2 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "golden-plate",
    consume: true,
    effects: [
      { kind: "player-status", status: "armor", amount: 3 },
      { kind: "gain-gold", amount: 3 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "crystal-bulwark",
    effects: [
      { kind: "player-status", status: "block", amount: 0, perManaCrystal: 1 },
      { kind: "player-status", status: "armor", amount: 1 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "shadowstep",
    consume: true,
    effects: [{ kind: "dodge-next-attack" }, { kind: "play-next-card-twice" }],
  }),
  cardBuilders.effectsCard({
    id: "feint",
    effects: [{ kind: "dodge-next-attack" }, { kind: "draw-cards", amount: 2 }],
  }),

  cardBuilders.effectsCard({
    id: "mana-shield",
    effects: [{ kind: "player-status", status: "block", amount: 0, perManaCrystal: 2 }],
  }),
  cardBuilders.effectsCard({
    id: "prayer",
    consume: true,
    effects: [
      { kind: "wish", amount: 1 },
      { kind: "heal", amount: 3 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "smelling-salts",
    effects: [
      { kind: "remove-player-status", status: "stun" },
      { kind: "remove-player-status", status: "freeze" },
    ],
  }),
  cardBuilders.effectsCard({
    id: "cold-snap",
    effects: [
      { kind: "damage", damageType: "freeze", amount: 1 },
      { kind: "multiply-enemy-status", status: "freeze", factor: 2 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "sunder",
    effects: [
      { kind: "remove-enemy-armor", halve: true },
      { kind: "damage", damageType: "physical", amount: 3 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "smite",
    effects: [{ kind: "damage", damageType: "holy", damageTypePool: ["holy", "burn"], amount: 2 }],
  }),
  cardBuilders.effectsCard({
    id: "judgment",
    effects: [{ kind: "damage", damageType: "holy", damageTypePool: ["holy", "stun"], amount: 3 }],
  }),
];
