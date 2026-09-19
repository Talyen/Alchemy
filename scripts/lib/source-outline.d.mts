import type { Section } from "./agent-context.mjs";
export interface SourceEntry extends Section {
  name: string;
  setup?: string[];
}
export function sourceOutline(
  root: string,
  filename: string,
  options?: { entries?: boolean; tests?: boolean },
): SourceEntry[];
