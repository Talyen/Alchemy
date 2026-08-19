import { describe, expect, it } from "vitest";
import {
  evaluateBalanceFindings,
  FINDINGS_CAP,
  emptyRateCell,
  makePairedDelta,
  type BalanceReportModel,
  type ClassMatchupRow,
  type PairedTierRow,
  type RateCell,
} from "@/lib/balance";

function cell(partial: Partial<RateCell>): RateCell {
  return {
    winRate: 0.95,
    timeoutRate: 0,
    averageTurns: 4,
    averageHealthRemaining: 10,
    n: 100,
    ...partial,
  };
}

function paired(id: string, late: ReturnType<typeof makePairedDelta>): PairedTierRow {
  const empty = makePairedDelta(id, 0, 0, 0);
  return { id, early: empty, mid: empty, late };
}

function emptyModel(): BalanceReportModel {
  return {
    meta: {
      policy: "greedy-effective-damage",
      loadoutMode: "typical",
      iterations: 10,
      trinketIterations: 10,
      cardIterations: 10,
      deckSeeds: 1,
    },
    enemies: [],
    classes: [],
    classMatchups: [],
    boons: [],
    cardsIsolatedSkeleton: [],
    cardsIsolatedElite: [],
    cardsInClass: [],
    talents: [],
    companions: [],
    anomalies: [],
    anomalyMetrics: [],
  };
}

