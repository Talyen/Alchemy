import type { BattleCard } from "@/lib/game-data";
import { getEditableCorruptionTargets, updateCardNumericValue } from "@/lib/corruption";
import { getCorruptionTargetEffect } from "@/lib/corruption/numeric";

export function upgradeWishCard(card: BattleCard): BattleCard {
  const targets = getEditableCorruptionTargets(card).sort(
    (a, b) => b.lineIndex - a.lineIndex || b.matchIndex - a.matchIndex,
  );
  return targets.reduce((next, target) => {
    const effect = getCorruptionTargetEffect(next, target);
    // An upgrade must not raise a cost, including a shared Deal/Receive amount.
    if (!effect || target.affectsCost) return next;
    return updateCardNumericValue(next, target, target.value + 1);
  }, card);
}
