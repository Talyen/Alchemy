import { inspectBattleCardDamage } from "@/lib/battle/card-damage-inspection";
import type { BattleSnapshot } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";

/** Observed attack amounts in authored order, retaining uncertain ranges. */
export function inspectedAttackAmounts(card: BattleCard, state: BattleSnapshot, side: "player" | "enemy" = "player") {
  const outcomes = inspectBattleCardDamage(card, state, side);
  return card.effects.flatMap((effect, index): Array<number | [number, number]> => {
    if (
      effect.kind !== "damage" &&
      effect.kind !== "random-damage" &&
      effect.kind !== "cleanse-player-status-to-damage"
    )
      return [];
    const outcome = outcomes.get(String(index));
    if (!outcome || outcome.kind === "unknown") throw new Error(`Unknown attack outcome at ${index}`);
    const alternatives = outcome.kind === "exact" ? [outcome.packets] : outcome.outcomes;
    const count = Math.max(1, ...alternatives.map((packets) => packets.length));
    return Array.from({ length: count }, (_, packetIndex): number | [number, number] => {
      const amounts = alternatives.map((packets) => packets[packetIndex]?.amount ?? 0);
      const min = Math.min(...amounts);
      const max = Math.max(...amounts);
      return min === max ? min : [min, max];
    });
  });
}
