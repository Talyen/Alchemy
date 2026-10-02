import type { BalanceFinding } from "./findings-types";

const REVIEW_SUFFIX = " Discuss before applying a change.";

export type FindingContext = Pick<BalanceFinding, "scope" | "id" | "title" | "tier" | "worstScenario" | "causeHint">;
export type FindingDetails = Omit<BalanceFinding, keyof FindingContext>;

export function finding(context: FindingContext, details: FindingDetails): BalanceFinding {
  return { ...context, ...details, recommendation: `${details.recommendation}${REVIEW_SUFFIX}` };
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const high = sorted[mid] ?? 0;
  if (sorted.length % 2 === 1) return high;
  const low = sorted[mid - 1] ?? high;
  return (low + high) / 2;
}
