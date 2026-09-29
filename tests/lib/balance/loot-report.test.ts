import { describe, expect, it } from "vitest";
import { buildLootBalanceReport, renderLootBalanceReport } from "@/lib/balance/loot-report";

describe("loot balance report", () => {
  it("is deterministic for a fixed sample count", () => {
    expect(buildLootBalanceReport(10)).toEqual(buildLootBalanceReport(10));
  });

  it("builds expected cells and route summaries", () => {
    const report = buildLootBalanceReport(20);
    expect(report.samplesPerCell).toBe(20);
    expect(report.seedVersion).toBe("loot-v2");
    expect(report.cells.length).toBeGreaterThan(0);
    expect(report.routes.length).toBeGreaterThan(0);

    const campaignRoute = report.routes.find(
      (r) => r.name === "Campaign" && r.account === "difficulty-1" && r.collection === "fresh",
    );
    expect(campaignRoute).toBeDefined();
    expect(campaignRoute!.premiumScreens).toBeGreaterThanOrEqual(0);
    expect(campaignRoute!.offered.astral).toBeGreaterThanOrEqual(0);
    expect(campaignRoute!.offered.unique).toBeGreaterThanOrEqual(0);
    expect(campaignRoute!.offered.trinket).toBeGreaterThanOrEqual(0);
  });

  it("rejects invalid sample counts", () => {
    expect(() => buildLootBalanceReport(0)).toThrow("positive integer");
    expect(() => buildLootBalanceReport(-5)).toThrow("positive integer");
    expect(() => buildLootBalanceReport(1.5)).toThrow("positive integer");
    expect(() => buildLootBalanceReport(10_001)).toThrow("capped at 10,000");
  });

  it("renders an interactive loot progression report HTML", () => {
    const report = buildLootBalanceReport(5);
    const html = renderLootBalanceReport(report);
    expect(html).toContain("<h1>Alchemy loot progression</h1>");
    expect(html).toContain("Campaign");
    expect(html).toContain("Labyrinth");
    expect(html).toContain("Wildwood");
    expect(html).toContain("data-account=");
    expect(html).toContain("data-collection=");
    expect(html).toContain('<select id="account">');
  });
});
