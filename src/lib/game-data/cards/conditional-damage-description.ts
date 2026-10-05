import { createConditionalDamageLine } from "../effect-description";
import { renderCardDescription } from "../card-description-model";
import type { BattleCardEffect } from "../types";

export function conditionalDamageDescription(effect: BattleCardEffect): string | undefined {
  const line = createConditionalDamageLine(effect, { effectIndex: 0 });
  return line ? renderCardDescription([effect], [{ parts: line, role: "effect" }]).descriptionLines[0] : undefined;
}
