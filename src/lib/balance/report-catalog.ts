import {
  cardLibrary,
  characters,
  companionLibrary,
  enemyBestiary,
  trinketLibrary,
  type DifficultyModifier,
} from "@/lib/game-data";
import type { TalentPreset } from "./types";

const ADVENTURER_MODIFIERS: DifficultyModifier[] = [
  { kind: "enemy-health-multiplier", amount: 1.3 },
  { kind: "enemy-damage-multiplier", amount: 1.3 },
];

const LEGEND_MODIFIERS: DifficultyModifier[] = [
  { kind: "enemy-health-multiplier", amount: 2.8 },
  { kind: "enemy-damage-multiplier", amount: 1.6 },
];

export const REPORT_TIERS: ReadonlyArray<{
  label: "Early" | "Mid" | "Late";
  preset: TalentPreset;
  depthOffset: number;
  difficultyModifiers: DifficultyModifier[];
}> = [
  { label: "Early", preset: "early", depthOffset: 0, difficultyModifiers: [] },
  { label: "Mid", preset: "mid", depthOffset: 8, difficultyModifiers: ADVENTURER_MODIFIERS },
  { label: "Late", preset: "late", depthOffset: 16, difficultyModifiers: LEGEND_MODIFIERS },
];

export const BOON_GAUNTLET = [
  { enemyId: "skeleton", depthDelta: 1 },
  { enemyId: "goblin", depthDelta: 3 },
  { enemyId: "mimic", depthDelta: 5 },
  { enemyId: "iron-bear", depthDelta: 7 },
] as const;

export const TITLE_LOOKUPS = {
  enemy: Object.fromEntries(enemyBestiary.map((entry) => [entry.id, entry.title])),
  character: Object.fromEntries(Object.values(characters).map((entry) => [entry.id, entry.name])),
  boon: Object.fromEntries(trinketLibrary.map((entry) => [entry.id, entry.title])),
  card: Object.fromEntries(cardLibrary.map((entry) => [entry.id, entry.title])),
  companion: Object.fromEntries(Object.values(companionLibrary).map((entry) => [entry.id, entry.title])),
};
