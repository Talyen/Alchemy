export interface CaseSelection {
  scenario: string;
  seed: number;
  hero: string;
  mode: string;
  difficulty: string;
  policy: string;
  checkpoint: string;
  exploratory: boolean;
  discoveryVersion?: 1;
}

export const REALISTIC_SCENARIOS: string[];
export function isUsableDiscoveryResult(
  caseSpec: Pick<CaseSelection, "exploratory">,
  result: { status: string; error?: string },
): boolean;
export function chooseDiscoveryIndex(seed: number, label: string, count: number): number;
export function selectDiscoverySeed(cycle: number, slot: number): number;
export function selectCase(scenario: string, seed?: number): CaseSelection;
export function chooseCheckpointStep(
  caseSpec: CaseSelection,
  result: {
    telemetry?: { battleSnapshots?: Array<{ stage: string; step: number; run: number; room: number; boss?: boolean }> };
    journal: Array<{ step: number; action: { kind: string } }>;
  },
): number | undefined;
