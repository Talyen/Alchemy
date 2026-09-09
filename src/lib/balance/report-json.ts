import type { BalanceReportModel } from "./report-model";
import type { ReportRunOptions } from "./report-options";
import { reportMethodologyLines } from "./report-run";
import { LENGTH_BAND_BY_TYPE, MATERIAL_TIMEOUT_RATE, WIN_RATE_BAND_BY_TYPE } from "./findings-bands";

export function renderBalanceReportJson(model: BalanceReportModel, options: ReportRunOptions): string {
  return `${JSON.stringify(
    {
      agentNotice: "DRILL-DOWN ONLY. Read reports/balance-findings.json instead of this file.",
      methodology: reportMethodologyLines(options),
      targets: {
        appliesTo: ["early", "mid", "late"],
        winRateByType: WIN_RATE_BAND_BY_TYPE,
        lengthByType: LENGTH_BAND_BY_TYPE,
        timeoutRateExclusiveMaximum: MATERIAL_TIMEOUT_RATE,
      },
      ...model,
    },
    null,
    2,
  )}\n`;
}
