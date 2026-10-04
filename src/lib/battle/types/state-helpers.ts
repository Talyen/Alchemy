import { flatDamageReduction, receivesHalfDamage, gearResistancePercent } from "../damage-modifiers";
import { BATTLE_CONFIG, MIN_ARMOR_AMOUNT, LABYRINTH_MODIFIER_CONFIG } from "../../game-constants";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { clamp } from "@/lib/math";
import type { EnemyStatusId, PlayerStatusId } from "@/lib/game-data";
import { CAMPFIRE_HEAL_FRACTION, DEATHS_DOOR_GRACE_TURNS, PERCENT_DENOMINATOR } from "../../game-constants";
import type { GearEffectManifest } from "@/lib/gear";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { applyPercentBonus, applyPercentReduction, halveRounded, scalePercent } from "../amount-helpers";
import type { BattleState, CombatFlags, CombatTextEvent, EnemyMitigation } from "./state-types";
import { isStunFreezeBuildupBlocked } from "./state-types";
import { writeCombatFlag } from "../action-context";

export function blockAmountWithForge(state: BattleState, amount: number): number {
  if (amount <= 0) return amount;
  const forgeBonus = scalePercent(state.playerStatuses.forge, state.talentEffects.forgeBlockPercent);
  return amount + forgeBonus;
}

function playerStatusDelta(state: BattleState, status: PlayerStatusId, delta: number): number {
  if (status === "stun" && delta > 0) {
    return Math.max(0, Math.round(delta * (1 - state.talentEffects.stunBuildupReductionPercent / PERCENT_DENOMINATOR)));
  }
  return status === "block" && delta > 0 ? delta + state.gearEffects.flatBlockGained : delta;
}

export function addPlayerStatus(state: BattleState, status: PlayerStatusId, delta: number): BattleState {
  if ((status === "stun" || status === "freeze") && isStunFreezeBuildupBlocked(state.playerCC)) {
    return state;
  }
  const effectiveDelta = playerStatusDelta(state, status, delta);
  const updated = setPlayerStatus(state, status, state.playerStatuses[status] + effectiveDelta);
  const thornsBonus =
    status === "block" && effectiveDelta > 0 && state.trinketEffects.ironwoodBucklerThornsOnBlock > 0
      ? state.trinketEffects.ironwoodBucklerThornsOnBlock
      : 0;
  const playerStatuses =
    thornsBonus > 0
      ? { ...updated.playerStatuses, thorns: updated.playerStatuses.thorns + thornsBonus }
      : updated.playerStatuses;
  const uniqueGear =
    status === "forge" &&
    effectiveDelta > 0 &&
    state.gearEffects.forgeReadiesPhysicalRepeat > 0 &&
    !state.action?.repeatActive &&
    !state.uniqueGear.everkeenReady
      ? { ...state.uniqueGear, everkeenReady: true }
      : state.uniqueGear;
  if (playerStatuses === updated.playerStatuses && uniqueGear === updated.uniqueGear) return updated;
  return { ...updated, playerStatuses, uniqueGear };
}

export function setPlayerStatus(state: BattleState, status: PlayerStatusId, value: number): BattleState {
  const pendingEnemyBleedLeechHealing =
    status === "bleed" ? Math.min(state.pendingEnemyBleedLeechHealing, value) : state.pendingEnemyBleedLeechHealing;
  const unchangedStatus = Object.is(state.playerStatuses[status], value);
  // Reapplying Bleed can still repair its pending Leech credit.
  if (unchangedStatus && Object.is(pendingEnemyBleedLeechHealing, state.pendingEnemyBleedLeechHealing)) return state;
  return {
    ...state,
    playerStatuses: unchangedStatus ? state.playerStatuses : { ...state.playerStatuses, [status]: value },
    pendingEnemyBleedLeechHealing,
  };
}

