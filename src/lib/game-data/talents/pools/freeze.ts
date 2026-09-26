import { talentFor } from "../talent-builder";
import { setEffect } from "../types";

const t = talentFor("freeze");

export const freezeTalents = [
  t(
    "freeze-threshold",
    "Bitter Cold",
    "Enemy Freeze threshold is reduced by 10%",
    "ThermometerSnowflake",
    setEffect("freezeThresholdReduction", 0.1),
  ),
  t(
    "freeze-double-damage",
    "Shatter",
    "Frozen enemies take 1 additional damage",
    "Split",
    setEffect("freezeDamageBonusVsFrozen", 1),
  ),
  t(
    "freeze-start-amount",
    "Winter's Grasp",
    "Freeze cards have a 10% chance to play twice",
    "MountainSnow",
    setEffect("freezeCardPlayTwiceChance", 10),
  ),
  t(
    "freeze-block-grant",
    "Icebound",
    "When you Freeze an enemy, remove all its Block",
    "Snowflake",
    setEffect("freezeStripBlock", true),
  ),
  t(
    "freeze-companion-bonus",
    "Snow Pack",
    "Companions deal 1 additional damage against Frozen enemies",
    "CloudSnow",
    setEffect("companionVsFrozenBonus", 1),
  ),
  t(
    "freeze-strip-armor",
    "Brittle Armor",
    "When you Freeze an enemy, remove all its Armor",
    "ShieldOff",
    setEffect("freezeStripArmor", true),
  ),
  t(
    "freeze-half-damage",
    "Cold Resistance",
    "Take half Freeze damage",
    "Thermometer",
    setEffect("receiveHalfFreezeDamage", true),
  ),
  t(
    "freeze-poison-preserve",
    "Cryo-preservation",
    "Poison does not decay on Frozen enemies",
    "FlaskConical",
    setEffect("freezePreventsPoisonDecay", true),
  ),
  t(
    "freeze-prevent-scaling",
    "Thaw Dividend",
    "When an enemy recovers from Freeze, draw a card",
    "Hexagon",
    setEffect("drawOnThaw", 1),
  ),
  t(
    "freeze-block-healing",
    "Glacial Barrier",
    "When you Freeze an enemy, gain 3 Block",
    "Lock",
    setEffect("blockOnFreeze", 3),
  ),
];
