// Battle UI formatting helpers for combat text colors/icons and status chip ordering.
// Depends on battle state, game-data status IDs, alchemy config, and shared UI types.
// Used by battle controller and widgets to keep presentation derivation out of combat logic.
import type { BattleState, CombatTextEvent, CcState } from "@/lib/battle";
import { isPlayerCcControlled, isStunFreezeBuildupBlocked } from "@/lib/battle";
import {
  DAMAGE_TYPES,
  ENEMY_STATUS_DISPLAY_ORDER,
  PLAYER_STATUS_DISPLAY_ORDER,
  type BattleCard,
  type BattleCardEffect,
  type DamageType,
  type KeywordId,
  keywordDefinitions,
} from "@/lib/game-data";
import { combatTextIconClasses, keywordIcons } from "../config";
import { augmentDefinitions } from "../augment-definitions";
import type { StatusChip } from "../types";

const ENEMY_MITIGATION_DISPLAY_ORDER: ReadonlyArray<keyof BattleState["enemyMitigation"]> = ["block", "armor", "forge"];

export function getCombatTextColorClass(event: CombatTextEvent): string {
  if (event.kind === "heal") return "text-green-400";
  const augment = augmentDefinitions[event.stat as keyof typeof augmentDefinitions];
  if (augment) return augment.colorClass;
  const kw = keywordDefinitions[event.stat as KeywordId];
  if (kw) return kw.colorClass;
  if (event.stat === "haste") return "text-fuchsia-300";
  return "text-muted-foreground";
}

export function getCombatTextIcon(event: CombatTextEvent) {
  if (event.kind === "heal") return keywordIcons.health;
  const augment = augmentDefinitions[event.stat as keyof typeof augmentDefinitions];
  if (augment) return augment.icon;
  const kw = keywordIcons[event.stat as KeywordId];
  if (kw) return kw;
  return combatTextIconClasses[event.stat];
}

function buildStatusChips(
  order: ReadonlyArray<StatusChip["id"]>,
  statuses: Record<string, number> | undefined,
  cc?: CcState,
): StatusChip[] {
  if (!statuses) return [];
  const blockBuildup = cc ? isStunFreezeBuildupBlocked(cc) : false;
  return order.reduce<StatusChip[]>((chips, id) => {
    if (blockBuildup && (id === "stun" || id === "freeze")) return chips;
    const value = statuses[id];
    if ((value ?? 0) > 0) {
      chips.push({ id, value: value!, ...(id === "phoenixFeather" ? { hideValue: true } : {}) });
    }
    return chips;
  }, []);
}

function buildActiveCcChips(cc: CcState): StatusChip[] {
  const chips: StatusChip[] = [];
  if (cc.stunSkipTurns > 0) chips.push({ id: "stunned", value: cc.stunSkipTurns, hideValue: true });
  if (cc.freezeSkipTurns > 0) chips.push({ id: "frozen", value: cc.freezeSkipTurns, hideValue: true });
  return chips;
}

function buildCcImmunityChip(cc: CcState): StatusChip[] {
  if (isPlayerCcControlled(cc) || cc.cooldown <= 0) return [];
  return [{ id: "ccImmunity", value: cc.cooldown, hideValue: true }];
}

// Buff-tier player chips precede armed-effect chips, which precede harmful DoT build-ups.
const BUFF_TIER_CHIP_IDS = new Set<string>(["block", "armor", "forge", "haste", "phoenixFeather"]);

function insertAfterBuffTier(chips: StatusChip[], additions: StatusChip[]): StatusChip[] {
  if (additions.length === 0) return chips;
  let insertAt = 0;
  for (const [index, chip] of chips.entries()) {
    if (BUFF_TIER_CHIP_IDS.has(chip.id)) insertAt = index + 1;
  }
  return [...chips.slice(0, insertAt), ...additions, ...chips.slice(insertAt)];
}

function isDamageEffect(effect: BattleCardEffect): effect is Extract<BattleCardEffect, { kind: "damage" }> {
  return effect.kind === "damage";
}

