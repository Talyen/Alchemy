import { describe, expect, it } from "vitest";
import { renderBalanceReportHtml } from "@/lib/balance/report-html";
import { renderBalanceReportJson } from "@/lib/balance/report-json";
import { reportMethodologyLines } from "@/lib/balance/report-methodology";
import type { BalanceReportModel } from "@/lib/balance/report-model";
import type { ReportRunOptions } from "@/lib/balance/report-options";
import { emptyRateCell } from "@/lib/balance/report-rankings";

function mockRateCell(overrides = {}) {
  return { ...emptyRateCell(), n: 10, winRate: 0.8, averageTurns: 6, ...overrides };
}

function mockTierRecord<T>(value: T) {
  return { early: value, mid: value, late: value };
}

function mockPairedDelta(overrides = {}) {
  return {
    id: "test",
    delta: 0.05,
    winRate: 0.85,
    baseline: 0.8,
    se: 0.01,
    turnDelta: -0.5,
    baselineTurns: 6,
    treatmentTurns: 5.5,
    turnSe: 0.1,
    n: 20,
    noisy: false,
    ...overrides,
  };
}

describe("report rendering and methodology", () => {
  const options: ReportRunOptions = {
    mode: "quick",
    iterations: 12,
    pairedIterations: 5,
    cardDeckSamples: 15,
    deckSeeds: 1,
    policy: "random-playable",
    loadoutMode: "typical",
    appliesFightPacing: true,
    findingsCap: 100,
  };

  const model: BalanceReportModel = {
    meta: {
      samplingMode: "quick",
      policy: "random-playable",
      loadoutMode: "typical",
      iterations: 12,
      pairedIterations: 5,
      cardDeckSamples: 15,
      deckSeeds: 1,
    },
    enemies: [
      { id: "skeleton", rates: mockTierRecord(mockRateCell({ winRate: 0.95 })) },
      { id: "mimic", rates: mockTierRecord(mockRateCell({ winRate: 0.85 })) },
    ],
    classes: [
      {
        id: "knight",
        rates: mockTierRecord(mockRateCell({ winRate: 0.9 })),
        ratesByType: mockTierRecord({
          normal: mockRateCell({ winRate: 0.95 }),
          elite: mockRateCell({ winRate: 0.85 }),
          boss: mockRateCell({ winRate: 0.8 }),
        }),
      },
    ],
    classMatchups: [
      {
        characterId: "knight",
        enemyId: "skeleton",
        enemyType: "normal",
        rates: mockTierRecord(mockRateCell()),
        topCardsLate: [{ cardId: "strike", count: 12 }],
      },
    ],
    boons: [{ id: "tattered-pages", deltas: mockTierRecord(mockPairedDelta()) }],
    cardsIsolatedSkeleton: [{ id: "strike", deltas: mockTierRecord(mockPairedDelta()) }],
    cardsIsolatedElite: [{ id: "strike", deltas: mockTierRecord(mockPairedDelta()) }],
    cardsInClass: [{ id: "strike", deltas: mockTierRecord(mockPairedDelta()) }],
    talents: [{ id: "strength-1", deltas: mockTierRecord(mockPairedDelta()) }],
    companions: [{ id: "wolf", deltas: mockTierRecord(mockPairedDelta()) }],
    gear: [{ id: "iron-sword", deltas: mockTierRecord(mockPairedDelta()) }],
    affixes: [{ id: "sharp", deltas: mockTierRecord(mockPairedDelta()) }],
    anomalies: [
      {
        field: "maxPlayerBurn",
        maxValue: 250,
        battles: 3,
        peakScenario: "wizard vs blight-treant (Late) · burn · Fireball",
      },
    ],
    anomalyMetrics: [{ field: "maxPlayerBurn", values: { early: 50, mid: 120, late: 250 } }],
  };

  it("produces methodology lines reflecting run options", () => {
    const lines = reportMethodologyLines(options);
    expect(lines.length).toBeGreaterThan(10);
    expect(lines.some((l) => l.includes("Sampling mode=quick"))).toBe(true);
    expect(lines.some((l) => l.includes("Loadout mode=typical"))).toBe(true);
    expect(lines.some((l) => l.includes("Play policy=random-playable"))).toBe(true);
    expect(lines.some((l) => l.includes("Fight pacing on"))).toBe(true);
  });

  it("renders balance report HTML with all expected matrix sections", () => {
    const html = renderBalanceReportHtml(model, options);
    expect(html).toContain("<h1>Balance Report</h1>");
    expect(html).toContain("Enemy Rankings");
    expect(html).toContain("Class Rankings");
    expect(html).toContain("Class Matchups");
    expect(html).toContain("Boon Rankings");
    expect(html).toContain("Card Rankings");
    expect(html).toContain("Talent ablation");
    expect(html).toContain("Companion ablation");
    expect(html).toContain("Item affix isolation");
    expect(html).toContain("Gear ablation");
    expect(html).toContain("Anomalies");
    expect(html).toContain("All Anomaly Metrics");
    expect(html).toContain("Skeleton");
    expect(html).toContain("Knight");
  });

  it("renders balance report JSON with targets and methodology", () => {
    const jsonStr = renderBalanceReportJson(model, options);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.agentNotice).toContain("DRILL-DOWN ONLY");
    expect(parsed.methodology).toBeDefined();
    expect(parsed.targets.winRateByType).toBeDefined();
    expect(parsed.enemies).toHaveLength(2);
    expect(parsed.classes).toHaveLength(1);
    expect(parsed.affixes).toHaveLength(1);
  });
});
