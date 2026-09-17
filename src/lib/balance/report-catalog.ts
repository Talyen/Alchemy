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
  const matchups: ReportMatchup[] = [];
  for (const enemy of enemiesByType.normal) {
    for (const depthDelta of [0, 3, 6]) {
      matchups.push({ enemyId: enemy.id, enemyType: "normal", depth: tier.depthOffset + depthDelta });
    }
  }
  for (const enemy of enemiesByType.elite) {
    for (const depthDelta of [2, 5, 7]) {
      matchups.push({ enemyId: enemy.id, enemyType: "elite", depth: tier.depthOffset + depthDelta });
    }
  }
  for (const enemy of enemiesByType.boss) {
    matchups.push({ enemyId: enemy.id, enemyType: "boss", depth: tier.depthOffset + 7 });
  }
  return matchups;
}

export function balanceScenarioSeed(namespace: string, ...parts: ReadonlyArray<string | number>): number {
  let hash = 2_166_136_261;
  const identity = [namespace, ...parts].join("\u001f");
  for (let index = 0; index < identity.length; index += 1) {
    hash = Math.imul(hash ^ identity.charCodeAt(index), 16_777_619);
  }
  const seed = hash >>> 0;
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
  enemy: Object.fromEntries(enemyBestiary.map((entry) => [entry.id, entry.title])),
  character: Object.fromEntries(Object.values(characters).map((entry) => [entry.id, entry.name])),
  boon: Object.fromEntries(trinketLibrary.map((entry) => [entry.id, entry.title])),
  card: Object.fromEntries(cardLibrary.map((entry) => [entry.id, entry.title])),
  companion: Object.fromEntries(Object.values(companionLibrary).map((entry) => [entry.id, entry.title])),
  affix: Object.fromEntries(gearAffixList.map((entry) => [entry.id, entry.name])),
  gear: Object.fromEntries(gearBaseItemList.map((entry) => [entry.id, entry.displayName])),
  talent: Object.fromEntries(talentPool.map((entry) => [entry.id, entry.name])),
};

export type TitleLookupKind = keyof typeof TITLE_LOOKUPS;

export function titleFor(kind: TitleLookupKind, id: string): string {
  return TITLE_LOOKUPS[kind][id] ?? id;
}
