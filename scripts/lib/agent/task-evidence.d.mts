export function taskCheckIsCurrent(
  receipt: Record<string, unknown>,
  current: { main: string; digest: { head: string; hash: string }; selected: string[] },
): boolean;
export function latestTaskCheck(
  checkout: string,
):
  | { file: string; receipt: Record<string, unknown>; current: boolean; error?: never }
  | { file: string; error: string; current: false; receipt?: never }
  | null;
