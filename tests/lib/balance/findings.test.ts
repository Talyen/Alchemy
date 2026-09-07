import { describe, expect, it } from "vitest";
import {
  evaluateBalanceFindings,
  FINDINGS_CAP,
  emptyRateCell,
  makePairedDelta,
  renderBalanceFindingsHtml,
  renderBalanceFindingsJson,
  type BalanceReportModel,
  type ClassMatchupRow,
  type PairedTierRow,
  type RateCell,
} from "@/lib/balance";
import { emptyPairedWinStats } from "@/lib/balance/report-rankings";

function cell(partial: Partial<RateCell>): RateCell {
  return {
    winRate: 0.95,
    timeoutRate: 0,
    averageEnemyAttacks: 0,
    averageEnemyAbilityActivations: 0,
    winsBeforeEnemyAttackRate: 0,
    averageTurns: 4,
    averageHealthRemaining: 10,
    n: 100,
    ...partial,
  };
}

function paired(id: string, late: ReturnType<typeof makePairedDelta>): PairedTierRow {
  const empty = makePairedDelta(id, emptyPairedWinStats());
  return { id, deltas: { early: empty, mid: empty, late } };
}

function rates(late: RateCell, early = emptyRateCell(), mid = emptyRateCell()) {
  return { early, mid, late };
}

