import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "../../types";
import { applyGainMaxManaEffect } from "../gain-max-mana/apply";
import { applyLoseManaEffect } from "../lose-mana/apply";
import { applyLoseMaxManaEffect } from "../lose-max-mana/apply";
import { applyRestoreManaEffect } from "../restore-mana/apply";

const manaCardStub = { id: "", title: "", descriptionLines: [""], art: "", cost: 0, effects: [] } as BattleCard;

export function handleManaEffect(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "restore-mana" | "lose-mana" | "gain-max-mana" | "lose-max-mana" }>,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  switch (effect.kind) {
    case "restore-mana":
      return applyRestoreManaEffect(state, manaCardStub, effect, potionMult, combatTexts);
    case "lose-mana":
      return applyLoseManaEffect(state, manaCardStub, effect, potionMult, combatTexts);
    case "gain-max-mana":
      return applyGainMaxManaEffect(state, manaCardStub, effect, potionMult, combatTexts);
    case "lose-max-mana":
      return applyLoseMaxManaEffect(state, manaCardStub, effect, potionMult, combatTexts);
  }
}
