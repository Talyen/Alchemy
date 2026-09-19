export function runGit(
  root: string,
  args: string[],
  options?: { uncached?: boolean; stdio?: unknown },
): { status: number | null; stdout: string; stderr: string; error?: Error };

export function toRepoRelative(
  root: string,
  file: string,
  options?: { onOutside?: "throw" | "keep-relative" | "basename" },
): string;

export function listRepositoryFiles(root: string): string[];

export function expandRepositoryPaths(root: string, paths: string[]): string[];
