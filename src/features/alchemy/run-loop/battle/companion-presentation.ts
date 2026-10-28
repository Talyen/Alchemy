import { isAttackCard, type BattleSnapshot } from "@/lib/battle";
import type { BattlePresentationPort } from "./battle-presentation-store";

export function presentCompanionAction(
  presentation: BattlePresentationPort,
  companion: BattleSnapshot["activeCompanion"],
) {
  if (!companion) return;
  presentation.shakeCompanion();
  // Companion cues share the hero portrait; utility actions must brace, not lunge.
  if (isAttackCard({ effects: companion.turnStartEffects })) presentation.telegraphAttack("companion");
  else presentation.telegraphCast("companion");
}
