import {
  PAIRED_DELTA_FROM_MEDIAN,
  PAIRED_TURN_DELTA_THRESHOLD,
  type BalanceFinding,
  type FindingScope,
} from "./findings-types";
import { finding, median, type FindingContext } from "./findings-shared";
import { REPORT_TIERS, titleFor } from "./report-catalog";
import type { PairedTierRow } from "./report-model";
import { isDeltaNoisy } from "./report-rankings";

export function collectPairedFindings(
  rows: readonly PairedTierRow[],
  scope: Extract<FindingScope, "boon" | "card" | "talent" | "companion" | "gear" | "affix">,
  contextLabel = "",
): BalanceFinding[] {
  const findings: BalanceFinding[] = [];
  for (const { preset: tier } of REPORT_TIERS) {
    const usable = rows.map((row) => ({ row, delta: row.deltas[tier] })).filter((entry) => entry.delta.n >= 2);
    if (usable.length === 0) continue;
    const med = median(usable.map((entry) => entry.delta.delta));
    const turnMed = median(usable.map((entry) => entry.delta.turnDelta));
    for (const { row, delta } of usable) {
      const baseTitle = titleFor(scope, row.id);
      const label = contextLabel ? `${baseTitle} (${contextLabel})` : baseTitle;
      const context: FindingContext = {
        scope,
        id: contextLabel ? `${row.id}:${contextLabel}` : row.id,
        title: label,
        tier,
        worstScenario: `${label} (${tier})`,
      };
      if (!delta.noisy && Math.abs(delta.delta - med) >= PAIRED_DELTA_FROM_MEDIAN) {
        findings.push(
          finding(context, {
            severity: "serious",
            metric: "delta",
            bucket: "paired",
            observed: delta.delta,
            band: `noisy skipped; |delta − median| ≥ ${PAIRED_DELTA_FROM_MEDIAN * 100}pp (median ${(med * 100).toFixed(1)}pp)`,
            recommendation: "Non-noisy paired delta is far from the category median.",
          }),
        );
      }
      if (
        !isDeltaNoisy(delta.turnDelta, delta.turnSe) &&
        Math.abs(delta.turnDelta - turnMed) >= PAIRED_TURN_DELTA_THRESHOLD
      ) {
        findings.push(
          finding(
            {
              ...context,
              id: `${context.id}:turns`,
              worstScenario: `${label} (${tier}) · turn impact: ${delta.turnDelta >= 0 ? "+" : ""}${delta.turnDelta.toFixed(1)} rounds`,
            },
            {
              severity: "serious",
              metric: "averageTurns",
              bucket: "length",
              observed: delta.turnDelta,
              band: `|turn delta − median| ≥ ${PAIRED_TURN_DELTA_THRESHOLD.toFixed(1)} rounds (median ${turnMed.toFixed(1)})`,
              recommendation:
                delta.turnDelta > 0
                  ? `Increases observed fight duration by ${delta.turnDelta.toFixed(1)} rounds.`
                  : `Reduces observed fight duration by ${Math.abs(delta.turnDelta).toFixed(1)} rounds.`,
            },
          ),
        );
      }
    }
  }
  return findings;
}
