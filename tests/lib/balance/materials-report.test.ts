import { describe, expect, it } from "vitest";
import { buildMaterialsBalanceReport, renderMaterialsBalanceReport } from "@/lib/balance/materials-report";

describe("materials balance report", () => {
  it("is deterministic for a fixed sample count", () => {
    expect(buildMaterialsBalanceReport(50)).toEqual(buildMaterialsBalanceReport(50));
  });

  it("matches honest bonus chances on sampled means", () => {
    const report = buildMaterialsBalanceReport(2000);
    const row = (enemyId: string, enemyType: "normal" | "elite" | "boss") =>
      report.rows.find((entry) => entry.enemyId === enemyId && entry.enemyType === enemyType)!.mean;
    // Skeleton: no guaranteed loot, 30% chance at 1 herb.
    expect(row("skeleton", "normal").herbs).toBeCloseTo(0.3, 1);
    // Goblin: guaranteed 1 wood + 1 food, 40% chance at +1 wood.
    expect(row("goblin", "normal").wood).toBeCloseTo(1.4, 1);
    expect(row("goblin", "normal").food).toBe(1);
  });

  it("applies elite and boss multipliers exactly on bonus-free enemies", () => {
    const report = buildMaterialsBalanceReport(500);
    const row = (enemyType: "normal" | "elite" | "boss") =>
      report.rows.find((entry) => entry.enemyId === "mud-elemental" && entry.enemyType === enemyType)!.mean;
    // Mud elemental guarantees exactly 1 herb with no bonus rolls.
    expect(row("normal").herbs).toBe(1);
    expect(row("elite").herbs).toBe(1);
    expect(row("boss").herbs).toBe(3);
  });

  it("rejects invalid sample counts", () => {
    expect(() => buildMaterialsBalanceReport(0)).toThrow("positive integer");
    expect(() => buildMaterialsBalanceReport(1.5)).toThrow("positive integer");
    expect(() => buildMaterialsBalanceReport(100_001)).toThrow("capped");
  });

  it("renders a methodology page covering every loot table", () => {
    const report = buildMaterialsBalanceReport(10);
    expect(report.samplesPerCell).toBe(10);
    expect(report.seedVersion).toBe("materials-v1");
    expect(report.rows.length).toBeGreaterThan(0);
    const html = renderMaterialsBalanceReport(report);
    expect(html).toContain("Mean materials paid per victory");
    expect(html).toContain("skeleton");
    expect(html).toContain("from 10 seeded rolls");
  });
});
