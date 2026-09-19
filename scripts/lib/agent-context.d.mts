export interface Section {
  path: string;
  heading?: string | null;
  start: number;
  end: number;
  text: string;
}

export interface Selection {
  tasks: string[];
  docs: Array<{ path: string; heading: string | null }>;
  entrypoints: string[];
  plan: { commands: Array<{ key: string }> };
}

export const CONTEXT_TASKS: Record<string, unknown>;

export function selectContext(paths: string[], task?: string): Selection;

export function contextSections(root: string, selection: Selection): Section[];

export { sourceOutline } from "./source-outline.mjs";
export function validateContextCatalog(root: string): string[];
