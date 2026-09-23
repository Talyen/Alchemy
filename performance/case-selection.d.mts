export interface CaseSelection {
  scenario: string;
  seed: number;
  hero: string;
  mode: string;
  difficulty: string;
  policy: string;
  checkpoint: string;
  exploratory: boolean;
}

export const REALISTIC_SCENARIOS: string[];
export function selectCase(scenario: string, seed?: number): CaseSelection;
export function chooseCheckpointStep(
  caseSpec: CaseSelection,
  result: {
    telemetry?: { battleSnapshots?: Array<{ stage: string; step: number; run: number; room: number }> };
    journal: Array<{ step: number; action: { kind: string } }>;
  },
): number | undefined;
