import { describe, expect, it } from "vitest";
import { BOON_GAUNTLET, REPORT_TIERS } from "@/lib/balance/report-catalog";

describe("report-catalog", () => {
  it("exposes tier and gauntlet catalog", () => {
    expect(REPORT_TIERS).toHaveLength(3);
    expect(REPORT_TIERS.map((tier) => tier.label)).toEqual(["Early", "Mid", "Late"]);
    expect(BOON_GAUNTLET.map((entry) => entry.enemyId)).toEqual(["skeleton", "goblin", "mimic", "iron-bear"]);
  });
});
