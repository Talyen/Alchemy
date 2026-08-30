import type { BalanceReportModel } from "./report-model";
import type { ReportRunOptions } from "./report-options";
import { reportMethodologyLines } from "./report-run";

export function renderBalanceReportJson(model: BalanceReportModel, options: ReportRunOptions): string {
  return `${JSON.stringify(
    {
      agentNotice: "DRILL-DOWN ONLY. Read reports/balance-findings.json instead of this file.",
      methodology: reportMethodologyLines(options),
      ...model,
    },
    null,
    2,
  )}\n`;
}
