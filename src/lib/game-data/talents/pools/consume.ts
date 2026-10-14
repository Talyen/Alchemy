import { talentFor } from "../talent-builder";
import { addEffect, setEffect } from "../types";

const t = talentFor("consume");

export const consumeTalents = [
  t(
    "consume-gourmand",
    "Gourmand",
    "Consume cards restore 20% more Health",
    "Apple",
    setEffect("consumeHealMultiplier", 0.2),
  ),
  t(
    "consume-last-supper",
    "Last Supper",
    "10% chance to gain 1 Forge when you Consume",
    "Gift",
    setEffect("forgeOnConsume", 1),
    setEffect("forgeOnConsumeChance", 10),
  ),
  t(
    "consume-volatility",
    "Volatility",
    "Consume cards deal 20% more damage",
    "Flame",
    setEffect("consumeDamageBonusPercent", 20),
  ),
  t(
    "consume-distillation",
    "Distillation",
    "Potions you Consume are 10% more potent",
    "FlaskConical",
    addEffect("potionPotency", 0.1),
  ),
  t(
    "consume-brewmaster",
    "Brewmaster",
    "Mixed Potions you Consume are 10% more potent",
    "Wine",
    addEffect("mixedPotionPotency", 0.1),
  ),
  t("consume-aftertaste", "Aftertaste", "Restore 1 Health when you Consume", "Cookie", setEffect("healOnConsume", 1)),
  t(
    "consume-leftovers",
    "Leftovers",
    "10% chance to gain 4 Gold when you Consume",
    "Package",
    setEffect("goldOnConsume", 4),
    setEffect("goldOnConsumeChance", 10),
  ),
  t(
    "consume-second-helping",
    "Second Helping",
    "10% chance to draw a card when you Consume",
    "CopyPlus",
    setEffect("drawOnConsume", 1),
    setEffect("drawOnConsumeChance", 10),
  ),
  t(
    "consume-rotgut",
    "Rotgut",
    "Your Poison Potions deal 2 additional Poison damage",
    "FlaskRound",
    setEffect("poisonDamageOnConsume", 2),
  ),
  t(
    "consume-feast",
    "Feast",
    "Apple and Bread restore twice as much Health",
    "CookingPot",
    setEffect("cardHealMultipliers", { apple: 1, bread: 1 }),
  ),
];
