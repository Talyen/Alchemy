import { harmfulPlayerStatusIds } from "@/lib/game-data";
import { HALF_DIVISOR } from "../game-constants";
import { resolvePlayerHealing } from "./health-state";
import { isPlayerDefeated } from "./battle-outcome";
import type { BattleState, CombatTextEvent } from "./types";
import type { HitFacts } from "./player-hit-core";

/** Combat executes rolls and reactions; inspection supplies only guaranteed outcomes. */
export interface ResourceRewardPort {
  chance: (chance: number, state: BattleState) => boolean;
  heal: (state: BattleState, amount: number, texts: CombatTextEvent[], cardHealing: boolean) => BattleState;
  status: (
    state: BattleState,
    status: "block" | "thorns",
    amount: number,
    texts: CombatTextEvent[],
    unpaced?: boolean,
  ) => BattleState;
  mana: (state: BattleState, amount: number, texts: CombatTextEvent[]) => BattleState;
  gold: (state: BattleState, amount: number, texts: CombatTextEvent[]) => BattleState;
  cleanse: (state: BattleState, amount: number, texts: CombatTextEvent[]) => BattleState;
  stun: (state: BattleState, amount: number, texts: CombatTextEvent[]) => BattleState;
}

export interface LeechHealingOptions {
  cardHealing?: boolean;
}

/** Amount already includes Leech scaling; all riders use this restoration's own facts. */
export function resolveLeechResourceRewards(
  state: BattleState,
  amount: number,
  texts: CombatTextEvent[],
  port: ResourceRewardPort,
  options: LeechHealingOptions = {},
): BattleState {
  const restoredHealth = resolvePlayerHealing(state, amount).restored;
  const belowHalf = state.playerHealth < state.playerMaxHealth / HALF_DIVISOR;
  const restoredToFull = restoredHealth > 0 && state.playerHealth + restoredHealth >= state.playerMaxHealth;
  let restored = port.heal(state, amount, texts, options.cardHealing === true);
  if (restoredHealth > 0) {
    if (state.playerStatuses.thorns === 0 && state.gearEffects.thornsOnLeechWithoutThorns > 0)
      restored = port.status(restored, "thorns", state.gearEffects.thornsOnLeechWithoutThorns, texts);
    if (belowHalf && state.gearEffects.stunOnLeechBelowHalfHealth > 0)
      restored = port.stun(restored, state.gearEffects.stunOnLeechBelowHalfHealth, texts);
    if (port.chance(state.gearEffects.leechBlockChance, state))
      restored = port.status(restored, "block", restoredHealth, texts, true);
    if (restoredToFull && state.talentEffects.manaOnLeechToFull > 0)
      restored = port.mana(restored, state.talentEffects.manaOnLeechToFull, texts);
    if (port.chance(state.talentEffects.leechGoldChance, state)) restored = port.gold(restored, restoredHealth, texts);
  }
  if (amount <= 0 || isPlayerDefeated(restored)) return restored;
  return resolveLeechGainRewards(restored, texts, port);
}

function resolveLeechGainRewards(state: BattleState, texts: CombatTextEvent[], port: ResourceRewardPort): BattleState {
  let next = state;
  if (
    state.talentEffects.leechCleanseChance > 0 &&
    harmfulPlayerStatusIds.some((status) => state.playerStatuses[status] > 0) &&
    port.chance(state.talentEffects.leechCleanseChance, state)
  )
    next = port.cleanse(next, 1, texts);
  for (const chance of [state.talentEffects.manaOnLeechChance, state.gearEffects.manaOnLeechChance])
    if (port.chance(chance, state)) next = port.mana(next, 1, texts);
  return next;
}

type GoldRewardPort = Pick<ResourceRewardPort, "chance" | "gold">;

export function resolveLuckyCloverReward(
  state: BattleState,
  healthDamage: number,
  texts: CombatTextEvent[],
  port: GoldRewardPort,
): BattleState {
  if (state.trinketEffects.luckyCloverGoldChance <= 0 || healthDamage <= 0) return state;
  return port.chance(state.trinketEffects.luckyCloverGoldChance, state) ? port.gold(state, healthDamage, texts) : state;
}

