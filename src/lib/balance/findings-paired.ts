import type { BalanceFinding, FindingScope } from "./findings-types";
import { PAIRED_DELTA_FROM_MEDIAN, PAIRED_TURN_DELTA_THRESHOLD } from "./findings-bands";
import { REPORT_TIERS, titleFor } from "./report-catalog";
import type { PairedTierRow } from "./report-model";
import { isDeltaNoisy } from "./report-rankings";
import { REVIEW_SUFFIX, median } from "./findings-rule-helpers";

export function collectPairedFindings(
  rows: readonly PairedTierRow[],
  scope: Extract<FindingScope, "boon" | "card" | "talent" | "companion" | "gear" | "affix">,
  context = "",
): BalanceFinding[] {
  const findings: BalanceFinding[] = [];
  for (const { preset: tier } of REPORT_TIERS) {
    const usable = rows.map((row) => ({ row, delta: row.deltas[tier] })).filter((entry) => entry.delta.n >= 2);
    if (usable.length === 0) continue;
    const med = median(usable.map((entry) => entry.delta.delta));
    const turnMed = median(usable.map((entry) => entry.delta.turnDelta));
    for (const { row, delta } of usable) {
      const baseTitle = titleFor(scope, row.id);
      const label = context ? `${baseTitle} (${context})` : baseTitle;
      if (!delta.noisy && Math.abs(delta.delta - med) >= PAIRED_DELTA_FROM_MEDIAN) {
        findings.push({
          severity: "serious",
          scope,
          id: context ? `${row.id}:${context}` : row.id,
          title: label,
          tier,
          metric: "delta",
          bucket: "paired",
          observed: delta.delta,
          band: `noisy skipped; |delta − median| ≥ ${PAIRED_DELTA_FROM_MEDIAN * 100}pp (median ${(med * 100).toFixed(1)}pp)`,
          worstScenario: `${label} (${tier})`,
          recommendation: `Non-noisy paired delta is far from the category median.${REVIEW_SUFFIX}`,
        });
      }
      if (
        !isDeltaNoisy(delta.turnDelta, delta.turnSe) &&
        Math.abs(delta.turnDelta - turnMed) >= PAIRED_TURN_DELTA_THRESHOLD
      ) {
        findings.push({
          severity: "serious",
          scope,
          id: context ? `${row.id}:${context}:turns` : `${row.id}:turns`,
          title: label,
          tier,
          metric: "averageTurns",
          bucket: "length",
          observed: delta.turnDelta,
          band: `|turn delta − median| ≥ ${PAIRED_TURN_DELTA_THRESHOLD.toFixed(1)} rounds (median ${turnMed.toFixed(1)})`,
          worstScenario: `${label} (${tier}) · turn impact: ${delta.turnDelta >= 0 ? "+" : ""}${delta.turnDelta.toFixed(1)} rounds`,
          recommendation:
            delta.turnDelta > 0
              ? `Increases observed fight duration by ${delta.turnDelta.toFixed(1)} rounds.${REVIEW_SUFFIX}`
              : `Reduces observed fight duration by ${Math.abs(delta.turnDelta).toFixed(1)} rounds.${REVIEW_SUFFIX}`,
        });
      }
    }
  }
  return findings;
}
