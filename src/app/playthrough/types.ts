import type { BattleAnomalies } from "@/lib/balance/anomalies";
import type { BalancePlayPolicy } from "@/lib/balance/simulator-types";
import type { CharacterId, DifficultyId } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { UnstampedSaveData } from "@/features/alchemy/shared/storage";

export interface CareerConfig {
  seed: number;
  hero: CharacterId;
  mode: ContentSystemId;
  difficulty: DifficultyId;
  runs: number;
  horizon: number;
  maxSteps: number;
  maxTurns: number;
  combatPolicy: BalancePlayPolicy;
  policy: "archetype" | "random" | "minimalist";
  resumeAt?: number;
  diagnosticFault?: { at: number; stage: "execution" | "post-commit" };
  initialSave?: UnstampedSaveData;
}
export interface PlayerChoice {
  kind: string;
  id: string;
  index?: number;
  score: number;
}
export interface JournalEntry {
  action: PlayerChoice;
  before: string;
  step: number;
  beforeRevision: number;
  policyDraws: number;
  afterRevision?: number;
  after?: string;
  error?: string;
  stage?: "execution" | "post-commit";
}
export interface CareerResult {
  version: 1;
  config: CareerConfig;
  cohort: "fresh-save" | "targeted";
  status: "completed" | "incomplete";
  error?: string;
  journal: JournalEntry[];
  outcomes: Array<{ outcome: string; rooms: number; gold: number; steps: number }>;
  coverage: Record<string, number>;
  initialSave: UnstampedSaveData;
  finalSave: UnstampedSaveData;
  elapsedMs: number;
  timings: { observationMs: number; actionMs: number; validationMs: number; persistenceMs: number };
  saveChecks: number;
  resumeChecks: number;
  telemetry: {
    anomalies: BattleAnomalies;
    cards: Record<string, { observed: number; playable: number; chosen: number }>;
    economy: Array<{
      step: number;
      run: number;
      act: number;
      rooms: number;
      gold: number;
      health: number;
      materials: number;
      deckSize: number;
    }>;
    battles: Array<{ enemy: string; boss: boolean; outcome: string; turns: number; run: number; room: number }>;
    milestones: Record<string, number>;
  };
}
