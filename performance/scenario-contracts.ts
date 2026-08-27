export function talentCategoryButtonName(keyword: string): string {
  return `Select ${keyword} Talents`;
}

export type BattleProgressState = "pending" | "stage-ready" | "battle-over";

export function battleProgressState(battleOver: boolean, markCount: number, beforeCount: number): BattleProgressState {
  if (battleOver) return "battle-over";
  if (markCount > beforeCount) return "stage-ready";
  return "pending";
}

export function requirePositiveFiniteObservation(name: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid performance observation ${name}: ${String(value)}`);
  }
  return value;
}
