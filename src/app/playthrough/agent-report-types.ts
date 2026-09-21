import type { CareerResult } from "./types";

export const MILESTONE_KINDS = [
  "talent",
  "building",
  "farm",
  "research",
  "bond",
  "equip",
  "equip-trinket",
  "craft",
  "salvage",
] as const;

type MilestoneKind = (typeof MILESTONE_KINDS)[number];

export type MaybeNumber = number | null;

interface AgentCodeIdentity {
  head: string;
  sourceHash: string;
}

export interface AgentEvidenceSelector {
  seeds?: number[];
  runs?: number[];
  rooms?: { min?: number; max?: number };
  enemies?: string[];
  outcomes?: string[];
}

type AgentFindingKind = "integrity" | "balance-signal" | "progression-signal" | "coverage-gap";

type AgentFindingPriority = "high" | "medium" | "low";

type AgentFindingConfidence = "high" | "moderate" | "directional" | "insufficient";

export interface AgentFinding {
  id: string;
  cohort?: string;
  kind: AgentFindingKind;
  priority: AgentFindingPriority;
  confidence: AgentFindingConfidence;
  title: string;
  claim: string;
  evidence: Record<string, number | string>;
  interpretation: string;
  nextStep: string;
  selector?: AgentEvidenceSelector;
}

export interface AgentDistribution {
  count: number;
  min: MaybeNumber;
  q25: MaybeNumber;
  median: MaybeNumber;
  mean: MaybeNumber;
  q75: MaybeNumber;
  max: MaybeNumber;
}

export interface AgentMilestoneMetric {
  kind: MilestoneKind;
  reached: number;
  careers: number;
  rate: number;
  meanFirstRunAmongReached: MaybeNumber;
}

interface AgentBattleEnemyMetric {
  enemy: string;
  boss: boolean;
  encounters: number;
  victories: number;
  defeats: number;
  winRate: number;
  meanTurns: MaybeNumber;
}

export interface AgentBattleMetrics {
  encounters: number;
  victories: number;
  defeats: number;
  winRate: number;
  meanTurns: MaybeNumber;
  bosses: {
    encounters: number;
    victories: number;
    defeats: number;
    winRate: number;
  };
  byEnemy: AgentBattleEnemyMetric[];
}

export interface AgentRunProgression {
  careers: number;
  firstRunMeanRooms: MaybeNumber;
  finalRunMeanRooms: MaybeNumber;
  meanRoomDelta: MaybeNumber;
  improved: number;
  worsened: number;
  tied: number;
}

export interface AgentRunOutcomeMetric {
  run: number;
  runs: number;
  victories: number;
  defeats: number;
  victoryRate: number;
  meanRooms: MaybeNumber;
}

export interface AgentDeckCohesion {
  samples: number;
  heroKeywordShare: MaybeNumber;
  dominantKeywordShare: MaybeNumber;
  topKeywords: Array<{ keyword: string; count: number }>;
}

export interface AgentCohortSummary {
  cohort: string;
  planned: number;
  completed: number;
  incomplete: number;
  runs: number;
  sampleSeeds: number[];
  outcomes: Record<string, number>;
  terminalRooms: AgentDistribution;
  terminalGold: AgentDistribution;
  survivalByRoom: Array<{ room: number; reached: number; defeats: number; denominator: number; rate: number }>;
  battles: AgentBattleMetrics;
  progression: AgentRunProgression;
  runOutcomes: AgentRunOutcomeMetric[];
  firstVictoryRun: Record<string, number>;
  neverWon: number;
  deckCohesion: AgentDeckCohesion;
  milestones: AgentMilestoneMetric[];
  coverageGaps: AgentMilestoneMetric[];
  findings: AgentFinding[];
}

export interface AgentPlaythroughSummary {
  version: 1;
  planned: number;
  completed: number;
  incomplete: number;
  codeIdentity?: AgentCodeIdentity;
  cohorts: AgentCohortSummary[];
  findings: AgentFinding[];
  recommendations: string[];
  artifacts: {
    reportJson: "playthrough.json";
    reportHtml: "playthrough.html";
    summaryJson: "agent-summary.json";
    summaryMarkdown: "agent-summary.md";
    careerBundles: "career-<index>-<seed>.json";
    journals: "career-<index>-<seed>.journal.jsonl";
  };
}

export interface AgentSummaryOptions {
  planned?: number;
  codeIdentity?: AgentCodeIdentity;
  workerFailures?: string[];
}

export type CompletedCareer = CareerResult & { status: "completed" };

export type CareerRun = CompletedCareer["outcomes"][number] & { seed: number; run: number };

export type Battle = CompletedCareer["telemetry"]["battles"][number] & { seed: number };
