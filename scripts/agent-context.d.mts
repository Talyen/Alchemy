export const CONTEXT_OUTPUT_BYTES: number;

export function renderSourceOutline(
  declarations: ReturnType<typeof import("./lib/agent-context.mjs").sourceOutline>,
  symbol?: string | null,
  budget?: number,
): { text: string };

export function parseContextArgs(args: string[]): {
  paths: string[];
  task: string | null;
  diff: boolean;
  outline: string | null;
  symbol: string | null;
  json: boolean;
  tests: boolean;
  test: string | null;
};

export function renderContext(
  selection: ReturnType<typeof import("./lib/agent-context.mjs").selectContext>,
  sections: ReturnType<typeof import("./lib/agent-context.mjs").contextSections>,
  budget?: number,
): { text: string; included: ReturnType<typeof import("./lib/agent-context.mjs").contextSections> };
