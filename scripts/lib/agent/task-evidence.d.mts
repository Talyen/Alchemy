export function taskCheckIsCurrent(
  receipt: Record<string, unknown>,
  current: { main: string; digest: { head: string; hash: string }; selected: string[] },
): boolean;
export function latestTaskCheck(checkout: string): unknown;
