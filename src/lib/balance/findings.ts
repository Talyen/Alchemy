import { selectBalanceFindings } from "./findings-selection";
import type { BalanceFinding, BalanceFindingsReport } from "./findings-types";
import { FINDINGS_CAP } from "./findings-bands";
import type { BalanceReportModel } from "./report-model";
import type { ReportRunOptions } from "./report-options";
import { collectEnemyRateFindings, collectClassRateFindings } from "./findings-rate";
import { collectEnemyTypeEquity, collectClassEquity } from "./findings-equity";
import { collectMatchupFindings } from "./findings-matchups";
import { collectPairedFindings } from "./findings-paired";
import { collectAnomalies } from "./findings-anomalies";

export { FINDING_BUCKET_LABELS, FINDING_BUCKET_ORDER } from "./findings-types";
export type { BalanceFinding, BalanceFindingsReport, FindingBucket, FindingMetric } from "./findings-types";

function collectBalanceFindings(model: BalanceReportModel): BalanceFinding[] {
  const candidates: BalanceFinding[] = [];

  candidates.push(...collectEnemyRateFindings(model));
  candidates.push(...collectEnemyTypeEquity(model.enemies));
  candidates.push(...collectClassRateFindings(model));
  candidates.push(...collectClassEquity(model.classes));
  candidates.push(...collectMatchupFindings(model));
  candidates.push(...collectPairedFindings(model.boons, "boon"));
  candidates.push(...collectPairedFindings(model.cardsIsolatedSkeleton, "card", "isolated vs Skeleton"));
  candidates.push(...collectPairedFindings(model.cardsIsolatedElite, "card", "isolated vs Mimic"));
  candidates.push(...collectPairedFindings(model.cardsInClass, "card", "in-class"));
  candidates.push(...collectPairedFindings(model.talents, "talent"));
  candidates.push(...collectPairedFindings(model.companions, "companion"));
  candidates.push(...collectPairedFindings(model.gear, "gear"));
  candidates.push(...collectPairedFindings(model.affixes, "affix"));
  candidates.push(...collectAnomalies(model));

  return candidates;
}

export function evaluateBalanceFindings(
  model: BalanceReportModel,
  options?: Partial<ReportRunOptions>,
): BalanceFindingsReport {
  return selectBalanceFindings(collectBalanceFindings(model), options?.findingsCap ?? FINDINGS_CAP);
}
