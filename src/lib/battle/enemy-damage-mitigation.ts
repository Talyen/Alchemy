import type { EnemyAttackEffect } from "@/lib/game-data";
import {
  GLACIAL_SURGE_FREEZE_DAMAGE_BONUS,
  HALF_DIVISOR,
  LABYRINTH_MODIFIER_CONFIG,
  PERCENT_DENOMINATOR,
} from "../game-constants";
import { emitDamageText } from "./combat-text-events";
import { paceCombatDamage } from "./fight-pacing";
import { elementalArmorAmount, reduceDamageByMana } from "./status-helpers";
import type { BattleState, CombatTextEvent } from "./types";
import { hasEnemyTrait } from "./encounter-trait-state";
import { mitigatePlayerCombatDamage } from "./health-state";
import { scaleReceivedPlayerDamage } from "./damage-modifiers";

function applyEnemyAttackBonuses(state: BattleState, effect: EnemyAttackEffect & { kind: "damage" }) {
  const forge = effect.damageType === "physical" || effect.damageType === "stun" ? state.enemyMitigation.forge : 0;
  const physicalBonus = effect.damageType === "physical" ? state.enemyPhysicalDamageBonus : 0;
  return effect.amount + forge + physicalBonus;
}

export interface EnemyDamageOptions {
  triggerBlockRetaliation?: boolean;
  amountMultiplier?: number;
  flatBonus?: number;
  flatReduction?: number;
  ignorePlayerMitigation?: boolean;
  ignoreArmor?: boolean;
  ignoreBlock?: boolean;
  physicalBlockBreakMultiplier?: number;
  extraPoisonBlockStrip?: number;
  preDamageBlockStrip?: number;
  skipTraitReactions?: boolean;
  preparedDamage?: { attemptedDamage: number; incomingDamage: number };
  traitSet?: ReadonlySet<string>;
  /** Set by the attack-hit orchestrator; damage resolution itself ignores it. */
  canDodge?: boolean;
}

function computeMitigatedDamage(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  remainingDamage: number,
  options: Pick<EnemyDamageOptions, "ignorePlayerMitigation" | "ignoreArmor">,
  protectionState: BattleState,
) {
  const armor =
    effect.damageType === "physical" || effect.damageType === "stun"
      ? state.playerStatuses.armor
      : elementalArmorAmount(state, effect.damageType);
  const rawDamage = options.ignoreArmor ? remainingDamage : Math.max(0, remainingDamage - armor);
  const scaledDamage = options.ignorePlayerMitigation
    ? rawDamage
    : scaleReceivedPlayerDamage(rawDamage, state.talentEffects, effect.damageType);
  return mitigatePlayerCombatDamage(protectionState, scaledDamage, effect.damageType, {
    ignoreMitigation: options.ignorePlayerMitigation === true,
  });
}

export function prepareEnemyDamage(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  options: EnemyDamageOptions = {},
) {
  const baseDamage = applyEnemyAttackBonuses(state, effect);
  const elementalBonus =
    effect.damageType === "burn"
      ? state.enemyStatuses.burnBonus
      : effect.damageType === "freeze"
        ? state.enemyStatuses.freezeBonus +
          (hasEnemyTrait(state, "glacial-shell") ? GLACIAL_SURGE_FREEZE_DAMAGE_BONUS : 0)
        : 0;
  const scale = (amount: number) => {
    let damage = Math.max(0, amount + (options.flatBonus ?? 0)) * (options.amountMultiplier ?? 1);
    if (
      effect.damageType === "physical" &&
      state.enemyHealth < state.enemyMaxHealth / HALF_DIVISOR &&
      hasEnemyTrait(state, "executioner")
    )
      damage *= LABYRINTH_MODIFIER_CONFIG.double;
    return Math.round(paceCombatDamage(state, damage, "enemy"));
  };
  const attemptedDamage = Math.max(0, scale(baseDamage + elementalBonus) - (options.flatReduction ?? 0));
  const manaMitigated = options.ignorePlayerMitigation ? attemptedDamage : reduceDamageByMana(state, attemptedDamage);
  const spentward =
    !options.ignorePlayerMitigation && state.mana === 0 ? state.gearEffects.enemyAttackReductionWithoutMana : 0;
  return { attemptedDamage, incomingDamage: Math.max(0, manaMitigated - spentward) };
}

export function calculateBlockAndArmorMitigation(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  incomingDamage: number,
  combatTexts: CombatTextEvent[],
  options: EnemyDamageOptions,
  protectionState = state,
) {
  let remainingDamage = incomingDamage;
  const blockMultiplier =
    effect.damageType === "physical" && state.talentEffects.blockAbsorbPhysicalBonus > 0
      ? 1 + state.talentEffects.blockAbsorbPhysicalBonus / PERCENT_DENOMINATOR
      : 1;
  const effectiveBlock =
    options.ignorePlayerMitigation || options.ignoreBlock
      ? 0
      : Math.round(state.playerStatuses.block * blockMultiplier);
  const blockAbsorb = Math.min(remainingDamage, effectiveBlock);
  // Full absorption consumes all Block even when rounding understates the cost.
  const blockSpent =
    blockAbsorb <= 0
      ? 0
      : blockAbsorb === effectiveBlock
        ? state.playerStatuses.block
        : Math.min(state.playerStatuses.block, Math.round(blockAbsorb / blockMultiplier));
  remainingDamage -= blockAbsorb;
  if (blockSpent > 0) {
    emitDamageText(combatTexts, "player", "block", blockSpent, {
      ...(blockAbsorb !== blockSpent ? { absorbedDamage: blockAbsorb } : {}),
    });
  }
  const remainingBlock = Math.max(0, state.playerStatuses.block - blockSpent);
  // Physical break and poison strip never co-occur (disjoint damage types).
  const extraBreak =
    !options.ignoreBlock && effect.damageType === "physical" && (options.physicalBlockBreakMultiplier ?? 1) > 1
      ? Math.min(remainingBlock, Math.round(blockSpent * ((options.physicalBlockBreakMultiplier ?? 1) - 1)))
      : 0;
  const extraStrip =
    !options.ignoreBlock && effect.damageType === "poison" && !options.ignorePlayerMitigation
      ? Math.min(remainingBlock, options.extraPoisonBlockStrip ?? 0)
      : 0;
  const totalExtraBlock = extraBreak + extraStrip;
  if (totalExtraBlock > 0) {
    emitDamageText(combatTexts, "player", "block", totalExtraBlock, { impact: false });
  }
  const actualDamage = computeMitigatedDamage(state, effect, remainingDamage, options, protectionState);
  return { remainingDamage, blockAbsorb, blockSpent, totalExtraBlock, actualDamage };
}
