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
  it("builds a finite report and renders without mutating it", { timeout: 1_800_000 }, () => {
    const model = buildBalanceReport(options);
    expectFiniteReport(model);
    expect(model.enemies.length).toBeGreaterThan(0);
    expect(model.classes).toHaveLength(8);
    expect(model.cardsIsolatedSkeleton.length).toBeGreaterThan(0);
    expect(model.cardsInClass.length).toBeGreaterThan(0);
    const json = renderBalanceReportJson(model, options);
    expect(renderBalanceReportHtml(model, options)).toContain("<h1>Balance Report</h1>");
    expect(renderBalanceReportJson(model, options)).toBe(json);
    const findings = evaluateBalanceFindings(model);
    expect(findings.findings.every((finding) => finding.recommendation.length > 0)).toBe(true);
    expect(renderBalanceFindingsHtml(findings, model)).toContain("Balance Findings");
    expect(renderBalanceFindingsJson(findings, model, options)).toContain('"findings"');
    expect(formatFindingObserved("winRate", 0.5)).toContain("50");
  });
});