export function addEnemyStatus(state: BattleState, status: EnemyStatusId, delta: number): BattleState {
  if ((status === "stun" || status === "freeze") && isStunFreezeBuildupBlocked(state.enemyCC)) {
    return state;
  }
  const benefit =
    status === "stun"
      ? "thunderstruck"
      : status === "freeze"
        ? "bitter-cold"
        : status === "bleed"
          ? "deep-wounds"
          : null;
  if (delta > 0 && benefit && hasEncounterBenefit(state, benefit)) delta *= LABYRINTH_MODIFIER_CONFIG.double;
  const traitAdjustedDelta =
    ((status === "stun" && hasEnemyTrait(state, "braced")) ||
      (status === "freeze" && hasEnemyTrait(state, "winterborn"))) &&
    delta > 0
      ? halveRounded(delta)
      : delta;
  let nextState = {
    ...state,
    enemyStatuses: { ...state.enemyStatuses, [status]: state.enemyStatuses[status] + traitAdjustedDelta },
  };

  if (
    status === "poison" &&
    traitAdjustedDelta > 0 &&
    rollPercent(nextState.gearEffects.poisonArmorShredChance, getBattleRng(nextState))
  ) {
    nextState = reduceEnemyArmor(nextState, 1);
  }

  return nextState;
}

export function setEnemyStatus(state: BattleState, status: EnemyStatusId, value: number): BattleState {
  if (Object.is(state.enemyStatuses[status], value)) return state;
  return { ...state, enemyStatuses: { ...state.enemyStatuses, [status]: value } };
}

// Trait lists are immutable battle inputs. Key by the list so state copies
// reuse the lookup, replacement lists invalidate it, and old battles can be collected.
const enemyTraitSets = new WeakMap<BattleState["currentEnemy"]["traits"], ReadonlySet<string>>();

export function hasEnemyTrait(state: BattleState, traitId: string, traitSet?: ReadonlySet<string>): boolean {
  return (traitSet ?? getEnemyTraitSet(state)).has(traitId);
}

export function getEnemyTraitSet(state: Pick<BattleState, "currentEnemy">): ReadonlySet<string> {
  const traits = state.currentEnemy.traits;
  let set = enemyTraitSets.get(traits);
  if (!set) {
    set = new Set(traits.map((trait) => trait.id));
    enemyTraitSets.set(traits, set);
  }
  return set;
}

export function addEnemyMitigation(state: BattleState, field: keyof EnemyMitigation, delta: number): BattleState {
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      [field]: state.enemyMitigation[field] + delta,
    },
  };
}

function stripEnemyMitigation(state: BattleState, field: keyof EnemyMitigation): BattleState {
  if (state.enemyMitigation[field] <= 0) return state;
  return { ...state, enemyMitigation: { ...state.enemyMitigation, [field]: 0 } };
}

export function stripEnemyArmor(state: BattleState): BattleState {
  return stripEnemyMitigation(state, "armor");
}

export function stripEnemyBlock(state: BattleState): BattleState {
  return stripEnemyMitigation(state, "block");
}

export function reduceEnemyArmor(state: BattleState, delta: number): BattleState {
  if (delta <= 0 || state.enemyMitigation.armor <= 0) return state;
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      armor: Math.max(0, state.enemyMitigation.armor - delta),
    },
  };
}

export function setFlag<K extends keyof CombatFlags>(state: BattleState, flag: K, value: CombatFlags[K]): BattleState {
  return writeCombatFlag(state, flag, value);
}

export function clampHealth(current: number, delta: number, max: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(delta) || !Number.isFinite(max)) {
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const safeMax = Number.isFinite(max) && max > 0 ? max : safeCurrent;
    const safeDelta = Number.isFinite(delta) ? delta : 0;
    return clamp(safeCurrent + safeDelta, 0, safeMax);
  }
  return clamp(current + delta, 0, max);
}

export interface EnemyHitHealth {
  state: BattleState;
  previousHealth: number;
  enemyWasAlive: boolean;
  resolvedDamage: number;
  healthDamage: number;
  killed: boolean;
}

