import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import type { BattleState } from "./types/state-types";
import type { NumericCombatTextEvent } from "./types/state-types";

export type ObservedAttack = Extract<BattleCardEffect, { kind: "damage" }>;
export type ObservedDirectAmount = Pick<NumericCombatTextEvent, "target" | "kind" | "stat" | "amount">;

/** Execution-only observations. No observer or projection belongs in a saved battle. */
export interface BattleResolutionObserver {
  step: () => void;
  effect: <T>(card: BattleCard, effect: BattleCardEffect, execute: () => T) => T;
  branch: (effect: Extract<BattleCardEffect, { kind: "chance" }>, success: boolean) => void;
  attack: (packet: ObservedAttack) => void;
  directFeedback?: (amounts: readonly ObservedDirectAmount[]) => void;
  unknownDraw: () => never;
}

export function observeAttackPower(state: BattleState, effect: ObservedAttack, amount: number): void {
  state.observer?.attack({
    kind: "damage",
    damageType: effect.damageType,
    amount,
    ...(effect.lifesteal ? { lifesteal: true } : {}),
    ...(effect.ignoreArmor ? { ignoreArmor: true } : {}),
    ...(effect.ignoreBlock ? { ignoreBlock: true } : {}),
    ...(effect.detonateAllBurn ? { detonateAllBurn: true } : {}),
    ...(effect.detonateAllBleed ? { detonateAllBleed: true } : {}),
  });
}
