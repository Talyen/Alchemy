import type { BattleSnapshot, CombatTextEvent } from "@/lib/battle";
import type { TalentPreset } from "./simulator-types";
import { createNumericManifest } from "@/lib/manifest-utils";

export interface BattleAnomalies {
  enemyHealing: number;
  heroHealthDamage: number;
  enemyBlockGranted: number;
  enemyArmorGranted: number;
  maxPlayerBlock: number;
  maxPlayerArmor: number;
  maxPlayerThorns: number;
  maxPlayerForge: number;
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
  maxEnemyThorns: number;
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
  maxSingleHitDamageToEnemyCardId: string;
  maxSingleHitDamageToPlayerCardId: string;
}

type NumericAnomalyKey = {
  [K in keyof BattleAnomalies]: BattleAnomalies[K] extends number ? K : never;
}[keyof BattleAnomalies];

interface StatusAnomalyMetric {
  key: NumericAnomalyKey;
  label: string;
  read: (state: BattleSnapshot) => number;
}

const STATUS_ANOMALY_METRICS = [
  { key: "maxPlayerBlock", label: "Block on Player", read: (s) => s.playerStatuses.block },
  { key: "maxPlayerArmor", label: "Armor on Player", read: (s) => s.playerStatuses.armor },
  { key: "maxPlayerThorns", label: "Thorns on Player", read: (s) => s.playerStatuses.thorns },
  { key: "maxPlayerForge", label: "Forge on Player", read: (s) => s.playerStatuses.forge },
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
  { key: "maxEnemyThorns", label: "Thorns on Enemy", read: (s) => s.enemyStatuses.thorns },
  { key: "maxEnemyArmor", label: "Armor on Enemy", read: (s) => s.enemyMitigation.armor },
  { key: "maxEnemyForge", label: "Forge on Enemy", read: (s) => s.enemyMitigation.forge },
  { key: "maxEnemyFreezeBonus", label: "FreezeBonus on Enemy", read: (s) => s.enemyStatuses.freezeBonus },
  { key: "maxEnemyBurnBonus", label: "BurnBonus on Enemy", read: (s) => s.enemyStatuses.burnBonus },
  { key: "maxEnemyBlock", label: "Block on Enemy", read: (s) => s.enemyMitigation.block },
] as const satisfies readonly StatusAnomalyMetric[];

export const ANOMALY_METRICS = [
  ...STATUS_ANOMALY_METRICS.map(({ key, label }) => ({ key, label })),
  { key: "maxSingleHitDamageToEnemy", label: "Player→Enemy Dmg" },
  { key: "maxSingleHitDamageToPlayer", label: "Enemy→Player Dmg" },
  { key: "maxSingleHeal", label: "Player Heal" },
] as const satisfies ReadonlyArray<{ key: NumericAnomalyKey; label: string }>;

export type AnomalyPreset = TalentPreset;

export const ANOMALY_THRESHOLD_BY_PRESET: Record<AnomalyPreset, number> = {
  early: 100,
  mid: 200,
  late: 300,
};

export function getAnomalyThreshold(preset: AnomalyPreset): number {
  return ANOMALY_THRESHOLD_BY_PRESET[preset];
}

const EMPTY_ANOMALIES: BattleAnomalies = {
  enemyHealing: 0,
  heroHealthDamage: 0,
  enemyBlockGranted: 0,
  enemyArmorGranted: 0,
  ...createNumericManifest(ANOMALY_METRICS.map(({ key }) => key)),
  maxSingleHitDamageToEnemyStat: "",
  maxSingleHitDamageToPlayerStat: "",
  maxSingleHitDamageToEnemyCardId: "",
  maxSingleHitDamageToPlayerCardId: "",
};

export function createEmptyAnomalies(): BattleAnomalies {
  return { ...EMPTY_ANOMALIES };
}

export function sampleAnomalies(
  state: BattleSnapshot,
  combatTexts: CombatTextEvent[],
  anomalies: BattleAnomalies,
  sourceCardId?: string,
): void {
  for (const metric of STATUS_ANOMALY_METRICS) {
    anomalies[metric.key] = Math.max(anomalies[metric.key], metric.read(state));
  }

  for (const ct of combatTexts) {
    if (ct.kind === "heal" && ct.target === "enemy") anomalies.enemyHealing += ct.amount;
    if (ct.kind === "status" && ct.target === "enemy" && ct.stat === "block") anomalies.enemyBlockGranted += ct.amount;
    if (ct.kind === "status" && ct.target === "enemy" && ct.stat === "armor") anomalies.enemyArmorGranted += ct.amount;
    if (
      ct.kind === "damage" &&
      ct.target === "player" &&
      !["block", "armor", "forge", "thorns", "mana", "gold", "gems"].includes(ct.stat)
    )
      anomalies.heroHealthDamage += ct.amount;
    if (ct.kind === "heal") {
      anomalies.maxSingleHeal = Math.max(anomalies.maxSingleHeal, ct.amount);
    } else if (ct.kind === "damage") {
      const peak = ct.target === "enemy" ? "maxSingleHitDamageToEnemy" : "maxSingleHitDamageToPlayer";
      if (!(ct.amount > anomalies[peak])) continue;
      anomalies[peak] = ct.amount;
      anomalies[`${peak}Stat`] = ct.stat;
      anomalies[`${peak}CardId`] = sourceCardId ?? "";
    }
  }
}
