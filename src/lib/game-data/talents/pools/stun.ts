import { talentFor } from "../talent-builder";
import { setEffect } from "../types";

const t = talentFor("stun");

export const stunTalents = [
  t(
    "stun-forge-grant",
    "Riled Up",
    "If you have no Forge, Stunning an enemy grants 2 Forge",
    "Flame",
    setEffect("forgeOnStun", 2),
  ),
  t(
    "stun-double-damage",
    "Exploit Weakness",
    "Stunned enemies take double damage",
    "TrendingUp",
    setEffect("stunDoubleDamage", true),
  ),
  t(
    "stun-block-grant",
    "Guarded Counter",
    "If you have no Block, Stunning an enemy grants 4 Block",
    "Shield",
    setEffect("blockOnStun", 4),
  ),
  t(
    "stun-duration-1",
    "Extended Stun",
    "Stun effects last 1 turn longer",
    "Clock",
    setEffect("stunDurationExtension", 1),
  ),
  t(
    "stun-strip-armor",
    "Shatter Guard",
    "When you Stun an enemy, remove all its Armor",
    "ShieldOff",
    setEffect("stunStripArmor", true),
  ),
  t(
    "stun-damage-1",
    "Jarring Blow",
    "Stun cards have a 10% chance to play twice",
    "Bolt",
    setEffect("stunCardPlayTwiceChance", 10),
  ),
  t(
    "stun-next-free",
    "Free Follow-up",
    "When you Stun an enemy, your next card is free",
    "Gift",
    setEffect("nextCardFreeOnStun", true),
  ),
  t(
    "stun-threshold",
    "Concussive Force",
    "Stun threshold reduced by 10%",
    "Waves",
    setEffect("stunThresholdReduction", 0.1),
  ),
  t("stun-draw", "Stun Insight", "When you Stun an enemy, draw a card", "Eye", setEffect("drawOnStun", 1)),
  t(
    "stun-mana-grant",
    "Stun Surge",
    "If you have no Mana, Stunning an enemy grants 1 Mana",
    "PlugZap",
    setEffect("manaOnStun", 1),
  ),
];
