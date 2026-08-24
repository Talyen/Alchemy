import { capitalizeWord } from "@/lib/utils";
import type { BattleCard, BattleCardEffect } from "../../types";

export interface CardBaseInput {
  id: BattleCard["id"];
  title?: string;
  art: BattleCard["art"];
  cost?: number;
}
export function deriveTitle(id: string, customTitle?: string): string {
  if (customTitle) return customTitle;
  const base = id.endsWith("-companion") ? id.slice(0, -10) : id;
  return base.split("-").map(capitalizeWord).join(" ");
}
export type PlayerStatusDescriptionStatus = "block" | "armor" | "forge";

export function playerStatusDescriptionLine(status: PlayerStatusDescriptionStatus, amount: number): string {
  switch (status) {
    case "block":
      return `Gain ${amount} Block`;
    case "armor":
      return `Gain ${amount} Armor`;
    case "forge":
      return `Gain ${amount} Forge`;
  }
}

type EffectDescLineFormatter<K extends BattleCardEffect["kind"]> = (
  effect: Extract<BattleCardEffect, { kind: K }>,
) => string;

const EFFECT_DESCRIPTION_FORMATTERS: {
  [K in BattleCardEffect["kind"]]: EffectDescLineFormatter<K>;
} = {
  heal: (effect) => `Restore ${effect.amount} Health`,
  "restore-mana": (effect) => `Restore ${effect.amount} Mana`,
  "gain-max-mana": (effect) => `Gain ${effect.amount} Maximum Mana`,
  "remove-harmful-status": (effect) =>
    effect.removeAll
      ? "Remove all harmful status effects"
      : `Remove ${effect.amount} harmful status effect${effect.amount === 1 ? "" : "s"}`,
  "player-status": (effect) => {
    if (effect.status === "block" || effect.status === "armor" || effect.status === "forge")
      return playerStatusDescriptionLine(effect.status, effect.amount);
    throw new Error(`effectDescriptionLine: unsupported player-status kind ${effect.status}`);
  },
  damage: (effect) => `Deal ${effect.amount} ${capitalizeWord(effect.damageType)} damage`,
  "gain-gold": (effect) => `Gain ${effect.amount} Gold`,
  wish: (effect) => `Wish ${effect.amount}`,
  "enemy-status": () => unsupportedEffectKind("enemy-status"),
  "lose-mana": () => unsupportedEffectKind("lose-mana"),
  "lose-max-mana": () => unsupportedEffectKind("lose-max-mana"),
  "summon-companion": () => unsupportedEffectKind("summon-companion"),
  "buff-companion": () => unsupportedEffectKind("buff-companion"),
  "lose-health": () => unsupportedEffectKind("lose-health"),
  "draw-cards": () => unsupportedEffectKind("draw-cards"),
  "remove-enemy-armor": (effect) => `Strip ${effect.amount} enemy Armor`,
  "multiply-enemy-status": () => unsupportedEffectKind("multiply-enemy-status"),
  "remove-player-status": () => unsupportedEffectKind("remove-player-status"),
  "self-damage": () => unsupportedEffectKind("self-damage"),
  "cleanse-player-status-to-damage": () => unsupportedEffectKind("cleanse-player-status-to-damage"),
  "random-damage": () => unsupportedEffectKind("random-damage"),
  chance: () => unsupportedEffectKind("chance"),
  "repeat-over-turns": () => unsupportedEffectKind("repeat-over-turns"),
  "next-hit-crit": () => "Your next damaging card is a critical strike",
  "play-next-card-twice": () => "Your next card is played twice",
  "next-hit-poison": () => "Your next attack is converted to Poison damage",
};

function unsupportedEffectKind(kind: string): never {
  throw new Error(`effectDescriptionLine: unsupported effect kind ${kind}`);
}

export function effectDescriptionLine(effect: BattleCardEffect): string {
  return EFFECT_DESCRIPTION_FORMATTERS[effect.kind](effect as never);
}
