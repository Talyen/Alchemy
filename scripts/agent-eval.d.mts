export interface Evaluation extends Record<string, unknown> {
  task: string;
  baseRevision: string;
  variant: string;
  model: unknown;
  settings: unknown;
}

export function summarizeEvaluation(
  record: Record<string, unknown>,
  events: Array<Record<string, unknown>>,
): Evaluation;

export function compareEvaluations(
  before: Evaluation,
  after: Evaluation,
): { comparableCorrectness: boolean; deltaAfterMinusBefore: Record<string, number | null> };

export function loadEvaluation(filename: string): Evaluation;
