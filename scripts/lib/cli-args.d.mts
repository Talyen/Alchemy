export function parseKnownFlags(
  argv: string[],
  spec?: Record<string, { short?: string; takesValue?: boolean }>,
  options?: { usage?: string },
): { flags: Set<string>; values: Map<string, string[]>; rest: string[] };