export function damageEnemyHealth(state: BattleState, damage: number): EnemyHitHealth {
  const previousHealth = state.enemyHealth;
  const enemyHealth = clampHealth(previousHealth, -damage, state.enemyMaxHealth);
  const triggersCinderSkin =
    enemyHealth > 0 &&
    enemyHealth < previousHealth &&
    hasEnemyTrait(state, "cinder-skin") &&
    !state.flags.cinderSkinUsedThisTurn;
  return {
    state: {
      ...state,
      enemyHealth,
      ...(triggersCinderSkin
        ? {
            flags: { ...state.flags, cinderSkinUsedThisTurn: true, pendingCinderSkinReaction: true },
          }
        : {}),
    },
    previousHealth,
    enemyWasAlive: previousHealth > 0,
    resolvedDamage: damage,
    healthDamage: Math.max(0, previousHealth - enemyHealth),
    killed: previousHealth > 0 && enemyHealth <= 0,
  };
}

export function gainMana(state: BattleState, amount: number, allowOverflow = false): BattleState {
  if (amount <= 0) return state;
  const mana = allowOverflow ? state.mana + amount : Math.max(state.mana, Math.min(state.maxMana, state.mana + amount));
  if (Object.is(mana, state.mana)) return state;
  return {
    ...state,
    mana,
  };
}

export function scaleReceivedPlayerDamage(
  damage: number,
  talentEffects: BattleState["talentEffects"],
  damageType: string | undefined,
): number {
  if (damage <= 0) return damage;
  return receivesHalfDamage(talentEffects, damageType) ? halveRounded(damage) : damage;
}

export function deathsDoorGraceTurns(extension: number): number {
  return DEATHS_DOOR_GRACE_TURNS + Math.max(0, extension);
}

export interface EnemyTraitIgnoreMitigationOptions {
  ignoreMitigation?: boolean;
}

export function mitigatePlayerCombatDamage(
  state: BattleState,
  damage: number,
  damageType?: string,
  options?: EnemyTraitIgnoreMitigationOptions,
): number {
  if (!Number.isFinite(damage) || damage <= 0) return 0;
  let reducedDamage = damage;
  if (!options?.ignoreMitigation) {
    reducedDamage -= state.talentEffects.damageReduction;
    if (state.activeCompanion && state.talentEffects.damageReductionWithCompanion > 0) {
      reducedDamage -= state.talentEffects.damageReductionWithCompanion;
    }
    reducedDamage -= flatDamageReduction(state.talentEffects, damageType);
    reducedDamage = Math.max(0, reducedDamage);
    reducedDamage = applyGearDamageResistance(reducedDamage, damageType, state.gearEffects);
    if (
      state.playerStatuses.block > 0 &&
      ((damageType === "bleed" && state.talentEffects.blockHalvesBleedDamage) ||
        (damageType === "poison" && state.talentEffects.blockHalvesPoisonDamage))
    ) {
      reducedDamage = halveRounded(reducedDamage);
    }
  }
  return reducedDamage;
}

export function applyPlayerCombatDamage(
  state: BattleState,
  damage: number,
  source: "hostile" | "self",
  damageType?: string,
  options?: EnemyTraitIgnoreMitigationOptions,
  combatTexts?: CombatTextEvent[],
): BattleState {
  const reducedDamage = mitigatePlayerCombatDamage(state, damage, damageType, options);
  if (reducedDamage <= 0) return state;
  const nextHealth = clampHealth(state.playerHealth, -reducedDamage, state.playerMaxHealth);
  if (source === "hostile" && nextHealth < state.playerHealth && state.talentEffects.dodgeChanceOnHostileDamage > 0) {
    state = {
      ...state,
      dodgeChanceFromDamage: state.dodgeChanceFromDamage + state.talentEffects.dodgeChanceOnHostileDamage,
    };
  }
  if (nextHealth > 0) return { ...state, playerHealth: nextHealth };
  if (state.playerStatuses.phoenixFeather > 0) {
    const healAmount = Math.round(state.playerMaxHealth * CAMPFIRE_HEAL_FRACTION);
    return {
      ...state,
      playerHealth: healAmount,
      playerStatuses: { ...state.playerStatuses, phoenixFeather: 0 },
      deathsDoorActive: false,
      deathsDoorTriggeredTurn: null,
      deathsDoorGraceTurnsRemaining: null,
    };
  }
  if (!state.deathsDoorUsed) {
    return {
      ...state,
      playerHealth: 1,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: state.turn,
      deathsDoorGraceTurnsRemaining: deathsDoorGraceTurns(state.talentEffects.deathsDoorExtension),
      flags:
        state.gearEffects.burnOnDeathsDoorEntry > 0 ? { ...state.flags, pendingEmberwakeDamage: true } : state.flags,
    };
  }
  if (state.deathsDoorActive) {
    if (state.playerHealth === 1 && reducedDamage > 0) {
      combatTexts?.push({ target: "player", kind: "notice", stat: "deathsDoor", text: "" });
    }
    return { ...state, playerHealth: 1 };
  }
  return { ...state, playerHealth: 0, deathsDoorActive: false, dodgeChanceFromDamage: 0 };
}

