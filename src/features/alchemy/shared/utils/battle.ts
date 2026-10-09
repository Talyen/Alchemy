import type { BattleSnapshot, CombatTextEvent, CcState } from "@/lib/battle";
import { isCcControlled, isStunFreezeBuildupBlocked } from "@/lib/battle";
import {
  DAMAGE_TYPES,
  ENEMY_STATUS_DISPLAY_ORDER,
  PLAYER_STATUS_DISPLAY_ORDER,
  type DamageType,
  type KeywordId,
  keywordDefinitions,
} from "@/lib/game-data";
import type { LucideIcon } from "lucide-react";
import { Skull, Sparkles, Layers, Eraser, ShieldMinus, ShieldCheck, Clock } from "lucide-react";
import { keywordIcons } from "../config/metadata";
import { phoenixFeatherStatus } from "../config/phoenix-feather-status";
import { ARMED_PLAYER_CHIP_IDS, augmentDefinitions } from "../augment-definitions";
import type { CombatImpactCue, StatusChip, FloatingCombatText } from "../types";

const ENEMY_MITIGATION_DISPLAY_ORDER: ReadonlyArray<keyof BattleSnapshot["enemyMitigation"]> = [
  "block",
  "armor",
  "forge",
];

function combatStatPresentation(stat: CombatTextEvent["stat"]) {
  if (stat === "phoenixFeather") return phoenixFeatherStatus;
  return augmentDefinitions[stat as keyof typeof augmentDefinitions] ?? keywordDefinitions[stat as KeywordId];
}

export function getCombatTextColorClass(event: CombatTextEvent): string {
  if (event.stat === "deathsDoor") return "text-red-200";
  if (event.kind === "heal") return "text-green-400";
  const presentation = combatStatPresentation(event.stat);
  if (presentation) return presentation.colorClass;
  if (event.stat === "haste") return "text-fuchsia-300";
  return "text-muted-foreground";
}

export function getCombatImpactVisual(event: CombatTextEvent): Omit<CombatImpactCue, "sequence" | "recoil"> | null {
  if (event.kind !== "damage" || event.impact === false || event.amount <= 0) return null;
  const isDamageType = DAMAGE_TYPES.includes(event.stat as DamageType);
  if (event.stat !== "health" && event.stat !== "block" && !isDamageType) return null;
  const keyword = keywordDefinitions[event.stat as KeywordId] ?? keywordDefinitions.health;
  return {
    colors: keyword.shineColors,
    healthLost: event.stat !== "block",
    amount: event.amount,
    periodic: event.periodic === true,
  };
}

const combatTextIconClasses: Record<string, LucideIcon> = {
  haste: Sparkles,
  draw: Layers,
  cleanse: Eraser,
  scheduled: Clock,
  effect: Sparkles,
  deathsDoor: Skull,
};

export function getCombatTextIcon(event: CombatTextEvent) {
  if (event.kind === "heal") return keywordIcons.health;
  const presentation = combatStatPresentation(event.stat);
  return presentation && "icon" in presentation
    ? presentation.icon
    : (keywordIcons[event.stat as KeywordId] ?? combatTextIconClasses[event.stat]);
}

export function getCombatTextLeadingIcon(event: CombatTextEvent) {
  if (event.kind !== "notice") return undefined;
  if (event.signal === "purge" || event.text === "Purged") return ShieldMinus;
  if (event.signal === "cleanse") return Eraser;
  if (event.signal === "prepared") return Sparkles;
  if (event.signal === "immune") return ShieldCheck;
  return undefined;
}

export function getCombatTextAccessibleLabel(event: FloatingCombatText): string {
  const label = combatStatPresentation(event.stat)?.label ?? event.stat;
  if (event.kind === "notice") {
    if (event.signal === "purge" || event.text === "Purged") return `Purged ${label}`;
    if (event.signal === "cleanse") return `Cleansed ${label}`;
    if (event.signal === "prepared") return `${label} prepared`;
    return event.text || (event.stat === "deathsDoor" ? "Death's Door" : label);
  }
  return `${label}: ${event.displayText}`;
}

