import type { Stats } from "node:fs";

export function evidenceDeduplicator(options?: {
  platform?: NodeJS.Platform;
  attributes?: (file: string) => boolean;
  clone?: (source: string, target: string) => void;
}): (file: string, stat: Stats, relative: string) => void;
export function removeIntegratedWorktree(main: string, task: string, branch: string, head: string): string | null;
export function slugify(value: string): string;
export function linkDependencies(mainRoot: string, targetWorktree: string): boolean;
export function main(argv?: string[]): Promise<void>;
