export interface Selection {
  tasks: string[];
  docs: Array<{ path: string; heading: string | null }>;
  entrypoints: string[];
}
export const CONTEXT_TASKS: Record<string, { matches: RegExp; docs: Selection["docs"]; entrypoints: string[] }>;
export function selectContext(paths: string[], task?: string | string[]): Selection;
export function validateContextCatalog(root: string): string[];
