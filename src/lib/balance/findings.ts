import { collectBalanceFindings } from "./findings-collector";
import { selectBalanceFindings } from "./findings-selection";
import { FINDINGS_CAP, type BalanceFindingsReport } from "./findings-types";
import type { BalanceReportModel } from "./report-model";
import type { ReportRunOptions } from "./report-options";

export function evaluateBalanceFindings(
  model: BalanceReportModel,
  options?: Partial<ReportRunOptions>,
): BalanceFindingsReport {
  return selectBalanceFindings(collectBalanceFindings(model), options?.findingsCap ?? FINDINGS_CAP);
}
