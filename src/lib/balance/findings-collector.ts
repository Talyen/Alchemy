import { ANOMALY_THRESHOLD_BY_PRESET } from "./anomalies";
import { collectEncounterFindings } from "./findings-encounters";
import { collectPairedFindings } from "./findings-paired";
import { finding } from "./findings-shared";
import type { BalanceFinding } from "./findings-types";
import { REPORT_TIERS } from "./report-catalog";
import type { BalanceReportModel } from "./report-model";

function collectAnomalies(model: BalanceReportModel): BalanceFinding[] {
  const findings: BalanceFinding[] = [];
  const peaks = new Map<string, string>();
  for (const entry of model.anomalies) {
    // Preserve the first matching peak, as in the original report lookup.
    if (!peaks.has(entry.field)) peaks.set(entry.field, entry.peakScenario);
  }
  for (const row of model.anomalyMetrics) {
    for (const { preset: tier } of REPORT_TIERS) {
      const value = row.values[tier];
      const threshold = ANOMALY_THRESHOLD_BY_PRESET[tier];
      if (value <= threshold) continue;
      findings.push(
        finding(
          {
            scope: "anomaly",
            id: row.field,
            title: row.field,
            tier,
            worstScenario: peaks.get(row.field) ?? row.field,
          },
          {
            severity: "watch",
            metric: "anomaly",
            bucket: "anomaly",
            observed: value,
            band: `≤ ${threshold} (${tier})`,
            recommendation: "Peak value exceeds the anomaly threshold.",
          },
        ),
      );
    }
  }
  return findings;
}

export function collectBalanceFindings(model: BalanceReportModel): BalanceFinding[] {
  return [
    ...collectEncounterFindings(model),
    ...collectPairedFindings(model.boons, "boon"),
    ...collectPairedFindings(model.cardsIsolatedSkeleton, "card", "isolated vs Skeleton"),
    ...collectPairedFindings(model.cardsIsolatedElite, "card", "isolated vs Mimic"),
    ...collectPairedFindings(model.cardsInClass, "card", "in-class"),
    ...collectPairedFindings(model.talents, "talent"),
    ...collectPairedFindings(model.companions, "companion"),
    ...collectPairedFindings(model.gear, "gear"),
    ...collectPairedFindings(model.affixes, "affix"),
    ...collectAnomalies(model),
  ];
}
