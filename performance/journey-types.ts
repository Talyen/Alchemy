export interface JourneyCase {
  version: 1;
  scenario: string;
  seed: number;
  hero: string;
  mode: string;
  difficulty: string;
  policy: string;
  checkpoint: string;
  checkpointStep: number;
  exploratory: boolean;
  saveHash: string;
  codeIdentity?: { commit: string; sourceHash: string };
  initialSave: Record<string, unknown>;
  coverage: Record<string, unknown>;
  recordedActions?: JourneyAction[];
}

export interface JourneyAction {
  name: string;
  segment: string;
  timeMs: number;
}

export interface SegmentRequirement {
  name: string;
  minActions: number;
  minFrames: number;
}

export function assertJourneyCase(value: unknown): asserts value is JourneyCase {
  const candidate = value as Partial<JourneyCase> | null;
  if (
    !candidate ||
    candidate.version !== 1 ||
    typeof candidate.scenario !== "string" ||
    !Number.isSafeInteger(candidate.seed) ||
    !candidate.initialSave ||
    typeof candidate.saveHash !== "string" ||
    !Array.isArray(candidate.coverage?.cards)
  ) {
    throw new Error("Invalid performance journey case");
  }
}
