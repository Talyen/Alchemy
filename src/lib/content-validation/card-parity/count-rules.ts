import type { BattleCardEffect } from "@/lib/game-data";
import { countByKind, countHealLines, countLinesStartingWith } from "./helpers";

interface CountParityRule {
  label: string;
  countLines: (lines: string[]) => number;
  countEffects: (effects: BattleCardEffect[]) => number;
}

export const COUNT_PARITY_RULES: CountParityRule[] = [
  {
    label: "heal",
    countLines: countHealLines,
    countEffects: (effects) => countByKind(effects, "heal"),
  },
  {
    label: "restore-mana",
    countLines: (lines) => lines.filter((line) => line.startsWith("Restore ") && !line.includes("Health")).length,
    countEffects: (effects) => countByKind(effects, "restore-mana"),
  },
  {
    label: "gain-gold",
    countLines: (lines) =>
      lines.filter((line) => (line.startsWith("Gain ") || line.startsWith("Steal ")) && line.includes("Gold")).length +
      lines.filter((line) => line.includes(" or Gain ") && line.includes("Gold")).length,
    countEffects: (effects) => countByKind(effects, "gain-gold"),
  },
  {
    label: "wish",
    countLines: (lines) => countLinesStartingWith(lines, "Wish "),
    countEffects: (effects) => countByKind(effects, "wish"),
  },
  {
    label: "remove-harmful-status",
    countLines: (lines) =>
      lines.filter(
        (line) => line.startsWith("Remove ") || (line.startsWith("Cleanse ") && line.includes("harmful status")),
      ).length,
    countEffects: (effects) => countByKind(effects, "remove-harmful-status"),
  },
  {
    label: "lose-max-mana",
    countLines: (lines) => lines.filter((line) => line.startsWith("Lose ") && line.includes("Mana Crystal")).length,
    countEffects: (effects) => countByKind(effects, "lose-max-mana"),
  },
  {
    label: "gain-max-mana",
    countLines: (lines) => lines.filter((line) => line.includes("Maximum Mana")).length,
    countEffects: (effects) => countByKind(effects, "gain-max-mana"),
  },
  {
    label: "lose-health",
    countLines: (lines) => lines.filter((line) => line.startsWith("Lose ") && line.includes("Health")).length,
    countEffects: (effects) => countByKind(effects, "lose-health"),
  },
  {
    label: "draw-cards",
    countLines: (lines) => countLinesStartingWith(lines, "Draw "),
    countEffects: (effects) => countByKind(effects, "draw-cards"),
  },
  {
    label: "remove-enemy-armor",
    countLines: (lines) => countLinesStartingWith(lines, "Strip "),
    countEffects: (effects) => countByKind(effects, "remove-enemy-armor"),
  },
  {
    label: "multiply-enemy-status",
    countLines: (lines) => countLinesStartingWith(lines, "Double "),
    countEffects: (effects) => countByKind(effects, "multiply-enemy-status"),
  },
  {
    label: "remove-player-status",
    countLines: (lines) =>
      lines.filter((line) => line.startsWith("Cleanse ") && !line.includes("harmful status")).length,
    countEffects: (effects) =>
      countByKind(effects, "remove-player-status") + countByKind(effects, "cleanse-player-status-to-damage"),
  },
  {
    label: "block",
    countLines: (lines) =>
      lines.filter(
        (line) =>
          line.startsWith("Gain ") &&
          line.includes(" Block") &&
          !line.includes("per Mana Crystal") &&
          !line.endsWith("each turn"),
      ).length,
    countEffects: (effects) =>
      effects.filter(
        (effect) => effect.kind === "player-status" && effect.status === "block" && effect.perManaCrystal === undefined,
      ).length,
  },
  {
    label: "per-mana block",
    countLines: (lines) => lines.filter((line) => line.includes("per Mana Crystal")).length,
    countEffects: (effects) =>
      effects.filter(
        (effect) => effect.kind === "player-status" && effect.status === "block" && effect.perManaCrystal !== undefined,
      ).length,
  },
  {
    label: "armor",
    countLines: (lines) => lines.filter((line) => line.startsWith("Gain ") && line.includes(" Armor")).length,
    countEffects: (effects) =>
      effects.filter((effect) => effect.kind === "player-status" && effect.status === "armor").length,
  },
  {
    label: "forge",
    countLines: (lines) => lines.filter((line) => line.startsWith("Gain ") && line.includes(" Forge")).length,
    countEffects: (effects) =>
      effects.filter((effect) => effect.kind === "player-status" && effect.status === "forge").length,
  },
];