// CC immunity surfaces only after active Stun/Freeze skip turns are consumed.
function buildArmedPlayerChips(state: BattleState): StatusChip[] {
  const chips: StatusChip[] = [];
  const { flags } = state;
  if (flags.playNextCardTwice) chips.push({ id: "playNextCardTwice", value: 1, hideValue: true });
  if (flags.nextHitCrit) chips.push({ id: "nextHitCrit", value: 1, hideValue: true });
  if (flags.nextHitPoison) chips.push({ id: "nextHitPoison", value: 1, hideValue: true });
  if (flags.nextHitPhysicalBonus > 0) {
    chips.push({ id: "nextHitPhysicalBonus", value: flags.nextHitPhysicalBonus });
  }
  if (flags.nextPhysicalDealsBleed) chips.push({ id: "nextPhysicalDealsBleed", value: 1, hideValue: true });
  if (flags.nextArcheryCardFree) chips.push({ id: "nextArcheryCardFree", value: 1, hideValue: true });
  if (flags.nextNatureCardFree) chips.push({ id: "nextNatureCardFree", value: 1, hideValue: true });

  let echoCount = 0;
  for (const pulse of state.pendingTurnStartEffects) {
    if (pulse.effects.length === 0) continue;
    const damages = pulse.effects.filter(isDamageEffect);
    if (damages.length !== pulse.effects.length) echoCount += 1;
  }
  if (echoCount > 0) chips.push({ id: "echo", value: echoCount });

  chips.push(...buildActiveCcChips(state.playerCC));
  chips.push(...buildCcImmunityChip(state.playerCC));

  return chips;
}

function buildPendingEnemyChips(state: BattleState): StatusChip[] {
  const incomingByType = new Map<DamageType, number>();
  for (const pulse of state.pendingTurnStartEffects) {
    if (pulse.effects.length === 0) continue;
    const damages = pulse.effects.filter(isDamageEffect);
    if (damages.length !== pulse.effects.length) continue;
    for (const effect of damages) {
      incomingByType.set(effect.damageType, (incomingByType.get(effect.damageType) ?? 0) + effect.amount);
    }
  }
  return DAMAGE_TYPES.flatMap((damageType): StatusChip[] => {
    const amount = incomingByType.get(damageType);
    return amount ? [{ id: `pending-${damageType}`, value: amount }] : [];
  });
}

export function getPlayerStatusChips(state: BattleState | null | undefined): StatusChip[] {
  if (!state) return [];
  return insertAfterBuffTier(
    buildStatusChips(PLAYER_STATUS_DISPLAY_ORDER, state.playerStatuses, state.playerCC),
    buildArmedPlayerChips(state),
  );
}

export function getEnemyStatusChips(state: BattleState | null | undefined): StatusChip[] {
  if (!state) return [];
  const mitigationChips: StatusChip[] = [];
  for (const key of ENEMY_MITIGATION_DISPLAY_ORDER) {
    const value = state.enemyMitigation[key];
    if (value > 0) mitigationChips.push({ id: key, value });
  }
  const statusChips = buildStatusChips(ENEMY_STATUS_DISPLAY_ORDER, state.enemyStatuses, state.enemyCC);
  const pendingChips = buildPendingEnemyChips(state);
  const ccChips = [...buildActiveCcChips(state.enemyCC), ...buildCcImmunityChip(state.enemyCC)];
  return [...mitigationChips, ...statusChips, ...pendingChips, ...ccChips];
}

function effectTarget(effect: BattleCardEffect): "player" | "enemy" | null {
  switch (effect.kind) {
    case "damage":
    case "random-damage":
    case "enemy-status":
    case "remove-enemy-armor":
    case "multiply-enemy-status":
    case "cleanse-player-status-to-damage":
      return "enemy";
    case "player-status":
    case "heal":
    case "restore-mana":
    case "lose-mana":
    case "lose-max-mana":
    case "gain-max-mana":
    case "gain-gold":
    case "wish":
    case "summon-companion":
    case "buff-companion":
    case "lose-health":
    case "draw-cards":
    case "remove-harmful-status":
    case "remove-player-status":
    case "self-damage":
    case "next-hit-crit":
    case "play-next-card-twice":
    case "next-hit-poison":
      return "player";
    case "chance":
      for (const nested of effect.successEffects) {
        const target = effectTarget(nested);
        if (target) return target;
      }
      return null;
    case "repeat-over-turns":
      for (const nested of effect.effects) {
        const target = effectTarget(nested);
        if (target) return target;
      }
      return null;
  }
}

export function getBattleCardPlayTarget(card: BattleCard): "player" | "enemy" {
  for (const effect of card.effects) {
    const target = effectTarget(effect);
    if (target) return target;
  }
  return "enemy";
}
