import { MANABURN_DAMAGE_PERCENT } from "@/lib/game-constants";
import { talent } from "../talent-builder";
import { setEffect } from "../types";

export const manaTalents = [
  talent(
    "mana-wellspring",
    "mana",
    "Wellspring",
    "When you end your turn with unspent Mana, keep 1 for next turn",
    "Droplets",
    setEffect("wellspringKeepMana", 1),
  ),
  talent(
    "mana-bulwark",
    "mana",
    "Mana Bulwark",
    "Start each combat with Block equal to your Mana Crystals",
    "ShieldPlus",
    setEffect("manaBulwarkActive", true),
  ),
  talent("mana-leylines", "mana", "Leyline Attunement", "Gain 1 Mana Crystal", "Atom", setEffect("startMana", 1)),
  talent(
    "mana-arcane-wish",
    "mana",
    "Dark Recovery",
    "End your turn with no Mana to gain 1 extra Mana next turn",
    "Sparkles",
    setEffect("manaAfterEmptyTurn", 1),
  ),
  talent(
    "mana-manaburn",
    "mana",
    "Manaburn",
    `Burn damage is increased by ${MANABURN_DAMAGE_PERCENT}% of your Mana Crystals`,
    "Flame",
    setEffect("burnDamagePerManaCrystal", MANABURN_DAMAGE_PERCENT),
  ),
  talent(
    "mana-arcane-frost",
    "mana",
    "Arcane Frost",
    "Freeze damage is increased by 25% of your Mana Crystals",
    "Snowflake",
    setEffect("freezeDamagePerManaCrystal", 0.5),
  ),
  talent(
    "mana-flare",
    "mana",
    "Mana Flare",
    "When you lose a Mana Crystal, deal 3 Burn damage",
    "Bomb",
    setEffect("burnDamageOnManaCrystalLoss", 3),
  ),
  talent(
    "mana-familiar-bond",
    "mana",
    "Familiar Bond",
    "Companion damage is increased by a quarter of your Mana Crystals",
    "PawPrint",
    setEffect("companionDamagePerManaCrystal", 0.5),
  ),
  talent(
    "mana-shell",
    "mana",
    "Mana Shell",
    "Start each combat with Armor equal to your Mana Crystals",
    "ShieldHalf",
    setEffect("manaShellActive", true),
  ),
  talent(
    "mana-arcane-mending",
    "mana",
    "Arcane Mending",
    "When you gain Mana from zero, restore 2 Health",
    "Wand",
    setEffect("healOnManaGain", 2),
  ),
];
