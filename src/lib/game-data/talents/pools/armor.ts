import { talentFor } from "../talent-builder";
import { setEffect } from "../types";

const t = talentFor("armor");

export const armorTalents = [
  t(
    "armor-desperate-double",
    "Last Stand",
    "Gain 25% more Armor while below half Health",
    "HeartCrack",
    setEffect("armorLowHealthBonusPercent", 25),
  ),
  t(
    "armor-block-burst",
    "Armored Surge",
    "Gaining Block has a 10% chance to also grant that amount of Armor",
    "Shield",
    setEffect("armorOnBlockChance", 10),
  ),
  t(
    "armor-burn-mitigate",
    "Fireward",
    "Armor mitigates Burn damage taken",
    "Flame",
    setEffect("armorMitigatesBurn", true),
  ),
  t(
    "armor-break-block",
    "Reactive Guard",
    "When Armor breaks, gain 3 Block",
    "ShieldPlus",
    setEffect("armorBreakBlock", 3),
  ),
  t("armor-start-combat", "Bulwark", "Start each combat with 2 Armor", "Square", setEffect("startArmor", 2)),
  t(
    "armor-mitigate-bleed",
    "Thick Hide",
    "Armor mitigates Bleed damage taken",
    "Hexagon",
    setEffect("armorMitigatesBleed", true),
  ),
  t(
    "armor-first-double",
    "Iron Guard",
    "Dealing Physical damage has a 10% chance to also grant that amount of Armor",
    "Lock",
    setEffect("armorOnPhysicalDamageChance", 10),
  ),
  t(
    "armor-mitigate-stun",
    "Steadfast",
    "When your Health falls below half, gain 3 Armor",
    "Anchor",
    setEffect("healthThresholdArmor", [{ threshold: 50, amount: 3 }]),
  ),
  t(
    "armor-cleanse-threshold",
    "Purification",
    "Gaining Armor has a 10% chance to Cleanse a harmful status effect",
    "Sparkles",
    setEffect("armorCleanseChance", 10),
  ),
  t("armor-flat-bonus", "Reinforced", "10% chance to double Armor gained", "Plus", setEffect("armorDoubleChance", 10)),
];
