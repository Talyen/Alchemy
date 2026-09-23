export function latestVersionTag(root: string): string | null;

export function previousVersionTag(root: string, currentTag: string): string | null;

export function latestCommitHash(root: string, short?: boolean): string;

export function resolvePatchNoteRange(
  root: string,
  releaseTag?: string | null,
): { since: string | null; until: string };

export function getCommitsSinceTag(
  root: string,
  tag: string | null,
  options?: { until?: string },
): Array<{ subject: string; body: string; files: string[] }> | null;
