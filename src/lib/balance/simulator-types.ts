import type { BattleCard, BestiaryEntry, CharacterId, TalentEffectManifest } from "@/lib/game-data";
import type { DifficultyModifier } from "@/lib/game-data";
import type { GearEffectManifest } from "@/lib/gear/gear-effect-manifest";
import type { BattleAnomalies } from "./anomalies";
import type { BalanceLoadoutMode } from "./loadout-preset";
import type { TalentPreset } from "./types";

export type BalancePlayPolicy = "random-playable" | "greedy-damage" | "defensive-random" | "greedy-effective-damage";
export type BattleSimulationOutcome = "win" | "loss" | "timeout";

export type { TalentPreset };
export interface BattleSimulationConfig {
  characterId: CharacterId;
  enemyId: string;
  deck?: BattleCard[];
  depth?: number;
  trinketIds?: string[];
  talentEffects?: TalentEffectManifest;
  talentPreset?: TalentPreset;
  loadoutMode?: BalanceLoadoutMode;
  gearEffects?: GearEffectManifest;
  difficultyModifiers?: DifficultyModifier[];
  seed?: number;
  maxTurns?: number;
  policy?: BalancePlayPolicy;
  playerHealth?: number;
  playerMaxHealth?: number;
  gold?: number;
  appliesFightPacing?: boolean;
}

export { ANOMALY_THRESHOLD_BY_PRESET, ANOMALY_METRICS, getAnomalyThreshold } from "./anomalies";

export interface BattleSimulationResult {
  characterId: CharacterId;
  enemyId: string;
  enemyType: BestiaryEntry["enemyType"];
  outcome: BattleSimulationOutcome;
  turns: number;
  playerHealth: number;
  playerMaxHealth: number;
  enemyHealth: number;
  enemyMaxHealth: number;
  cardsPlayed: Record<string, number>;
  totalCardsPlayed: number;
  trinketIds: string[];
  policy: BalancePlayPolicy;
  seed: number;
  anomalies: BattleAnomalies;
}

export type BalanceBatchConfig = Omit<BattleSimulationConfig, "seed"> & {
  iterations: number;
  seed?: number;
};

export interface BalanceBatchResult {
  config: BalanceBatchConfig;
  iterations: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  lossRate: number;
  timeoutRate: number;
  averageTurns: number;
  averageHealthRemaining: number;
  averageCardsPlayed: number;
  cardPlayCounts: Record<string, number>;
  results: BattleSimulationResult[];
}
