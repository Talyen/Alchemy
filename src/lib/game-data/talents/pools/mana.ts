import { talentFor } from "../talent-builder";
import { setEffect } from "../types";

const t = talentFor("mana");

export const manaTalents = [
  t(
    "mana-wellspring",
    "Wellspring",
    "When you end your turn with unspent Mana, keep 1 for next turn",
    "Droplets",
    setEffect("wellspringKeepMana", 1),
  ),
  t(
    "mana-bulwark",
    "Mana Bulwark",
    "Start each combat with Block equal to your Mana Crystals",
    "ShieldPlus",
    setEffect("manaBulwarkActive", true),
  ),
  t("mana-leylines", "Leyline Attunement", "Gain 1 Mana Crystal", "Atom", setEffect("startMana", 1)),
  t(
    "mana-arcane-wish",
    "Dark Recovery",
    "End your turn with no Mana to gain 1 extra Mana next turn",
    "Sparkles",
    setEffect("manaAfterEmptyTurn", 1),
  ),
  t(
    "mana-manaburn",
    "Manaburn",
    "Burn damage is increased by 25% of your Mana",
    "Flame",
    setEffect("burnDamagePerMana", 25),
  ),
  t(
    "mana-arcane-frost",
    "Arcane Frost",
    "Freeze damage is increased by 25% of your Mana",
    "Snowflake",
    setEffect("freezeDamagePerMana", 25),
  ),
  t(
    "mana-flare",
    "Mana Flare",
    "When you lose a Mana Crystal, deal 3 Burn damage",
    "Bomb",
    setEffect("burnDamageOnManaCrystalLoss", 3),
  ),
  t(
    "mana-familiar-bond",
    "Familiar Bond",
    "Companion damage has a 10% chance to gain 1 Mana",
    "PawPrint",
    setEffect("companionManaChance", 10),
  ),
  t(
    "mana-shell",
    "Mana Shell",
    "Start each combat with Armor equal to your Mana Crystals",
    "ShieldHalf",
    setEffect("manaShellActive", true),
  ),
  t(
    "mana-arcane-mending",
    "Arcane Mending",
    "Gaining Mana also restores Health",
    "Wand",
    setEffect("healthPerMana", 1),
  ),
];
