import { describe, expect, it } from "vitest";
import {
  buildBalanceReport,
  evaluateBalanceFindings,
  formatFindingObserved,
  renderBalanceFindingsHtml,
  renderBalanceFindingsJson,
  renderBalanceReportHtml,
  renderBalanceReportJson,
  type ReportRunOptions,
} from "@/lib/balance";

const options: ReportRunOptions = {
  iterations: 1,
  trinketIterations: 1,
  cardIterations: 1,
  deckSeeds: 1,
  policy: "random-playable",
  loadoutMode: "bare",
  appliesFightPacing: false,
};

function expectFiniteReport(value: unknown): void {
  if (typeof value === "number") {
    expect(Number.isFinite(value)).toBe(true);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) expectFiniteReport(entry);
    return;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) expectFiniteReport(entry);
  }
}

describe("balance report", () => {
  it("builds a deterministic, finite report without filesystem effects", { timeout: 1_800_000 }, () => {
    const first = buildBalanceReport(options);
    const second = buildBalanceReport(options);
    expectFiniteReport(first);
    expect(first.enemies.length).toBeGreaterThan(0);
    expect(first.classes).toHaveLength(8);
    expect(first.cardsIsolatedSkeleton.length).toBeGreaterThan(0);
    expect(first.cardsInClass.length).toBeGreaterThan(0);
    expect(renderBalanceReportJson(second, options)).toBe(renderBalanceReportJson(first, options));
    expect(renderBalanceReportHtml(first, options)).toContain("<h1>Balance Report</h1>");
    const findings = evaluateBalanceFindings(first);
    expect(findings.findings.every((finding) => finding.recommendation.length > 0)).toBe(true);
    expect(renderBalanceFindingsHtml(findings, first)).toContain("Balance Findings");
    expect(renderBalanceFindingsJson(findings, first, options)).toContain('"findings"');
    expect(formatFindingObserved("winRate", 0.5)).toContain("50");
  });
});
