import { selectorForDefeats } from "./agent-report-metrics";
import type {
  AgentBattleMetrics,
  AgentDeckCohesion,
  AgentDistribution,
  AgentFinding,
  AgentMilestoneMetric,
  AgentRunOutcomeMetric,
  AgentRunProgression,
  Battle,
  CareerRun,
  CompletedCareer,
} from "./agent-report-types";

export function buildFindings(
  cohort: string,
  careers: CompletedCareer[],
  runs: CareerRun[],
  battles: Battle[],
  terminalRooms: AgentDistribution,
  battleMetrics: AgentBattleMetrics,
  progression: AgentRunProgression,
  runOutcomes: AgentRunOutcomeMetric[],
  firstVictoryRun: Record<string, number>,
  neverWon: number,
  deckCohesion: AgentDeckCohesion,
  coverageGaps: AgentMilestoneMetric[],
): AgentFinding[] {
  const findings: AgentFinding[] = [];
  const victories = runs.filter((run) => run.outcome === "victory").length;
  const defeats = runs.filter((run) => run.outcome === "defeat").length;

  if (!careers.length) {
    findings.push({
      id: "no-completed-telemetry",
      kind: "integrity",
      priority: "high",
      confidence: "high",
      title: "No completed career telemetry is available",
      claim: "This cohort cannot support gameplay conclusions yet.",
      evidence: { cohort, completedCareers: 0 },
      interpretation: "Investigate the incomplete-career errors before using this cohort for balance analysis.",
      nextStep: "Inspect the bounded worker failure output and replay the first incomplete career.",
    });
    return findings;
  }

  if (victories === 0) {
    findings.push({
      id: "no-full-victories",
      kind: "balance-signal",
      priority: "high",
      confidence: "directional",
      title: "No full victories were observed",
      claim: "Every completed run in this cohort ended in defeat.",
      evidence: { runs: runs.length, victories, defeats },
      interpretation:
        "This may reflect campaign difficulty, the autoplay policy, or route variance; it does not isolate a balance defect.",
      nextStep: "Run the same seeds with alternate combat policies before changing enemy or card tuning.",
      selector: { seeds: [...new Set(runs.map((run) => run.seed))].slice(0, 12), outcomes: ["defeat"] },
    });
  }

  if (runOutcomes.length >= 2 && (victories > 0 || neverWon > 0)) {
    const firstVictoryTotal = Object.values(firstVictoryRun).reduce((sum, count) => sum + count, 0);
    findings.push({
      id: "first-victory-timing",
      kind: "progression-signal",
      priority: "medium",
      confidence: "directional",
      title: "First-victory timing is measurable for this cohort",
      claim: `${firstVictoryTotal}/${careers.length} careers recorded a victory; ${neverWon} careers had none within the configured run budget.`,
      evidence: {
        firstVictoryRuns: Object.entries(firstVictoryRun)
          .map(([run, count]) => `run${run}=${count}`)
          .join(", "),
        neverWon,
        runBudget: runOutcomes.length,
      },
      interpretation:
        "Use this distribution to judge whether progression feels smooth; it is not a balance gate by itself.",
      nextStep:
        "Repeat with the same seeds after policy changes and compare the first-victory distribution, not only final win rate.",
    });
  }

  if (deckCohesion.samples >= 5) {
    findings.push({
      id: "deck-archetype-cohesion",
      kind: "progression-signal",
      priority: "medium",
      confidence: "directional",
      title: "Deck/archetype cohesion is now observable",
      claim: `${deckCohesion.samples} run snapshots produced a dominant keyword share of ${deckCohesion.dominantKeywordShare ?? "n/a"}%.`,
      evidence: {
        samples: deckCohesion.samples,
        heroKeywordShare: deckCohesion.heroKeywordShare ?? "n/a",
        dominantKeywordShare: deckCohesion.dominantKeywordShare ?? "n/a",
        topKeywords: deckCohesion.topKeywords.map((entry) => `${entry.keyword}=${entry.count}`).join(", "),
      },
      interpretation:
        "Low or unstable cohesion can indicate a policy mismatch; Wildcard is expected to form cohesion dynamically rather than match fixed hero keywords.",
      nextStep:
        "Compare cohesion and first-victory timing across archetype, random, and minimalist policies before changing card content.",
    });
  }

  if (defeats > 0 && terminalRooms.median !== null) {
    const lateRoom = Math.max(1, Math.round(terminalRooms.median));
    const lateDefeats = battles.filter((battle) => battle.outcome === "defeat" && battle.room >= lateRoom).length;
    // Attention heuristic only; this is deliberately not a balance gate.
    if (lateDefeats >= 5 && lateDefeats / defeats >= 0.5) {
      findings.push({
        id: "late-run-attrition",
        kind: "balance-signal",
        priority: "high",
        confidence: "directional",
        title: "Defeats concentrate in the later half of runs",
        claim: `${lateDefeats}/${defeats} defeat battles occurred at or after room ${lateRoom}, the cohort median terminal room.`,
        evidence: {
          lateDefeats,
          totalDefeats: defeats,
          thresholdRoom: lateRoom,
          medianTerminalRoom: terminalRooms.median,
        },
        interpretation:
          "The observed bottleneck may be combat scaling, attrition between recovery points, route selection, or autoplay strategy.",
        nextStep: "Compare alternate combat policies and inspect state snapshots immediately before late defeats.",
        selector: selectorForDefeats(battles, lateRoom),
      });
    }
  }

  const bossCandidates = battleMetrics.byEnemy.filter((enemy) => enemy.boss && enemy.encounters >= 5);
  const weakestBoss = [...bossCandidates].sort((a, b) => a.winRate - b.winRate)[0];
  if (weakestBoss && weakestBoss.winRate < 85) {
    findings.push({
      id: "boss-pressure",
      kind: "balance-signal",
      priority: "medium",
      confidence: "directional",
      title: `${weakestBoss.enemy} is the weakest sufficiently sampled boss`,
      claim: `${weakestBoss.victories}/${weakestBoss.encounters} encounters were victories (${weakestBoss.winRate}%).`,
      evidence: {
        enemy: weakestBoss.enemy,
        encounters: weakestBoss.encounters,
        winRate: weakestBoss.winRate,
        meanTurns: weakestBoss.meanTurns ?? "n/a",
      },
      interpretation:
        "This is an investigation target, not a tuning verdict; the autoplay policy and encounter selection may contribute.",
      nextStep: "Rerun this cohort with a defensive policy and inspect the boss-start state before changing the boss.",
      selector: { enemies: [weakestBoss.enemy] },
    });
  }

  if (progression.careers > 0 && progression.meanRoomDelta !== null && progression.meanRoomDelta !== 0) {
    findings.push({
      id: "run-progression-lift",
      kind: "progression-signal",
      priority: "medium",
      confidence: "directional",
      title:
        progression.meanRoomDelta > 0
          ? "Later runs reach farther than first runs"
          : "Later runs reach fewer rooms than first runs",
      claim: `The final run changed terminal room count by ${progression.meanRoomDelta > 0 ? "+" : ""}${progression.meanRoomDelta} rooms on average.`,
      evidence: {
        careersCompared: progression.careers,
        firstRunMeanRooms: progression.firstRunMeanRooms ?? "n/a",
        finalRunMeanRooms: progression.finalRunMeanRooms ?? "n/a",
        improved: progression.improved,
        worsened: progression.worsened,
        tied: progression.tied,
      },
      interpretation:
        "The signal is compatible with meaningful meta-progression, but runs share a career and are not independent samples.",
      nextStep:
        "Repeat with more sequential runs and separate progression effects from seed variance with paired fresh-save cohorts.",
    });
  }

  if (coverageGaps.length) {
    const names = coverageGaps.map((gap) => gap.kind).join(", ");
    findings.push({
      id: "progression-coverage-gaps",
      kind: "coverage-gap",
      priority: "low",
      confidence: "high",
      title: "Several progression systems were not consistently reached",
      claim: `The fresh-save sample has incomplete exposure to: ${names}.`,
      evidence: Object.fromEntries(coverageGaps.slice(0, 6).map((gap) => [gap.kind, `${gap.reached}/${gap.careers}`])),
      interpretation: "This is a measurement gap, not evidence that those systems are broken or unaffordable.",
      nextStep:
        "Use labeled targeted fixtures for homestead and crafting coverage, keeping them separate from fresh-save balance rates.",
    });
  }

  return findings;
}
