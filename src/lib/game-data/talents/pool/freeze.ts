// Talent definitions for keyword: freeze.
import type { TalentDefinition } from "../types";
import { addEffect, setEffect } from "../types";

export const freezeTalents: TalentDefinition[] = [
  {
    id: "freeze-threshold",
    keywordId: "freeze",
    name: "Bitter Cold",
    description: "Freeze threshold reduced by 10%",
    effects: [setEffect("freezeThresholdReduction", 0.1)],
  },
  {
    id: "freeze-double-damage",
    keywordId: "freeze",
    name: "Shatter",
    description: "Frozen enemies take double damage",
    effects: [setEffect("freezeDoubleDamage", true)],
  },
  {
    id: "freeze-start-amount",
    keywordId: "freeze",
    name: "Winter's Grasp",
    description: "Start each combat by applying 4 Freeze to the enemy",
    effects: [setEffect("startFreeze", 4)],
  },
  {
    id: "freeze-block-grant",
    keywordId: "freeze",
    name: "Frost Ward",
    description: "Gain 6 Block when you Freeze an enemy",
    effects: [setEffect("blockOnFreeze", 6)],
  },
  {
    id: "freeze-companion-bonus",
    keywordId: "freeze",
    name: "Snow Pack",
    description: "Your Companion deals 1 additional damage to Frozen enemies",
    effects: [addEffect("companionVsFrozenBonus", 1)],
  },
  {
    id: "freeze-strip-armor",
    keywordId: "freeze",
    name: "Brittle Armor",
    description: "Frozen enemies lose all Armor",
    effects: [setEffect("freezeStripArmor", true)],
  },
  {
    id: "freeze-half-damage",
    keywordId: "freeze",
    name: "Cold Resistance",
    description: "Receive half Freeze damage",
    effects: [setEffect("receiveHalfFreezeBuildUp", true)],
  },
  {
    id: "freeze-poison-preserve",
    keywordId: "freeze",
    name: "Cryo-preservation",
    description: "Poison stacks on Frozen enemies cannot decay",
    effects: [setEffect("freezePreventsPoisonDecay", true)],
  },
  {
    id: "freeze-prevent-scaling",
    keywordId: "freeze",
    name: "Glacial Encasement",
    description: "Frozen enemies cannot gain Forge or Armor",
    effects: [setEffect("freezePreventsEnemyScaling", true)],
  },
  {
    id: "freeze-block-healing",
    keywordId: "freeze",
    name: "Permafrost",
    description: "Frozen enemies cannot restore Health",
    effects: [setEffect("freezeBlocksRegen", true)],
  },
];
