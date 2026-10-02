import { describe, expect, it } from "vitest";
import { selectBalanceFindings } from "@/lib/balance/findings-selection";
import type { BalanceFinding } from "@/lib/balance/findings-types";

function finding(id: string, overrides: Partial<BalanceFinding> = {}): BalanceFinding {
  return {
    id,
    scope: "enemy",
    title: id,
    tier: "late",
    severity: "serious",
    metric: "winRate",
    bucket: "equity",
    observed: 0.5,
    band: "test band",
    worstScenario: id,
    recommendation: "Review this result.",
    ...overrides,
  };
}

describe("selectBalanceFindings", () => {
  it("deduplicates before clustering and keeps the most severe representative with a stable tie-break", () => {
    const candidates = [
      finding("wizard:skeleton", { scope: "matchup", severity: "critical" }),
      finding("rogue:skeleton", { scope: "matchup", severity: "critical" }),
      finding("rogue:skeleton", { scope: "matchup", severity: "watch", observed: 0 }),
      finding("knight:skeleton", { scope: "matchup" }),
      finding("rogue:skeleton", { scope: "matchup", bucket: "typeWinRate" }),
    ];
    const original = structuredClone(candidates);

    const report = selectBalanceFindings(candidates, 10);
    expect(report.findings).toEqual([
      candidates[4],
      {
        ...candidates[1],
        clusterSize: 3,
        worstScenario: "rogue:skeleton · worst of 3 classes",
      },
    ]);
    expect(report.totalBeforeCap).toBe(2);
    expect(report.omitted).toBe(0);
    expect(candidates).toEqual(original);
  });

  it("fills the cap across categories before taking their next ranked finding", () => {
    const candidates = [
      finding("weak-equity", { observed: 0.8 }),
      finding("strong-equity", { observed: 0 }),
      finding("timeout", { bucket: "timeout", metric: "timeoutRate", observed: 0.1 }),
      finding("weak-timeout", { bucket: "timeout", metric: "timeoutRate", observed: 0.05 }),
      finding("anomaly", { bucket: "anomaly", metric: "anomaly", observed: 500 }),
    ];

    const report = selectBalanceFindings(candidates, 4);
    expect(report.findings.map(({ id }) => id)).toEqual(["timeout", "weak-timeout", "strong-equity", "anomaly"]);
    expect(report.totalBeforeCap).toBe(5);
    expect(report.omitted).toBe(1);
    expect(report.shownByBucket.timeout).toBe(2);
    expect(report.shownByBucket.equity).toBe(1);
    expect(report.shownByBucket.anomaly).toBe(1);
    expect(report.omittedByBucket.equity).toBe(1);
  });

  it("handles an empty selection and caps larger than the candidate set", () => {
    const candidates = [finding("skeleton")];
    const empty = selectBalanceFindings(candidates, 0);
    expect(empty.findings).toEqual([]);
    expect(empty.omitted).toBe(1);
    expect(empty.omittedByBucket.equity).toBe(1);

    expect(selectBalanceFindings(candidates, 100).findings).toEqual(candidates);
    expect(selectBalanceFindings([], 100).totalBeforeCap).toBe(0);
  });
});
