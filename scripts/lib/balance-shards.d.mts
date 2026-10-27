export function readBalanceShards(
  mergeDir: string,
  identity: unknown,
  expected: ReadonlyArray<readonly [string, number]>,
  sourceCommit: string | undefined,
): Array<{ name: string; filename: string; value: unknown }>;
