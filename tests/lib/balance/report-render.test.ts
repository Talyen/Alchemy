import { describe, expect, it } from "vitest";
import { renderBalanceReportHtml } from "@/lib/balance/report-html";
import { renderBalanceReportJson } from "@/lib/balance/report-json";
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

  it("renders each paired comparison in its own section with ordered tiers and escaped catalog fallbacks", () => {
    const comparisons = [
      ["boons", "Boon Rankings"],
      ["cardsIsolatedSkeleton", "Card Rankings — isolated vs Skeleton"],
      ["cardsIsolatedElite", "Card Rankings — isolated vs Mimic"],
      ["cardsInClass", "Card Rankings — in-class decks"],
      ["talents", "Talent ablation"],
      ["companions", "Companion ablation"],
      ["gear", "Gear ablation"],
    ] as const;
    const changed = { ...model };
    for (const [key] of comparisons) {
      changed[key] = [
        {
          id: `<${key}&>`,
          deltas: {
            early: mockPairedDelta({ delta: 0.1 }),
            mid: mockPairedDelta({ delta: -0.2 }),
            late: mockPairedDelta({ delta: 0.3, noisy: true }),
          },
        },
      ];
    }
    const html = renderBalanceReportHtml(changed, options);
    for (const [key, heading] of comparisons) {
      const section = html.split(`<h2>${heading}</h2>`)[1]!.split("<h2>")[0]!;
      expect(section).toContain(`&lt;${key}&amp;&gt;`);
      expect(section).toMatch(/10\.0%[\s\S]*-20\.0%[\s\S]*30\.0% \(noisy\)/);
      expect(section).not.toContain(`<${key}&>`);
    }
    const exported = JSON.parse(renderBalanceReportJson(changed, options));
    for (const [key] of comparisons) expect(exported[key]).toEqual(changed[key]);
  });
});
