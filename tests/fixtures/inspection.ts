import type { InspectedPackets } from "@/lib/battle/inspection-outcomes";

/** Offensive power for the first packet of one authored effect, before mitigation. */
export function inspectedDamage(outcome: InspectedPackets | undefined): number | [number, number] | undefined {
  if (!outcome || outcome.kind === "unknown") return undefined;
  const alternatives = outcome.kind === "exact" ? [outcome.packets] : outcome.outcomes;
  if (!alternatives.length) return undefined;
  const amounts = alternatives.map((packets) => packets[0]?.amount ?? 0);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return min === max ? min : [min, max];
}
