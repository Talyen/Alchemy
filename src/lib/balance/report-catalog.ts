import {
  cardLibrary,
  characters,
  companionLibrary,
  enemyBestiary,
  enemiesByType,
  getDifficultyModifiers,
  talentPool,
  trinketLibrary,
  type CharacterId,
  type DifficultyModifier,
} from "@/lib/game-data";
import { gearAffixList } from "@/lib/gear/affix-catalog";
import { gearBaseItemList } from "@/lib/gear";
import { hashStringToUint32 } from "@/lib/rng";
import type { TalentPreset } from "./simulator-types";

export const REPORT_ENEMY_TYPES = ["normal", "elite", "boss"] as const;
export type ReportEnemyType = (typeof REPORT_ENEMY_TYPES)[number];
type ReportTierLabel = "Early" | "Mid" | "Late";
export type ReportTierRecord<T> = Readonly<Record<TalentPreset, T>>;

export interface ReportTier {
  label: ReportTierLabel;
  preset: TalentPreset;
  depthOffset: number;
  difficultyModifiers: DifficultyModifier[];
}

export interface ReportMatchup {
  enemyId: string;
  enemyType: ReportEnemyType;
  depth: number;
}

const NORMAL_DIFFICULTY_MODIFIERS: DifficultyModifier[] = getDifficultyModifiers("knight", "difficulty-1");

export const REPORT_TIERS: readonly ReportTier[] = [
  { label: "Early", preset: "early", depthOffset: 0, difficultyModifiers: NORMAL_DIFFICULTY_MODIFIERS },
  { label: "Mid", preset: "mid", depthOffset: 8, difficultyModifiers: NORMAL_DIFFICULTY_MODIFIERS },
  { label: "Late", preset: "late", depthOffset: 16, difficultyModifiers: NORMAL_DIFFICULTY_MODIFIERS },
];

export function reportTierRecord<T>(valueFor: (preset: TalentPreset) => T): ReportTierRecord<T> {
  return {
    early: valueFor("early"),
    mid: valueFor("mid"),
    late: valueFor("late"),
  };
}

export function reportTierForPreset(preset: TalentPreset): ReportTier {
  const tier = REPORT_TIERS.find((entry) => entry.preset === preset);
  if (!tier) throw new Error(`Unknown report preset: ${preset}`);
  return tier;
}

export function reportCharacterIds(): CharacterId[] {
  return (Object.keys(characters) as CharacterId[]).sort();
}

export function coreMatchupsForTier(tier: ReportTier): ReportMatchup[] {
  const depths = { normal: [0, 3, 6], elite: [2, 5, 7], boss: [7] };
  return REPORT_ENEMY_TYPES.flatMap((enemyType) =>
    enemiesByType[enemyType].flatMap((enemy) =>
      depths[enemyType].map((depthDelta) => ({ enemyId: enemy.id, enemyType, depth: tier.depthOffset + depthDelta })),
    ),
  );
}

export function balanceScenarioSeed(namespace: string, ...parts: ReadonlyArray<string | number>): number {
  const identity = [namespace, ...parts].join("\u001f");
  const seed = hashStringToUint32(identity);
  return seed === 0 ? 1 : seed;
}

export function coreScenarioSeeds(options: {
  tier: TalentPreset;
  characterId: CharacterId;
  enemyId: string;
  depth: number;
  deckIndex: number;
}): { deckSeed: number; fightSeed: number } {
  const { tier, characterId, enemyId, depth, deckIndex } = options;
  return {
    deckSeed: balanceScenarioSeed("core-deck", tier, characterId, deckIndex),
    fightSeed: balanceScenarioSeed("core-fight", tier, characterId, enemyId, depth, deckIndex),
  };
}

export const BOON_GAUNTLET = [
  { enemyId: "skeleton", depthDelta: 1 },
  { enemyId: "goblin", depthDelta: 3 },
  { enemyId: "mimic", depthDelta: 5 },
  { enemyId: "iron-bear", depthDelta: 7 },
] as const;

export const IN_CLASS_CARD_GAUNTLET = [
  { enemyId: "skeleton", depthDelta: 1 },
  { enemyId: "mimic", depthDelta: 5 },
  { enemyId: "forge-golem", depthDelta: 7 },
] as const;

/** Canonical depth offset for gauntlet enemies. Isolated single-enemy sweeps use this so card deltas stay comparable across sweeps. */
export function gauntletDepthDeltaFor(enemyId: string): number {
  for (const scenario of [...BOON_GAUNTLET, ...IN_CLASS_CARD_GAUNTLET]) {
    if (scenario.enemyId === enemyId) return scenario.depthDelta;
  }
  return 2;
}

const TITLE_LOOKUPS = {
  enemy: new Map<string, string>(enemyBestiary.map((entry) => [entry.id, entry.title])),
  character: new Map<string, string>(Object.values(characters).map((entry) => [entry.id, entry.name])),
  boon: new Map<string, string>(trinketLibrary.map((entry) => [entry.id, entry.title])),
  card: new Map<string, string>(cardLibrary.map((entry) => [entry.id, entry.title])),
  companion: new Map<string, string>(Object.values(companionLibrary).map((entry) => [entry.id, entry.title])),
  affix: new Map<string, string>(gearAffixList.map((entry) => [entry.id, entry.name])),
  gear: new Map<string, string>(gearBaseItemList.map((entry) => [entry.id, entry.displayName])),
  talent: new Map<string, string | undefined>(talentPool.map((entry) => [entry.id, entry.name])),
};

export type TitleLookupKind = keyof typeof TITLE_LOOKUPS;

export function titleFor(kind: TitleLookupKind, id: string): string {
  return TITLE_LOOKUPS[kind].get(id) ?? id;
}
