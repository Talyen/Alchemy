// Talent definitions for keyword: consume.
import type { TalentDefinition } from "../types";
import { addEffect, setEffect, placeholderTalents } from "../types";

export const consumeTalents: TalentDefinition[] = [
  {
    id: "consume-gourmand",
    keywordId: "consume",
    name: "Gourmand",
    description: "Consume cards heal 20% more",
    effects: [setEffect("consumeHealMultiplier", 0.2)],
  },
  {
    id: "consume-last-supper",
    keywordId: "consume",
    name: "Last Supper",
    description: "Your first Consume card each combat is free",
    effects: [setEffect("firstConsumeCardFree", true)],
  },
  {
    id: "consume-volatility",
    keywordId: "consume",
    name: "Volatility",
    description: "Consume cards deal 20% more damage",
    effects: [setEffect("consumeDamageBonusPercent", 20)],
  },
  {
    id: "consume-distillation",
    keywordId: "consume",
    name: "Distillation",
    description: "Potions are 20% more potent",
    effects: [addEffect("potionPotency", 0.2)],
  },
  {
    id: "consume-brewmaster",
    keywordId: "consume",
    name: "Brewmaster",
    description: "Mixed Potion potency is increased by 1",
    effects: [addEffect("potionMixPotency", 1)],
  },
  ...placeholderTalents("consume", "consume", 6, 10),
];
