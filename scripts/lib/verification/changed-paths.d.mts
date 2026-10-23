export function resolvePushPaths(root: string, input: string): string[];
export function taskComparisonBase(root: string): string;

export function resolveSelectedPaths(
  root: string,
  selection: { flags?: Set<string>; paths: string[]; revision?: string },
): string[];

export function parseChangedPathsArgs(
  argv: string[],
  options?: { usage?: string },
): {
  flags: Set<string>;
  paths: string[];
  revision?: string;
};