describe("evaluateBalanceFindings", () => {
  it("collapses a 100% enemy into one finding instead of per-class matchups", () => {
    const characters = ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid", "wildcard"] as const;
    const matchups: ClassMatchupRow[] = characters.map((characterId) => ({
      characterId,
      enemyId: "skeleton",
      enemyType: "normal",
      early: emptyRateCell(),
      mid: emptyRateCell(),
      late: cell({ winRate: 1, averageTurns: 4 }),
      topCardsLate: [],
    }));
    const model = emptyModel();
    model.enemies = [
      { id: "skeleton", early: emptyRateCell(), mid: emptyRateCell(), late: cell({ winRate: 1, averageTurns: 4 }) },
    ];
    model.classMatchups = matchups;

    const result = evaluateBalanceFindings(model);
    const skeletonWin = result.findings.filter((finding) => finding.id === "skeleton" && finding.metric === "winRate");
    expect(skeletonWin).toHaveLength(1);
    expect(skeletonWin[0]?.severity).toBe("critical");
    expect(skeletonWin[0]?.scope).toBe("enemy");
    expect(result.findings.some((finding) => finding.scope === "matchup")).toBe(false);
    expect(result.findings.every((finding) => finding.recommendation.includes("Discuss"))).toBe(true);
  });

  it("flags a too-short normal and a too-hard boss matchup", () => {
    const model = emptyModel();
    model.enemies = [
      { id: "goblin", early: emptyRateCell(), mid: emptyRateCell(), late: cell({ winRate: 0.95, averageTurns: 2 }) },
    ];
    model.classMatchups = [
      {
        characterId: "rogue",
        enemyId: "frostwarden",
        enemyType: "boss",
        early: emptyRateCell(),
        mid: emptyRateCell(),
        late: cell({ winRate: 0.2, averageTurns: 8 }),
        topCardsLate: [],
      },
      {
        characterId: "wizard",
        enemyId: "frostwarden",
        enemyType: "boss",
        early: emptyRateCell(),
        mid: emptyRateCell(),
        late: cell({ winRate: 0.95, averageTurns: 8 }),
        topCardsLate: [],
      },
    ];

    const result = evaluateBalanceFindings(model);
    expect(result.findings.some((finding) => finding.id === "goblin" && finding.metric === "averageTurns")).toBe(true);
    const matchup = result.findings.find(
      (finding) => finding.scope === "matchup" && finding.id === "rogue:frostwarden" && finding.metric === "winRate",
    );
    expect(matchup?.severity).toBe("critical");
    expect(matchup?.observed).toBe(0.2);
  });

  it("skips noisy paired deltas and flags a far non-noisy card", () => {
    const noisy: ReturnType<typeof makePairedDelta> = {
      id: "cleanse",
      delta: 0.01,
      winRate: 0.51,
      baseline: 0.5,
      se: 0.1,
      n: 20,
      noisy: true,
    };
    const clustered: ReturnType<typeof makePairedDelta> = {
      id: "slash",
      delta: 0.05,
      winRate: 0.55,
      baseline: 0.5,
      se: 0.01,
      n: 400,
      noisy: false,
    };
    const strong: ReturnType<typeof makePairedDelta> = {
      id: "fangs",
      delta: 0.4,
      winRate: 0.9,
      baseline: 0.5,
      se: 0.02,
      n: 400,
      noisy: false,
    };

    const model = emptyModel();
    model.cardsIsolatedElite = [paired("cleanse", noisy), paired("slash", clustered), paired("fangs", strong)];

    const result = evaluateBalanceFindings(model);
    expect(result.findings.some((finding) => finding.id.includes("cleanse"))).toBe(false);
    expect(result.findings.some((finding) => finding.scope === "card" && finding.id.includes("fangs"))).toBe(true);
  });

  it("flags anomaly spikes over threshold and ignores values under it", () => {
    const model = emptyModel();
    model.anomalyMetrics = [
      { field: "Player→Enemy Dmg", early: 10, mid: 10, late: 400, thresholds: [100, 200, 300] },
      { field: "Player Heal", early: 10, mid: 10, late: 10, thresholds: [100, 200, 300] },
    ];
    model.anomalies = [
      { field: "Player→Enemy Dmg", maxValue: 400, battles: 3, peakScenario: "wizard vs frost-elemental (Late)" },
    ];

    const result = evaluateBalanceFindings(model);
    const spike = result.findings.find((finding) => finding.scope === "anomaly" && finding.id === "Player→Enemy Dmg");
    expect(spike?.severity).toBe("watch");
    expect(spike?.tier).toBe("late");
    expect(result.findings.some((finding) => finding.id === "Player Heal")).toBe(false);
  });

  it("caps the summary", () => {
    const model = emptyModel();
    model.anomalyMetrics = Array.from({ length: 40 }, (_, index) => ({
      field: `metric-${index}`,
      early: 0,
      mid: 0,
      late: 500,
      thresholds: [100, 200, 300],
    }));
    const result = evaluateBalanceFindings(model);
    expect(result.findings.length).toBe(FINDINGS_CAP);
    expect(result.omitted).toBeGreaterThan(0);
    expect(result.totalBeforeCap).toBeGreaterThan(FINDINGS_CAP);
    expect(result.shownByBucket.anomaly).toBe(FINDINGS_CAP);
  });

  it("collapses class matchups and still surfaces other issue types under the cap", () => {
    const characters = ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid", "wildcard"] as const;
    const bosses = ["iron-bear", "frostwarden", "forge-golem", "blight-treant"] as const;
    const matchups: ClassMatchupRow[] = [];
    for (const enemyId of bosses) {
      characters.forEach((characterId, index) => {
        matchups.push({
          characterId,
          enemyId,
          enemyType: "boss",
          early: emptyRateCell(),
          mid: emptyRateCell(),
          late: cell({ winRate: 0.1 + index * 0.05, averageTurns: 8 }),
          topCardsLate: [],
        });
      });
    }

    const model = emptyModel();
    model.classMatchups = matchups;
    model.enemies = [
      { id: "goblin", early: emptyRateCell(), mid: emptyRateCell(), late: cell({ winRate: 0.95, averageTurns: 2 }) },
    ];
    model.classes = [
      {
        id: "wizard",
        early: emptyRateCell(),
        mid: emptyRateCell(),
        late: cell({ winRate: 1, averageTurns: 3 }),
        earlyByType: {},
        midByType: {},
        lateByType: {
          normal: emptyRateCell(),
          elite: emptyRateCell(),
          boss: emptyRateCell(),
        },
      },
    ];
    model.anomalyMetrics = [{ field: "Player→Enemy Dmg", early: 10, mid: 10, late: 400, thresholds: [100, 200, 300] }];
    model.anomalies = [
      { field: "Player→Enemy Dmg", maxValue: 400, battles: 3, peakScenario: "wizard vs frostwarden (Late)" },
    ];

    const result = evaluateBalanceFindings(model);
    const matchupWinRates = result.findings.filter(
      (finding) => finding.scope === "matchup" && finding.metric === "winRate",
    );
    expect(matchupWinRates.length).toBeLessThanOrEqual(bosses.length);
    expect(matchupWinRates.some((finding) => (finding.clusterSize ?? 1) > 1)).toBe(true);
    expect(result.findings.some((finding) => finding.id === "goblin" && finding.metric === "averageTurns")).toBe(true);
    expect(
      result.findings.some((finding) => finding.scope === "class" && finding.id === "wizard" && finding.observed === 1),
    ).toBe(true);
    expect(result.findings.some((finding) => finding.scope === "anomaly")).toBe(true);
    expect(result.shownByBucket.length).toBeGreaterThan(0);
    expect(result.shownByBucket.floorCeiling).toBeGreaterThan(0);
    expect(result.shownByBucket.typeWinRate).toBeGreaterThan(0);
    expect(result.shownByBucket.anomaly).toBeGreaterThan(0);
  });
});
