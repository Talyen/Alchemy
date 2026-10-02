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
    "When you Consume your last card in hand, gain 3 Forge (except cards that summon a Companion)",
    "Gift",
    setEffect("forgeOnConsume", 3),
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
  t(
    "consume-aftertaste",
    "Aftertaste",
    "When you Consume a card, restore 1 Health (except cards that summon a Companion)",
    "Cookie",
    setEffect("healOnConsume", 1),
  ),
  t(
    "consume-leftovers",
    "Leftovers",
    "Consuming a card has a 25% chance to grant 4 Gold (except cards that summon a Companion)",
    "Package",
    setEffect("goldOnConsume", 4),
  ),
  t(
    "consume-second-helping",
    "Second Helping",
    "When you Consume a card, draw a card (except cards that summon a Companion)",
    "CopyPlus",
    setEffect("uncappedDrawOnConsume", 1),
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
