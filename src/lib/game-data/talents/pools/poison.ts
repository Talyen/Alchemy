import { talentFor } from "../talent-builder";
import { setEffect } from "../types";

const t = talentFor("poison");

export const poisonTalents = [
  t(
    "poison-leech-chance",
    "Hemotoxin",
    "Poison has a 10% chance to also deal Bleed damage",
    "Biohazard",
    setEffect("poisonBleedDamageChance", 10),
  ),
  t(
    "poison-physical-bonus",
    "Corrosive",
    "Poisoned enemies take 1 additional damage",
    "Droplets",
    setEffect("poisonDamageBonusVsPoisoned", 1),
  ),
  t(
    "poison-strip-armor",
    "Caustic",
    "Poison damage removes enemy Armor equal to damage dealt",
    "FlaskRound",
    setEffect("poisonStripArmorByDamage", true),
  ),
  t(
    "poison-half-damage",
    "Toxin Resistance",
    "Take half Poison damage",
    "Shield",
    setEffect("receiveHalfPoisonDamage", true),
  ),
  t(
    "poison-gold-first",
    "Toxic Profit",
    "Gain 3 Gold when you defeat a Poisoned enemy",
    "Coins",
    setEffect("goldOnPoisonedKill", 3),
  ),
  t(
    "poison-heal-reduce",
    "Necrosis",
    "Poisoned enemies restore half as much Health",
    "Skull",
    setEffect("poisonHalvesHealing", true),
  ),
  t(
    "poison-stun-chance",
    "Paralytic Venom",
    "Poison damage has a 10% chance to Stun",
    "Lock",
    setEffect("poisonStunChance", 10),
  ),
  t(
    "poison-gain-chance",
    "Virulent",
    "Poison has a 10% chance to gain instead of lose a stack",
    "TrendingUp",
    setEffect("poisonGainChance", 10),
  ),
  t(
    "poison-reduce-damage",
    "Torpor",
    "Poisoned enemies cannot Dodge",
    "Moon",
    setEffect("poisonPreventsEnemyDodge", true),
  ),
  t(
    "poison-first-free",
    "Venom Strike",
    "Poison cards have a 10% chance to play twice",
    "Syringe",
    setEffect("poisonCardPlayTwiceChance", 10),
  ),
];