/** Read immediately after damage, before rewards: Phoenix restores Health after the lethal loss; Death's Door prevents it. */
export function playerHealthLostToDamage(before: BattleState, after: BattleState): number {
  const phoenixTriggered = before.playerStatuses.phoenixFeather > 0 && after.playerStatuses.phoenixFeather === 0;
  return phoenixTriggered ? before.playerHealth : Math.max(0, before.playerHealth - after.playerHealth);
}

export function effectivePlayerHealingAmount(state: BattleState, amount: number): number {
  return Math.round(
    (amount + (amount > 0 ? (state.talentEffects.homesteadHealing ?? 0) : 0)) * state.talentEffects.healMultiplier,
  );
}

export function applyPlayerHealing(state: BattleState, amount: number, allowOverhealBlock = false): BattleState {
  return resolvePlayerHealing(state, amount, allowOverhealBlock).state;
}

export function resolvePlayerHealing(state: BattleState, amount: number, allowOverhealBlock = false) {
  if (isPlayerDefeated(state)) return { state, effective: 0, restored: 0, overflow: 0 };
  amount = effectivePlayerHealingAmount(state, amount);
  const playerHealth = clampHealth(state.playerHealth, amount, state.playerMaxHealth);
  const actualHeal = playerHealth - state.playerHealth;
  const overheal = state.playerHealth + amount - playerHealth;
  let nextState = Object.is(playerHealth, state.playerHealth) ? state : { ...state, playerHealth };
  if (actualHeal > 0 && nextState.trinketEffects.grovesFavorThornsOnHealthRestore > 0) {
    nextState = {
      ...nextState,
      playerStatuses: {
        ...nextState.playerStatuses,
        thorns: nextState.playerStatuses.thorns + nextState.trinketEffects.grovesFavorThornsOnHealthRestore,
      },
    };
  }
  if (allowOverhealBlock && overheal > 0 && nextState.talentEffects.overhealToBlockRatio > 0) {
    const blockGain = Math.round(overheal * nextState.talentEffects.overhealToBlockRatio);
    nextState = addPlayerStatus(nextState, "block", blockAmountWithForge(nextState, blockGain));
  }
  return { state: nextState, effective: amount, restored: actualHeal, overflow: overheal };
}

export function applyGearDamageResistance(
  damage: number,
  damageType: string | undefined,
  gear: GearEffectManifest,
): number {
  const resist = gearResistancePercent(gear, damageType);
  return applyPercentReduction(damage, resist, PERCENT_DENOMINATOR);
}

export function scaleGoldReward(baseGold: number, gear: GearEffectManifest): number {
  return applyPercentBonus(baseGold, gear.goldGainPercent, PERCENT_DENOMINATOR);
}

export function isPlayerDefeated(state: Pick<BattleState, "playerHealth" | "deathsDoorActive">): boolean {
  return state.playerHealth <= 0 && !state.deathsDoorActive;
}

export function hasEncounterBenefit(
  state: Pick<BattleState, "encounterBenefits">,
  id: EncounterRewardTraitId,
): boolean {
  return state.encounterBenefits.includes(id);
}

export function decayEnemyArmor(state: BattleState): BattleState {
  if (hasEnemyTrait(state, "unbreakable") || state.enemyMitigation.armor <= MIN_ARMOR_AMOUNT) {
    return state;
  }
  return reduceEnemyArmor(state, BATTLE_CONFIG.ARMOR_DECAY_AMOUNT);
}
