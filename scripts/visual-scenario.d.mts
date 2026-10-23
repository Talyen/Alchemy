export const VISUAL_SCENARIOS: readonly string[];
export interface VisualScenarioOptions {
  list: false;
  scenario: string;
  label: string;
  locale: string;
  viewport: { width: number; height: number };
  seed: number;
  port: number;
  mode: "dev" | "preview";
  headed: boolean;
}
export function parseVisualScenarioArgs(argv: string[]): VisualScenarioOptions | { list: true };
export function runVisualScenario(argv?: string[]): Promise<number>;
