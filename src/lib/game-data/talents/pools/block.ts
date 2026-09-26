import { talentFor } from "../talent-builder";
import { addEffect, setEffect } from "../types";

const t = talentFor("block");

export const blockTalents = [
  t(
    "block-depleted-heal",
    "Second Wind",
    "When Block is depleted, restore 2 Health",
    "Wind",
    setEffect("blockDepletedHeal", 2),
  ),
  t(
    "block-absorb-physical",
    "Reinforce",
    "Block absorbs 10% more Physical damage",
    "ShieldCheck",
    setEffect("blockAbsorbPhysicalBonus", 10),
  ),
  t(
    "block-to-holy",
    "Sacred Shield",
    "Holy damage is increased by 10% of your Block",
    "Sun",
    setEffect("blockHolyDamagePercent", 10),
  ),
  t(
    "block-to-stun",
    "Impact Guard",
    "Stun damage is increased by 10% of your Block",
    "Zap",
    setEffect("blockStunDamagePercent", 10),
  ),
  t(
    "block-prevent-stun",
    "Grounding",
    "While you have Block, prevent Stun buildup",
    "Anchor",
    setEffect("blockPreventsStun", true),
  ),
  t(
    "block-to-physical",
    "Weighted Guard",
    "Physical damage is increased by 10% of your Block",
    "Weight",
    addEffect("blockToPhysicalDamageMultiplier", 0.1),
  ),
  t(
    "block-reduce-burn",
    "Sun-Struck Shield",
    "When attacks deplete your Block, reflect 30% of Block lost as Holy damage",
    "Flame",
    setEffect("holyReflectionBlockLostPercent", 30),
  ),
  t("block-start", "Footwork", "Gain 2 Block when you Dodge", "ChevronsUp", setEffect("dodgeBlockAmount", 2)),
  t(
    "block-prevent-bleed",
    "Coagulate",
    "While you have Block, Bleed damage taken is halved",
    "Droplets",
    setEffect("blockHalvesBleedDamage", true),
  ),
  t(
    "block-prevent-poison",
    "Detoxify",
    "While you have Block, Poison damage taken is halved",
    "FlaskConical",
    setEffect("blockHalvesPoisonDamage", true),
  ),
];
