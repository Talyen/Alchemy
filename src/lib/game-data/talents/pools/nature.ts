import { talentFor } from "../talent-builder";
import { addEffect, setEffect } from "../types";

const t = talentFor("nature");

export const natureTalents = [
  t(
    "nature-overgrowth",
    "Overgrowth",
    "Nature cards have a 10% chance to play twice",
    "TrendingUp",
    setEffect("natureCardPlayTwiceChance", 10),
  ),
  t(
    "nature-thornskin",
    "Thornskin",
    "Nature damage has a 10% chance to also grant Armor",
    "Hexagon",
    setEffect("armorOnNatureDamageChance", 10),
  ),
  t(
    "nature-natural-armor",
    "Bramblegrowth",
    "Nature damage has a 10% chance to also grant Thorns",
    "Shield",
    setEffect("thornsOnNatureDamageChance", 10),
  ),
  t(
    "nature-photosynthesis",
    "Photosynthesis",
    "Nature damage has a 10% chance to also restore Health",
    "Leaf",
    setEffect("healOnNatureDamageChance", 10),
  ),
  t(
    "nature-canopy",
    "Windstep",
    "When you Dodge, your next Nature card is free",
    "Feather",
    setEffect("nextNatureCardFreeOnDodge", true),
  ),
  t(
    "nature-briar-patch",
    "Briar Patch",
    "Nature damage has a 10% chance to also Bleed",
    "Triangle",
    setEffect("natureBleedChance", 10),
  ),
  t(
    "nature-toxic-pollen",
    "Toxic Pollen",
    "Nature damage has a 10% chance to also Poison",
    "Wind",
    setEffect("naturePoisonChance", 10),
  ),
  t(
    "nature-verdant-cycle",
    "Verdant Cycle",
    "Nature damage has a 10% chance to Leech",
    "RotateCw",
    addEffect("natureLeechChance", 10),
  ),
  t(
    "nature-ecosystem",
    "Ecosystem",
    "Draw a Nature card at the start of combat",
    "Network",
    setEffect("drawNatureCardAtCombatStart", true),
  ),
  t(
    "nature-entangle",
    "Entangle",
    "Nature damage has a 10% chance to also Stun",
    "Link",
    setEffect("natureStunChance", 10),
  ),
];