function buildStatusChips(
  order: ReadonlyArray<StatusChip["id"]>,
  statuses: Record<string, number> | undefined,
  cc?: CcState,
): StatusChip[] {
  if (!statuses) return [];
  const blockBuildup = cc ? isStunFreezeBuildupBlocked(cc) : false;
  return order.flatMap((id): StatusChip[] => {
    if (blockBuildup && (id === "stun" || id === "freeze")) return [];
    const value = statuses[id] ?? 0;
    return value > 0 ? [{ id, value, ...(id === "phoenixFeather" ? { hideValue: true } : {}) }] : [];
  });
}

function buildActiveCcChips(cc: CcState): StatusChip[] {
  const chips: StatusChip[] = [];
  if (cc.stunSkipTurns > 0) chips.push({ id: "stunned", value: cc.stunSkipTurns, hideValue: true });
  if (cc.freezeSkipTurns > 0) chips.push({ id: "frozen", value: cc.freezeSkipTurns, hideValue: true });
  return chips;
}

function buildCcImmunityChip(cc: CcState): StatusChip[] {
  if (isCcControlled(cc) || cc.cooldown <= 0) return [];
  return [{ id: "ccImmunity", value: cc.cooldown, hideValue: true }];
}

const BUFF_TIER_CHIP_IDS = new Set<string>(["block", "armor", "forge", "haste", "phoenixFeather"]);

function insertAfterBuffTier(chips: StatusChip[], additions: StatusChip[]): StatusChip[] {
  if (additions.length === 0) return chips;
  let insertAt = 0;
  for (const [index, chip] of chips.entries()) {
    if (BUFF_TIER_CHIP_IDS.has(chip.id)) insertAt = index + 1;
  }
  return [...chips.slice(0, insertAt), ...additions, ...chips.slice(insertAt)];
}

function buildArmedPlayerChips(state: BattleSnapshot): StatusChip[] {
  const chips: StatusChip[] = [];
  const { flags } = state;
  for (const id of ARMED_PLAYER_CHIP_IDS) {
    const value = flags[id];
    if (value === true || (typeof value === "number" && value > 0))
      chips.push({
        id,
        value: value === true ? 1 : value,
        ...(id === "nextHitPhysicalBonus" ? {} : { hideValue: true }),
      });
  }

  const echoCount = state.pendingTurnStartEffects.filter((pulse) =>
    pulse.effects.some((effect) => effect.kind !== "damage"),
  ).length;
  if (echoCount > 0) chips.push({ id: "echo", value: echoCount });

  chips.push(...buildActiveCcChips(state.playerCC));
  chips.push(...buildCcImmunityChip(state.playerCC));

  return chips;
}

function buildPendingEnemyChips(state: BattleSnapshot): StatusChip[] {
  const incomingByType = new Map<DamageType, number>();
  for (const pulse of state.pendingTurnStartEffects) {
    if (pulse.effects.length === 0) continue;
    if (!pulse.effects.every((effect) => effect.kind === "damage")) continue;
    for (const effect of pulse.effects) {
      incomingByType.set(effect.damageType, (incomingByType.get(effect.damageType) ?? 0) + effect.amount);
    }
  }
  return DAMAGE_TYPES.flatMap((damageType): StatusChip[] => {
    const amount = incomingByType.get(damageType);
    return amount ? [{ id: `pending-${damageType}`, value: amount }] : [];
  });
}

export function getPlayerStatusChips(state: BattleSnapshot | null | undefined): StatusChip[] {
  if (!state) return [];
  return insertAfterBuffTier(
    buildStatusChips(PLAYER_STATUS_DISPLAY_ORDER, state.playerStatuses, state.playerCC),
    buildArmedPlayerChips(state),
  );
}

export function getEnemyStatusChips(state: BattleSnapshot | null | undefined): StatusChip[] {
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
