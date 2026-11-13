import type { BattleCard } from "../../types";
import * as cardBuilders from "../card-builders";
import { cardMagnitude } from "../../card-description-model";

export const archeryCards: BattleCard[] = [
  cardBuilders.effectsCard("fire-arrow", [{ kind: "damage", damageType: "burn", amount: 1 }], { tags: ["archery"] }),
  cardBuilders.effectsCard(
    "ice-shot",
    [
      {
        kind: "damage",
        damageType: "freeze",
        amount: 3,
        damageTypeIfTargetFrozen: "freeze",
        amountIfTargetFrozen: 6,
      },
    ],
    { tags: ["archery"] },
  ),
  cardBuilders.effectsCard(
    "venom-arrow",
    [{ kind: "damage", damageType: "poison", damageTypePool: ["poison", "physical"], amount: 2 }],
    { tags: ["archery"] },
  ),
  cardBuilders.damageCard({
    id: "serrated-arrowhead",
    damageType: "bleed",
    amount: 2,
    tags: ["archery"],
  }),
  cardBuilders.effectsCard(
    "concussive-shot",
    [{ kind: "damage", damageType: "stun", damageTypePool: ["stun", "physical"], amount: 2 }],
    { tags: ["archery"] },
  ),
  cardBuilders.damageCard({
    id: "lightning-arrow",
    damageType: "nature",
    amount: 3,
    tags: ["archery"],
  }),
  cardBuilders.effectsCard(
    "bounty-shot",
    [
      { kind: "damage", damageType: "physical", amount: 2 },
      {
        kind: "chance",
        probability: 0.1,
        successEffects: [{ kind: "gain-gold", amount: 4 }],
        failureEffects: [],
      },
    ],
    {
      tags: ["archery"],
      describe: () => [
        {
          role: "effect",
          parts: ["Deal ", cardMagnitude({ effectIndex: 0, kind: "damage", field: "amount" }), " Physical damage"],
        },
        {
          role: "effect",
          parts: [
            "10% chance to Steal ",
            cardMagnitude({ effectIndex: 1, effectPath: [0], kind: "gain-gold", field: "amount" }),
            " Gold",
          ],
        },
      ],
    },
  ),
  cardBuilders.damageCard({
    id: "sap-arrow",
    damageType: "nature",
    amount: 2,
    lifesteal: true,
    tags: ["archery"],
  }),
  cardBuilders.effectsCard(
    "gamblers-shot",
    [{ kind: "random-damage", minAmount: 1, maxAmount: 4, damageTypePool: ["stun", "physical", "bleed"] }],
    { title: "Gambler's Shot", tags: ["archery"] },
  ),
  cardBuilders.effectsCard(
    "astral-arrow",
    [
      {
        kind: "damage",
        damageType: "holy",
        damageTypePool: ["freeze", "burn", "holy"],
        amount: 4,
      },
    ],
    { consume: true, tags: ["archery"] },
  ),
];
