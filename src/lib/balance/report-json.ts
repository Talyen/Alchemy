// JSON exporter for the balance report model.
import type { BalanceReportModel } from "./report-model";
import { reportMethodologyLines, type ReportRunOptions } from "./report-run";

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
