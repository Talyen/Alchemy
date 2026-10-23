export function resolvePushPaths(root: string, input: string): string[];
export function taskComparisonBase(root: string): string;

export function resolveSelectedPaths(
  root: string,
  selection: { flags?: Set<string>; paths: string[]; revision?: string },
): string[];

export function classifyCheckPaths(
  root: string,
  paths: string[],
): {
  needsCodeChecks: boolean;
  lockfile: boolean;
  desktop: boolean;
  web: boolean;
  localization: boolean;
  routeIds: string[];
};

export function parseChangedPathsArgs(
  argv: string[],
  options?: { usage?: string },
): {
  flags: Set<string>;
  paths: string[];
  revision?: string;
};
