import type { BalanceFindingsReport } from "./findings";
import {
  ANOMALY_FINDING_THRESHOLDS,
  EQUITY_SPREAD,
  FINDINGS_CAP,
  LENGTH_BAND_BY_TYPE,
  MATERIAL_TIMEOUT_RATE,
  WIN_RATE_BAND_BY_TYPE,
} from "./findings-bands";
import type { BalanceReportModel } from "./report-model";
import type { ReportRunOptions } from "./report-options";

export function renderBalanceFindingsJson(
  findings: BalanceFindingsReport,
  model: BalanceReportModel,
  options: ReportRunOptions,
): string {
  return `${JSON.stringify(
    {
      agentNotice: "Read this findings file only. The full matrix is reports/balance-full/ and is drill-down only.",
      meta: model.meta,
      options,
      bands: {
        lengthByType: LENGTH_BAND_BY_TYPE,
        winRateByType: WIN_RATE_BAND_BY_TYPE,
        equitySpread: EQUITY_SPREAD,
        materialTimeoutRate: MATERIAL_TIMEOUT_RATE,
        anomalyThresholds: ANOMALY_FINDING_THRESHOLDS,
        cap: FINDINGS_CAP,
      },
      selection: {
        method: "collapse matchups to worst class per enemy/tier/metric/bucket, then round-robin buckets",
        omitted: findings.omitted,
        totalBeforeCap: findings.totalBeforeCap,
        shownByBucket: findings.shownByBucket,
        omittedByBucket: findings.omittedByBucket,
      },
      findings: findings.findings,
    },
    null,
    2,
  )}\n`;
}
