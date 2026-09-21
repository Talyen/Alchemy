import { buildFindings } from "./agent-report-findings";
import {
  buildBattles,
  buildDeckCohesion,
  buildFirstVictoryRun,
  buildMilestones,
  buildRunOutcomes,
  buildRunProgression,
  buildSurvival,
  distribution,
  rate,
  round,
} from "./agent-report-metrics";
import type {
  AgentCohortSummary,
  AgentFinding,
  AgentPlaythroughSummary,
  AgentSummaryOptions,
  CompletedCareer,
} from "./agent-report-types";
import { careerCohort } from "./progress-telemetry";
import type { CareerResult } from "./types";

function buildCohortSummary(cohort: string, cohortResults: CareerResult[]): AgentCohortSummary {
  const careers = cohortResults.filter((result): result is CompletedCareer => result.status === "completed");
  const runs = careers.flatMap((career) =>
    career.outcomes.map((outcome, run) => ({ ...outcome, seed: career.config.seed, run })),
  );
  const { battles, metrics: battleMetrics } = buildBattles(careers);
  const terminalRooms = distribution(runs.map((run) => run.rooms));
  const terminalGold = distribution(runs.map((run) => run.gold));
  const milestones = buildMilestones(careers);
  const coverageGaps = milestones.filter((milestone) => milestone.reached < milestone.careers);
  const progression = buildRunProgression(careers);
  const runOutcomes = buildRunOutcomes(careers);
  const firstVictory = buildFirstVictoryRun(careers);
  const deckCohesion = buildDeckCohesion(careers);
  const findings = buildFindings(
    cohort,
    careers,
    runs,
    battles,
    terminalRooms,
    battleMetrics,
    progression,
    runOutcomes,
    firstVictory.distribution,
    firstVictory.neverWon,
    deckCohesion,
    coverageGaps,
  );
  const outcomes = Object.fromEntries(
    [...new Set(runs.map((run) => run.outcome))].map((outcome) => [
      outcome,
      runs.filter((run) => run.outcome === outcome).length,
    ]),
  );
  return {
    cohort,
    planned: cohortResults.length,
    completed: careers.length,
    incomplete: cohortResults.length - careers.length,
    runs: runs.length,
    sampleSeeds: [...new Set(cohortResults.map((result) => result.config.seed))].slice(0, 12),
    outcomes,
    terminalRooms,
    terminalGold,
    survivalByRoom: buildSurvival(runs),
    battles: battleMetrics,
    progression,
    runOutcomes,
    firstVictoryRun: firstVictory.distribution,
    neverWon: firstVictory.neverWon,
    deckCohesion,
    milestones,
    coverageGaps,
    findings,
  };
}

function compactError(error: string): string {
  return error.replace(/\s+/g, " ").trim().slice(0, 240);
}

export function buildAgentPlaythroughSummary(
  results: CareerResult[],
  options: AgentSummaryOptions = {},
): AgentPlaythroughSummary {
  const groups = new Map<string, CareerResult[]>();
  for (const result of results) {
    const cohort = careerCohort(result);
    groups.set(cohort, [...(groups.get(cohort) ?? []), result]);
  }
  const cohorts = [...groups].map(([cohort, cohortResults]) => buildCohortSummary(cohort, cohortResults));
  const workerFailures = (options.workerFailures ?? []).filter(Boolean).slice(0, 3);
  const findings: AgentFinding[] = cohorts.flatMap((cohort) =>
    cohort.findings.map((finding) => ({ ...finding, cohort: cohort.cohort })),
  );
  if (workerFailures.length) {
    findings.unshift({
      id: "worker-failures",
      kind: "integrity",
      priority: "high",
      confidence: "high",
      title: "One or more careers failed before telemetry completed",
      claim: `${workerFailures.length} worker failure${workerFailures.length === 1 ? "" : "s"} require investigation.`,
      evidence: Object.fromEntries(
        workerFailures.map((failure, index) => [`failure${index + 1}`, compactError(failure)]),
      ),
      interpretation:
        "Incomplete careers are excluded from gameplay-rate findings and should not be counted as defeats.",
      nextStep: "Replay the first incomplete career using its preserved bundle.",
    });
  }
  const heroCohorts = cohorts
    .map((cohort) => ({ cohort, hero: cohort.cohort.split("/")[1] ?? "unknown" }))
    .filter((entry) => entry.hero !== "unknown");
  if (new Set(heroCohorts.map((entry) => entry.hero)).size >= 2) {
    const heroRates = heroCohorts.map(({ cohort, hero }) => {
      const victories = cohort.runOutcomes.reduce((sum, run) => sum + run.victories, 0);
      const runs = cohort.runOutcomes.reduce((sum, run) => sum + run.runs, 0);
      return { hero, rate: rate(victories, runs), runs };
    });
    const weakest = [...heroRates].sort((a, b) => a.rate - b.rate)[0]!;
    const strongest = [...heroRates].sort((a, b) => b.rate - a.rate)[0]!;
    findings.unshift({
      id: "hero-variance",
      kind: "balance-signal",
      priority: "high",
      confidence: "directional",
      title: "Hero victory rates vary across the supplied cohorts",
      claim: `${strongest.hero} is at ${strongest.rate}% and ${weakest.hero} is at ${weakest.rate}% across paired cohort runs.`,
      evidence: {
        heroes: heroRates.map((entry) => `${entry.hero}=${entry.rate}%/${entry.runs}`).join(", "),
        spread: round(strongest.rate - weakest.rate),
      },
      interpretation:
        "Targeted cohorts identify a balance signal but do not establish earned unlock or fresh-save progression parity.",
      nextStep: "Compare adaptive policy results on the same seed manifest before changing any hero content.",
    });
  }
  const recommendations = [
    ...new Set(
      findings
        .map((finding) => finding.nextStep)
        .concat(
          cohorts.length > 1
            ? "Compare cohorts with the same seed manifest before making cross-hero or cross-mode balance changes."
            : "Broaden the next sweep across heroes, modes, or combat policies while keeping seed lists paired.",
        ),
    ),
  ];
  return {
    version: 1,
    planned: options.planned ?? results.length,
    completed: results.filter((result) => result.status === "completed").length,
    incomplete: results.filter((result) => result.status !== "completed").length,
    ...(options.codeIdentity ? { codeIdentity: options.codeIdentity } : {}),
    cohorts,
    findings,
    recommendations,
    artifacts: {
      reportJson: "playthrough.json",
      reportHtml: "playthrough.html",
      summaryJson: "agent-summary.json",
      summaryMarkdown: "agent-summary.md",
      careerBundles: "career-<index>-<seed>.json",
      journals: "career-<index>-<seed>.journal.jsonl",
    },
  };
}
export { renderAgentPlaythroughSummaryMarkdown } from "./agent-report-markdown";
export type { AgentPlaythroughSummary } from "./agent-report-types";
