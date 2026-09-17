import { describe, expect, it } from "vitest";
import { escapeHtml, formatPercent, renderReportPage, stringifyReportJson } from "@/lib/balance/report-layout";
import { gauntletDepthDeltaFor } from "@/lib/balance/report-catalog";
import { SIM_GEAR_ROLL_DEPTH, SIM_GEAR_ROLL_SOURCE } from "@/lib/balance/gear-preset";
import { buildLootBalanceReport } from "@/lib/balance/loot-report";
import { makePairedDelta, pairedWinStats } from "@/lib/balance/report-rankings";

describe("balance report consolidation", () => {
  it("shares escaping, percent, page shell, and JSON helpers", () => {
    expect(escapeHtml('<a href="x">&')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;");
    expect(formatPercent(0.5)).toBe("50.0%");
    const page = renderReportPage({ title: "T & T", body: "<h1>Hi</h1>" });
    expect(page).toContain("<title>T &amp; T</title>");
    expect(page).toContain("<h1>Hi</h1>");
    expect(page).toContain(".pos { color: #4ade80; }");
    expect(stringifyReportJson({ a: 1 })).toBe('{\n  "a": 1\n}\n');
  });

  it("uses canonical gauntlet depths for isolated sweeps", () => {
    expect(gauntletDepthDeltaFor("skeleton")).toBe(1);
    expect(gauntletDepthDeltaFor("mimic")).toBe(5);
    expect(gauntletDepthDeltaFor("forge-golem")).toBe(7);
    expect(gauntletDepthDeltaFor("unknown-enemy")).toBe(2);
  });

  it("centralizes the typical gear-roll probe", () => {
    expect(SIM_GEAR_ROLL_SOURCE).toBe("mystery");
    expect(SIM_GEAR_ROLL_DEPTH).toBe(24);
  });

  it("caps loot samples to bound runtime", () => {
    // Invalid counts (0, non-integers) are pinned with their message in
    // tests/lib/loot/report.test.ts; this owns only the upper cap.
    expect(() => buildLootBalanceReport(10_001)).toThrow();
  });

  it("marks single-sample deltas noisy instead of dividing by zero", () => {
    const stats = pairedWinStats(new Uint8Array([0]), new Uint8Array([1]));
    const delta = makePairedDelta("probe", stats);
    expect(delta.n).toBe(1);
    expect(delta.noisy).toBe(true);
    expect(Number.isFinite(delta.se)).toBe(true);
  });
});
