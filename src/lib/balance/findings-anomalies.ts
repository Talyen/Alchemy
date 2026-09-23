import type { BalanceFinding } from "./findings-types";
import { ANOMALY_THRESHOLD_BY_PRESET } from "./anomalies";
import { REPORT_TIERS } from "./report-catalog";
import type { BalanceReportModel } from "./report-model";
import { REVIEW_SUFFIX } from "./findings-rule-helpers";

export function collectAnomalies(model: BalanceReportModel): BalanceFinding[] {
  const findings: BalanceFinding[] = [];
  for (const row of model.anomalyMetrics) {
    for (const { preset: tier } of REPORT_TIERS) {
      const value = row.values[tier];
      const threshold = ANOMALY_THRESHOLD_BY_PRESET[tier];
      if (value <= threshold) continue;
      const peak = model.anomalies.find((entry) => entry.field === row.field);
      const burnHint =
        row.field.includes("Burn") || row.field.includes("Player→Enemy")
          ? "Burn stack application (e.g. Flaming Shield) can spike vs Burn-vulnerable enemies."
          : undefined;
      findings.push({
        severity: "watch",
        scope: "anomaly",
        id: row.field,
        title: row.field,
        tier,
        metric: "anomaly",
        bucket: "anomaly",
        observed: value,
        band: `≤ ${threshold} (${tier})`,
        worstScenario: peak?.peakScenario ?? row.field,
        ...(burnHint ? { causeHint: burnHint } : {}),
        recommendation: `Peak value exceeds the anomaly threshold.${REVIEW_SUFFIX}`,
      });
    }
  }
  return findings;
}
