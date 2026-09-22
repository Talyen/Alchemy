export function resolvePushPaths(root: string, input: string): string[];

export function resolveSelectedPaths(root: string, selection: { flags?: Set<string>; paths: string[] }): string[];

export function classifyCheckPaths(
  root: string,
  paths: string[],
): { needsCodeChecks: boolean; lockfile: boolean; desktop: boolean; web: boolean; routeIds: string[] };

export function parseChangedPathsArgs(
  argv: string[],
  options?: { usage?: string },
): {
  flags: Set<string>;
  paths: string[];
};
