export interface ReviewChoice {
  choice: string;
  notes: string;
  reviewed: boolean;
}
export interface ChoiceMapping {
  choiceFrom?: string;
  id: string;
  title: string;
  candidates: Array<{ assetId: string }>;
  currentFiles: string[];
  currentState: string;
}
export function restoreChoices(mappings: ChoiceMapping[], stored: unknown): Record<string, ReviewChoice>;
export function importChoices(
  payload: unknown,
  mappings: ChoiceMapping[],
): { choices: Record<string, ReviewChoice>; skipped: number };
export function buildChoicesExport(
  report: { generatedAt: string; direction: string; mappings: ChoiceMapping[] },
  choices: Record<string, ReviewChoice>,
): {
  schemaVersion: number;
  exportedAt: string;
  reportGeneratedAt: string;
  direction: string;
  note: string;
  choices: Array<
    ReviewChoice & {
      mappingId: string;
      title: string;
      candidate: ChoiceMapping["candidates"][number] | null;
      currentFiles: string[];
      currentState: string;
    }
  >;
};
