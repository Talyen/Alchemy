import { expect, it } from "vitest";
import { buildLootBalanceReport, renderLootBalanceReport } from "@/lib/balance/loot-report";

it("produces reproducible offer estimates with explicit route and collection assumptions", () => {
  const report = buildLootBalanceReport(2);
  expect(buildLootBalanceReport(2)).toEqual(report);
  expect(report.routeDefinitions.Campaign).toHaveLength(25);
  expect(report.routes).toHaveLength(24);
  expect(new Set(report.cells.map((cell) => cell.account)).size).toBe(4);
  for (const cell of report.cells) {
    expect(cell.premiumScreenChance).toBeGreaterThanOrEqual(0);
    expect(cell.premiumScreenChance).toBeLessThanOrEqual(1);
    if (cell.depth < 4) expect(cell.premiumScreenChance).toBe(0);
    if (cell.collection === "nearly-complete") expect(cell.offeredPerScreen.trinket).toBeLessThanOrEqual(2);
  }
  const html = renderLootBalanceReport(report);
  expect(html).toContain("offers, not acquisitions");
  expect(html).toContain("Route definitions");
  expect(html).toContain("Unavailable");
});