function emptyModel(): { -readonly [Key in keyof BalanceReportModel]: BalanceReportModel[Key] } {
  return {
    meta: {
      policy: "greedy-effective-damage",
      loadoutMode: "typical",
      iterations: 10,
      pairedIterations: 10,
      cardDeckSamples: 10,
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
    gear: [],
    affixes: [],
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
      rates: rates(cell({ winRate: 1, averageTurns: 4 })),
      topCardsLate: [],
    }));
    const model = emptyModel();
    model.enemies = [{ id: "skeleton", rates: rates(cell({ winRate: 1, averageTurns: 4 })) }];
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
    model.enemies = [{ id: "goblin", rates: rates(cell({ winRate: 0.95, averageTurns: 2 })) }];
    model.classMatchups = [
      {
        characterId: "rogue",
        enemyId: "frostwarden",
        enemyType: "boss",
        rates: rates(cell({ winRate: 0.2, averageTurns: 8 })),
        topCardsLate: [],
      },
      {
        characterId: "wizard",
        enemyId: "frostwarden",
        enemyType: "boss",
        rates: rates(cell({ winRate: 0.95, averageTurns: 8 })),
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

  it("retains separate type-band and equity findings for one matchup", () => {
    const model = emptyModel();
    model.classMatchups = [
      {
        characterId: "knight",
        enemyId: "skeleton",
        enemyType: "normal",
        rates: rates(cell({ winRate: 0.6, averageTurns: 6 })),
        topCardsLate: [],
      },
      {
        characterId: "rogue",
        enemyId: "skeleton",
        enemyType: "normal",
        rates: rates(cell({ winRate: 0.95, averageTurns: 6 })),
        topCardsLate: [],
      },
    ];

    const findings = evaluateBalanceFindings(model, { findingsCap: 100 }).findings.filter(
      (finding) => finding.id === "knight:skeleton" && finding.tier === "late",
    );
    expect(findings.map((finding) => finding.bucket)).toEqual(expect.arrayContaining(["typeWinRate", "equity"]));
  });

  it("skips noisy paired deltas and flags a far non-noisy card", () => {
    const noisy: ReturnType<typeof makePairedDelta> = {
      id: "cleanse",
      delta: 0.01,
      winRate: 0.51,
      baseline: 0.5,
      se: 0.1,
      turnDelta: 0,
      baselineTurns: 5,
      treatmentTurns: 5,
      turnSe: 0,
      n: 20,
      noisy: true,
    };
    const clustered: ReturnType<typeof makePairedDelta> = {
      id: "slash",
      delta: 0.05,
      winRate: 0.55,
      baseline: 0.5,
      se: 0.01,
      turnDelta: 0,
      baselineTurns: 5,
      treatmentTurns: 5,
      turnSe: 0,
      n: 400,
      noisy: false,
    };
    const strong: ReturnType<typeof makePairedDelta> = {
      id: "fangs",
      delta: 0.4,
      winRate: 0.9,
      baseline: 0.5,
      se: 0.02,
      turnDelta: 0,
      baselineTurns: 5,
      treatmentTurns: 5,
      turnSe: 0,
      n: 400,
      noisy: false,
    };

    const model = emptyModel();
    model.cardsIsolatedElite = [paired("cleanse", noisy), paired("slash", clustered), paired("fangs", strong)];

    const result = evaluateBalanceFindings(model);
    expect(result.findings.some((finding) => finding.id.includes("cleanse"))).toBe(false);
    expect(result.findings.some((finding) => finding.scope === "card" && finding.id.includes("fangs"))).toBe(true);
  });

  it("uses duration confidence independently of win confidence", () => {
    const model = emptyModel();
    const base = makePairedDelta("base", { ...emptyPairedWinStats(), n: 100 });
    model.affixes = [
      paired("flat-physical", base),
      paired("flat-stun", base),
      paired("flat-holy", { ...base, noisy: true, turnDelta: 4, turnSe: 0.1 }),
      paired("flat-poison", { ...base, turnDelta: 8, turnSe: 10 }),
    ];
    const findings = evaluateBalanceFindings(model).findings;
    expect(findings.some((finding) => finding.id === "flat-holy:turns")).toBe(true);
    expect(findings.some((finding) => finding.id === "flat-poison:turns")).toBe(false);
  });

  it("checks enemy equity in early and mid game", () => {
    const model = emptyModel();
    model.enemies = ["skeleton", "goblin", "slime"].map((id, index) => ({
      id,
      rates: rates(
        emptyRateCell(),
        cell({ winRate: index === 0 ? 0.5 : 0.95 }),
        cell({ winRate: index === 0 ? 0.5 : 0.95 }),
      ),
    }));
    const findings = evaluateBalanceFindings(model).findings;
    expect(
      findings.some((finding) => finding.id === "skeleton" && finding.tier === "early" && finding.bucket === "equity"),
    ).toBe(true);
    expect(findings.some((finding) => finding.id === "skeleton" && finding.tier === "mid")).toBe(true);
  });

  it("flags anomaly spikes over threshold and ignores values under it", () => {
    const model = emptyModel();
    model.anomalyMetrics = [
      { field: "Player→Enemy Dmg", values: { early: 10, mid: 10, late: 400 } },
      { field: "Player Heal", values: { early: 10, mid: 10, late: 10 } },
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
    model.anomalyMetrics = Array.from({ length: 120 }, (_, index) => ({
      field: `metric-${index}`,
      values: { early: 0, mid: 0, late: 500 },
    }));
    const result = evaluateBalanceFindings(model);
    expect(result.findings.length).toBe(FINDINGS_CAP);
    expect(result.omitted).toBeGreaterThan(0);
    expect(result.totalBeforeCap).toBeGreaterThan(FINDINGS_CAP);
    expect(result.shownByBucket.anomaly).toBe(FINDINGS_CAP);
  });

  it("renders the effective findings cap consistently", () => {
    const model = emptyModel();
    model.anomalyMetrics = Array.from({ length: 10 }, (_, index) => ({
      field: `metric-${index}`,
      values: { early: 0, mid: 0, late: 500 },
    }));
    const findings = evaluateBalanceFindings(model, { findingsCap: 3 });
    const options = {
      iterations: 10,
      pairedIterations: 10,
      cardDeckSamples: 10,
      deckSeeds: 1,
      policy: "random-playable" as const,
      loadoutMode: "bare" as const,
      findingsCap: 3,
    };

    expect(findings.cap).toBe(3);
    expect(renderBalanceFindingsHtml(findings, model)).toContain("cap 3");
    expect(JSON.parse(renderBalanceFindingsJson(findings, model, options)).bands.cap).toBe(3);
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
          rates: rates(cell({ winRate: 0.1 + index * 0.05, averageTurns: 8 })),
          topCardsLate: [],
        });
      });
    }

    const model = emptyModel();
    model.classMatchups = matchups;
    model.enemies = [{ id: "goblin", rates: rates(cell({ winRate: 0.95, averageTurns: 2 })) }];
    model.classes = [
      {
        id: "wizard",
        rates: rates(cell({ winRate: 1, averageTurns: 3 })),
        ratesByType: {
          early: { normal: emptyRateCell(), elite: emptyRateCell(), boss: emptyRateCell() },
          mid: { normal: emptyRateCell(), elite: emptyRateCell(), boss: emptyRateCell() },
          late: { normal: emptyRateCell(), elite: emptyRateCell(), boss: emptyRateCell() },
        },
      },
    ];
    model.anomalyMetrics = [{ field: "Player→Enemy Dmg", values: { early: 10, mid: 10, late: 400 } }];
    model.anomalies = [
      { field: "Player→Enemy Dmg", maxValue: 400, battles: 3, peakScenario: "wizard vs frostwarden (Late)" },
    ];

    const result = evaluateBalanceFindings(model);
    const matchupWinRates = result.findings.filter(
      (finding) => finding.scope === "matchup" && finding.metric === "winRate",
    );
    expect(matchupWinRates.length).toBeLessThanOrEqual(bosses.length * 2);
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