export function resolveNatureGoldReward(
  state: BattleState,
  healthDamage: number,
  texts: CombatTextEvent[],
  port: GoldRewardPort,
): BattleState {
  return healthDamage > 0 && port.chance(state.talentEffects.goldOnNatureDamageChance, state)
    ? port.gold(state, healthDamage, texts)
    : state;
}

export function resolveNatureManaReward(
  state: BattleState,
  damage: number,
  texts: CombatTextEvent[],
  port: Pick<ResourceRewardPort, "chance" | "mana">,
): BattleState {
  if (damage <= 0 || state.gearEffects.manaOnNatureDamageChance <= 0) return state;
  return port.chance(state.gearEffects.manaOnNatureDamageChance, state) ? port.mana(state, 1, texts) : state;
}

export function resolveBleedGoldReward(
  state: BattleState,
  healthDamage: number,
  texts: CombatTextEvent[],
  port: GoldRewardPort,
): BattleState {
  return healthDamage > 0 && port.chance(state.trinketEffects.cutpurseGoldChance, state)
    ? port.gold(state, healthDamage, texts)
    : state;
}

export function burnBleedLeechAmount(state: BattleState, damage: number, alreadyBurningAndBleeding: boolean): number {
  return state.gearEffects.burnBleedMirrorAndLeech > 0 && damage > 0 && alreadyBurningAndBleeding
    ? Math.max(1, Math.round(damage / HALF_DIVISOR))
    : 0;
}

type LeechRewardPort = Pick<ResourceRewardPort, "chance"> & {
  leech: (state: BattleState, damage: number, texts: CombatTextEvent[]) => BattleState;
};

export function resolvePoisonLeechRewards(
  state: BattleState,
  healthDamage: number,
  texts: CombatTextEvent[],
  port: LeechRewardPort,
): BattleState {
  if (healthDamage <= 0) return state;
  let next = state;
  for (const chance of [
    state.trinketEffects.parasiticBloomLeechChance,
    state.talentEffects.poisonLeechChance + state.gearEffects.poisonLeechChance,
  ]) {
    if (port.chance(chance, next)) next = port.leech(next, healthDamage, texts);
  }
  return next;
}

export function resolveNatureRestorationRewards(
  state: BattleState,
  facts: Pick<HitFacts, "resolvedDamage" | "healthDamage" | "eligibility">,
  texts: CombatTextEvent[],
  port: LeechRewardPort &
    Pick<ResourceRewardPort, "status" | "heal"> & {
      armor: (state: BattleState, amount: number, texts: CombatTextEvent[]) => BattleState;
    },
  alreadyLeeches = false,
): BattleState {
  const { resolvedDamage: damage, healthDamage, eligibility } = facts;
  if (damage <= 0) return state;
  let next = state;
  if (port.chance(state.talentEffects.armorOnNatureDamageChance, state)) next = port.armor(next, damage, texts);
  if (port.chance(state.talentEffects.thornsOnNatureDamageChance, state))
    next = port.status(next, "thorns", damage, texts);
  if (port.chance(state.talentEffects.healOnNatureDamageChance, state)) next = port.heal(next, damage, texts, false);
  const guaranteed =
    !alreadyLeeches && state.gearEffects.natureLeechVsPoisoned > 0 && eligibility.enemyStatuses.poison > 0;
  const chance = state.talentEffects.natureLeechChance + state.gearEffects.natureLeechChance;
  if (guaranteed || (chance > 0 && port.chance(chance, next)))
    next = port.leech(next, guaranteed ? healthDamage : damage, texts);
  return next;
}

export function resolveHolyBlockReward(
  state: BattleState,
  healthDamage: number,
  texts: CombatTextEvent[],
  port: Pick<ResourceRewardPort, "chance" | "status">,
): BattleState {
  return healthDamage > 0 && port.chance(state.talentEffects.holyBlockChance, state)
    ? port.status(state, "block", healthDamage, texts, true)
    : state;
}

export function resolveHolyGoldReward(
  state: BattleState,
  healthDamage: number,
  texts: CombatTextEvent[],
  port: GoldRewardPort,
): BattleState {
  return healthDamage > 0 &&
    state.talentEffects.holyGoldChance > 0 &&
    port.chance(state.talentEffects.holyGoldChance, state)
    ? port.gold(state, healthDamage, texts)
    : state;
}
