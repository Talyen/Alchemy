import type { BattleCard } from "../../types";
import * as cardBuilders from "../card-builders";

export const defenseCards: BattleCard[] = [
  cardBuilders.effectsCard("molten-bulwark", [
    { kind: "player-status", status: "block", amount: 3 },
    { kind: "damage", damageType: "burn", amount: 1 },
  ]),
  cardBuilders.effectsCard("glacial-ward", [
    { kind: "player-status", status: "block", amount: 3 },
    { kind: "damage", damageType: "freeze", amount: 1 },
  ]),
  cardBuilders.effectsCard("spiked-shield", [
    { kind: "player-status", status: "block", amount: 2 },
    { kind: "player-status", status: "thorns", amount: 2 },
  ]),
  cardBuilders.effectsCard(
    "golden-plate",
    [
      { kind: "player-status", status: "armor", amount: 3 },
      { kind: "gain-gold", amount: 3 },
    ],
    { consume: true },
  ),
  cardBuilders.effectsCard("crystal-bulwark", [
    { kind: "player-status", status: "block", amount: 0, perManaCrystal: 1 },
    { kind: "player-status", status: "armor", amount: 1 },
  ]),
  cardBuilders.effectsCard("shadowstep", [{ kind: "dodge-next-attack" }, { kind: "play-next-card-twice" }], {
    consume: true,
  }),
  cardBuilders.effectsCard("feint", [{ kind: "dodge-next-attack" }, { kind: "draw-cards", amount: 2 }]),

  cardBuilders.effectsCard("mana-shield", [{ kind: "player-status", status: "block", amount: 0, perManaCrystal: 2 }]),
  cardBuilders.effectsCard(
    "prayer",
    [
      { kind: "wish", amount: 1 },
      { kind: "heal", amount: 3 },
    ],
    { consume: true },
  ),
  cardBuilders.effectsCard("smelling-salts", [
    { kind: "remove-player-status", status: "stun" },
    { kind: "remove-player-status", status: "freeze" },
  ]),
  cardBuilders.effectsCard("cold-snap", [
    { kind: "damage", damageType: "freeze", amount: 1 },
    { kind: "multiply-enemy-status", status: "freeze", factor: 2 },
  ]),
  cardBuilders.effectsCard("sunder", [
    { kind: "remove-enemy-armor", halve: true },
    { kind: "damage", damageType: "physical", amount: 3 },
  ]),
  cardBuilders.effectsCard("smite", [
    { kind: "damage", damageType: "holy", damageTypePool: ["holy", "burn"], amount: 2 },
  ]),
  cardBuilders.effectsCard("judgment", [
    { kind: "damage", damageType: "holy", damageTypePool: ["holy", "stun"], amount: 3 },
  ]),
];
