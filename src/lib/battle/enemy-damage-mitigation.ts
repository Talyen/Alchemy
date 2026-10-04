import type { EnemyAttackEffect } from "@/lib/game-data";
import { HALF_DIVISOR, LABYRINTH_MODIFIER_CONFIG, PERCENT_DENOMINATOR } from "../game-constants";
import { mergeCombatText } from "./combat-text-events";
import { paceCombatDamage } from "./fight-pacing";
import { armorMitigatesElementalDamage, reduceDamageByMana } from "./status-helpers";
import type { BattleState, CombatTextEvent } from "./types";
import { hasEnemyTrait, mitigatePlayerCombatDamage, scaleReceivedPlayerDamage } from "./types/state-helpers";

function applyEnemyAttackBonuses(state: BattleState, effect: EnemyAttackEffect & { kind: "damage" }) {
  const forge = effect.damageType === "physical" || effect.damageType === "stun" ? state.enemyMitigation.forge : 0;
  const physicalBonus = effect.damageType === "physical" ? state.enemyPhysicalDamageBonus : 0;
  return effect.amount + forge + physicalBonus;
}

function blockAbsorptionMultiplier(state: BattleState, effect: EnemyAttackEffect & { kind: "damage" }) {
  if (effect.damageType === "physical" && state.talentEffects.blockAbsorbPhysicalBonus > 0) {
    return 1 + state.talentEffects.blockAbsorbPhysicalBonus / PERCENT_DENOMINATOR;
  }
  return 1;
}

export interface EnemyDamageOptions {
  triggerBlockRetaliation?: boolean;
  amountMultiplier?: number;
  flatBonus?: number;
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
  ignorePlayerMitigation: boolean,
  ignoreArmor: boolean,
  protectionState: BattleState,
) {
  const armorMitigatesDamage =
    effect.damageType === "physical" ||
    effect.damageType === "stun" ||
    armorMitigatesElementalDamage(state, effect.damageType);
  const rawDamage =
    armorMitigatesDamage && !ignoreArmor ? Math.max(0, remainingDamage - state.playerStatuses.armor) : remainingDamage;
  const scaledDamage = ignorePlayerMitigation
    ? rawDamage
    : scaleReceivedPlayerDamage(rawDamage, state.talentEffects, effect.damageType);
  return mitigatePlayerCombatDamage(protectionState, scaledDamage, effect.damageType, {
    ignoreMitigation: ignorePlayerMitigation,
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
        ? state.enemyStatuses.freezeBonus
        : 0;
  const scale = (amount: number) => {
    let damage = Math.max(0, amount + (options.flatBonus ?? 0)) * (options.amountMultiplier ?? 1);
    if (
      effect.damageType === "physical" &&
      hasEnemyTrait(state, "executioner") &&
      state.enemyHealth < state.enemyMaxHealth / HALF_DIVISOR
    )
      damage *= LABYRINTH_MODIFIER_CONFIG.double;
    return Math.round(paceCombatDamage(state, damage, "enemy"));
  };
  const attemptedDamage = scale(baseDamage + elementalBonus);
  const reduction = options.ignorePlayerMitigation
    ? 0
    : state.enemyStatuses.poison > 0
      ? state.talentEffects.poisonReducesEnemyDamage
      : 0;
  const manaMitigated = options.ignorePlayerMitigation ? attemptedDamage : reduceDamageByMana(state, attemptedDamage);
  return { attemptedDamage, incomingDamage: Math.max(0, manaMitigated - reduction) };
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
  const blockMultiplier = blockAbsorptionMultiplier(state, effect);
  const effectiveBlock =
    options.ignorePlayerMitigation || options.ignoreBlock
      ? 0
      : Math.round(state.playerStatuses.block * blockMultiplier);
  const blockAbsorb = Math.min(remainingDamage, effectiveBlock);
  const blockSpent =
    blockAbsorb <= 0
      ? 0
      : blockAbsorb === effectiveBlock
        ? state.playerStatuses.block
        : Math.min(state.playerStatuses.block, Math.round(blockAbsorb / blockMultiplier));
  remainingDamage -= blockAbsorb;
  if (blockSpent > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockSpent });
  }
  const remainingBlock = Math.max(0, state.playerStatuses.block - blockSpent);
  const extraPhysicalBlock =
    !options.ignoreBlock && effect.damageType === "physical" && (options.physicalBlockBreakMultiplier ?? 1) > 1
      ? Math.min(remainingBlock, Math.round(blockSpent * ((options.physicalBlockBreakMultiplier ?? 1) - 1)))
      : 0;
  const extraPoisonBlock =
    !options.ignoreBlock && effect.damageType === "poison" && !options.ignorePlayerMitigation
      ? Math.min(remainingBlock, options.extraPoisonBlockStrip ?? 0)
      : 0;
  const totalExtraBlock = Math.max(extraPhysicalBlock, extraPoisonBlock);
  if (totalExtraBlock > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: totalExtraBlock });
  }
  const actualDamage = computeMitigatedDamage(
    state,
    effect,
    remainingDamage,
    options.ignorePlayerMitigation === true,
    options.ignoreArmor === true,
    protectionState,
  );
  return { remainingDamage, blockAbsorb, blockSpent, totalExtraBlock, actualDamage };
}
