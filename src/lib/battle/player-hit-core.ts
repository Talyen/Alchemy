import type { BattleCard, BattleCardEffect, DamageType } from "@/lib/game-data";
import { applyDrawResult, drawFromState } from "./draw";
import { gainManaWithCombatText } from "./player-rewards";
import { rollTalentChance } from "./status-helpers";
import { damageEnemyHealth, type BattleState, type CombatTextEvent } from "./types";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";

/** Eligibility is captured before reactions; Health belongs to the actual target of this hit. */
export interface HitFacts {
  readonly eligibility: BattleState;
  readonly previousHealth: number;
  readonly enemyWasAlive: boolean;
  readonly killed: boolean;
  readonly resolvedDamage: number;
  readonly healthDamage: number;
  readonly critical: boolean;
}

export function applyHitHealth(state: BattleState, resolvedDamage: number, eligibility = state, critical = false) {
  const hit = damageEnemyHealth(state, resolvedDamage);
  const facts: HitFacts = {
    eligibility,
    previousHealth: hit.previousHealth,
    enemyWasAlive: hit.enemyWasAlive,
    killed: hit.killed,
    resolvedDamage,
    healthDamage: hit.healthDamage,
    critical,
  };
  return { state: hit.state, facts };
}

type DamageEffect = Extract<BattleCardEffect, { kind: "damage" }>;

export type FollowUpHitRequest =
  | Readonly<{
      source: "player-follow-up";
      damageType: "nature";
      amount: number;
      /** Health lost to this packet before threshold healing or other reactions. */
      onDamageDealt: (amount: number) => void;
    }>
  | Readonly<{ source: "player-follow-up"; damageType: DamageType; amount: number }>
  | Readonly<{ source: "talent-fixed" | "talent-derived"; damageType: DamageType; amount: number }>;

export type CardHitRequest = Readonly<{
  source: "card-attack" | "archery-extra";
  card: BattleCard;
  effect: DamageEffect;
  /** Already scaled and mitigated. Extra hits copy this amount without recalculating it. */
  resolvedDamage: number;
  critical?: boolean;
  origin?: CardEffectResolutionContext["origin"];
  onDamageDealt?: ((amount: number) => void) | undefined;
}>;

export type HitRequest =
  | CardHitRequest
  | FollowUpHitRequest
  | Readonly<{ source: "reflected-holy"; blockLost: number }>
  | Readonly<{ source: "attack-purge" }>;

export function applyBleedDamageDraw(
  state: BattleState,
  healthDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (healthDamage <= 0 || !rollTalentChance(state.talentEffects.drawOnBleedDamageChance, state)) {
    return state;
  }
  return applyDrawResult(state, drawFromState(state, 1), combatTexts);
}

export function applyElementalDamageManaRestore(
  state: BattleState,
  damageType: DamageType,
  healthDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (
    healthDamage <= 0 ||
    state.mana >= state.maxMana ||
    state.gearEffects.elementalDamageManaChance <= 0 ||
    (damageType !== "burn" && damageType !== "freeze" && damageType !== "holy")
  )
    return state;
  return rollTalentChance(state.gearEffects.elementalDamageManaChance, state)
    ? gainManaWithCombatText(state, 1, combatTexts, { skipFightPacing: true })
    : state;
}
