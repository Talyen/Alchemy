// Anomaly metric registry and peak sampling for balance simulation reports.
import type { BattleState, CombatTextEvent } from "@/lib/battle";

export type BattleAnomalies = {
  maxPlayerBlock: number;
  maxPlayerArmor: number;
  maxPlayerBurn: number;
  maxPlayerPoison: number;
  maxPlayerBleed: number;
  maxPlayerFreeze: number;
  maxPlayerStun: number;
  maxEnemyBurn: number;
  maxEnemyPoison: number;
  maxEnemyBleed: number;
  maxEnemyFreeze: number;
  maxEnemyStun: number;
  maxEnemyArmor: number;
  maxEnemyForge: number;
  maxEnemyFreezeBonus: number;
  maxEnemyBurnBonus: number;
  maxEnemyBlock: number;
  maxSingleHitDamageToEnemy: number;
  maxSingleHitDamageToPlayer: number;
  maxSingleHeal: number;
  maxSingleHitDamageToEnemyStat: string;
  maxSingleHitDamageToPlayerStat: string;
};

type NumericAnomalyKey = {
  [K in keyof BattleAnomalies]: BattleAnomalies[K] extends number ? K : never;
}[keyof BattleAnomalies];

type StatusAnomalyMetric = {
  key: NumericAnomalyKey;
  label: string;
  read: (state: BattleState) => number;
};

const STATUS_ANOMALY_METRICS: StatusAnomalyMetric[] = [
  { key: "maxPlayerBlock", label: "Block on Player", read: (s) => s.playerStatuses.block },
  { key: "maxPlayerArmor", label: "Armor on Player", read: (s) => s.playerStatuses.armor },
  { key: "maxPlayerBurn", label: "Burn on Player", read: (s) => s.playerStatuses.burn },
  { key: "maxPlayerPoison", label: "Poison on Player", read: (s) => s.playerStatuses.poison },
  { key: "maxPlayerBleed", label: "Bleed on Player", read: (s) => s.playerStatuses.bleed },
  { key: "maxPlayerFreeze", label: "Freeze on Player", read: (s) => s.playerStatuses.freeze },
  { key: "maxPlayerStun", label: "Stun on Player", read: (s) => s.playerStatuses.stun },
  { key: "maxEnemyBurn", label: "Burn on Enemy", read: (s) => s.enemyStatuses.burn },
  { key: "maxEnemyPoison", label: "Poison on Enemy", read: (s) => s.enemyStatuses.poison },
  { key: "maxEnemyBleed", label: "Bleed on Enemy", read: (s) => s.enemyStatuses.bleed },
  { key: "maxEnemyFreeze", label: "Freeze on Enemy", read: (s) => s.enemyStatuses.freeze },
  { key: "maxEnemyStun", label: "Stun on Enemy", read: (s) => s.enemyStatuses.stun },
  { key: "maxEnemyArmor", label: "Armor on Enemy", read: (s) => s.enemyMitigation.armor },
  { key: "maxEnemyForge", label: "Forge on Enemy", read: (s) => s.enemyMitigation.forge },
  { key: "maxEnemyFreezeBonus", label: "FreezeBonus on Enemy", read: (s) => s.enemyMitigation.freezeBonus },
  { key: "maxEnemyBurnBonus", label: "BurnBonus on Enemy", read: (s) => s.enemyMitigation.burnBonus },
  { key: "maxEnemyBlock", label: "Block on Enemy", read: (s) => s.enemyMitigation.block },
];

export const ANOMALY_METRICS: { key: keyof BattleAnomalies; label: string }[] = [
  ...STATUS_ANOMALY_METRICS.map(({ key, label }) => ({ key, label })),
  { key: "maxSingleHitDamageToEnemy", label: "Player→Enemy Dmg" },
  { key: "maxSingleHitDamageToPlayer", label: "Enemy→Player Dmg" },
  { key: "maxSingleHeal", label: "Player Heal" },
];

export type AnomalyPreset = "early" | "mid" | "late";

export const ANOMALY_THRESHOLD_BY_PRESET: Record<AnomalyPreset, number> = {
  early: 100,
  mid: 200,
  late: 300,
};

export function getAnomalyThreshold(preset: AnomalyPreset): number {
  return ANOMALY_THRESHOLD_BY_PRESET[preset];
}

export function createEmptyAnomalies(): BattleAnomalies {
  return {
    ...Object.fromEntries(ANOMALY_METRICS.map(({ key }) => [key, 0])),
    maxSingleHitDamageToEnemyStat: "",
    maxSingleHitDamageToPlayerStat: "",
  } as BattleAnomalies;
}

export function sampleAnomalies(state: BattleState, combatTexts: CombatTextEvent[], anomalies: BattleAnomalies): void {
  for (const metric of STATUS_ANOMALY_METRICS) {
    anomalies[metric.key] = Math.max(anomalies[metric.key], metric.read(state));
  }

  for (const ct of combatTexts) {
    if (ct.kind !== "damage" && ct.kind !== "heal") continue;
    if (ct.kind === "damage") {
      if (ct.target === "enemy") {
        if (ct.amount > anomalies.maxSingleHitDamageToEnemy) {
          anomalies.maxSingleHitDamageToEnemy = ct.amount;
          anomalies.maxSingleHitDamageToEnemyStat = ct.stat;
        }
      } else if (ct.amount > anomalies.maxSingleHitDamageToPlayer) {
        anomalies.maxSingleHitDamageToPlayer = ct.amount;
        anomalies.maxSingleHitDamageToPlayerStat = ct.stat;
      }
    } else {
      anomalies.maxSingleHeal = Math.max(anomalies.maxSingleHeal, ct.amount);
    }
  }
}
