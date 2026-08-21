// Deterministic battle setup helpers for Vitest (mirrors tests/helpers.ts card shapes).
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "@/lib/battle/types";
import { dealDamageToEnemy } from "@/lib/battle/damage";
import { defaultBattleState } from "@/lib/battle";
import { makeTestCard } from "./cards";
import { seededRng } from "./rng";

export { makeTestCard, makeTestCardWithId } from "./cards";
export { seededRng } from "./rng";

export function makeCombatTexts(): CombatTextEvent[] {
  return [];
}

/** Build a damage-effect card effect (canonical home for the shared helper). */
export function makeEffect(
  damageType: string,
  amount: number,
  extras: Partial<BattleCardEffect> = {},
): BattleCardEffect {
  return {
    kind: "damage",
    damageType: damageType as import("@/lib/game-data/types").DamageType,
    amount,
    ...extras,
  } as BattleCardEffect;
}

/** Shared battle state with a 10-mana default (matches the run-loop effect suites). */
export function makeState(overrides: Parameters<typeof makeTestBattleState>[0] = {}) {
  return makeTestBattleState({ mana: 10, ...overrides });
}

type DamageEffect = Extract<BattleCardEffect, { kind: "damage" }>;

/**
 * dealDamageToEnemy with the card's first damage effect extracted internally,
 * so damage suites do not repeat the per-test cast boilerplate.
 */
export function dealDamage(state: BattleState, card: BattleCard, texts: CombatTextEvent[] = makeCombatTexts()) {
  const effect = card.effects.find((candidate): candidate is DamageEffect => candidate.kind === "damage");
  if (!effect) throw new Error("dealDamage fixture: card has no damage effect");
  return dealDamageToEnemy(state, card, effect, texts);
}

export function makeTestBattleState(overrides: Partial<BattleState> = {}): BattleState {
  const base = defaultBattleState();
  const merged = {
    ...base,
    mana: 4,
    maxMana: 4,
    rng: seededRng(42),
    // Authored-magnitude unit tests; fight-pacing.test.ts opts back in.
    appliesFightPacing: false,
  };
  return {
    ...merged,
    ...overrides,
    playerCC: overrides.playerCC ? { ...merged.playerCC, ...overrides.playerCC } : merged.playerCC,
    enemyCC: overrides.enemyCC ? { ...merged.enemyCC, ...overrides.enemyCC } : merged.enemyCC,
  };
}

/** Merge partial battle state without repeating default status / boon / talent spreads. */
export function patchBattleState(patch: Partial<BattleState> = {}): BattleState {
  const base = makeTestBattleState();
  return {
    ...base,
    ...patch,
    playerStatuses: patch.playerStatuses ? { ...base.playerStatuses, ...patch.playerStatuses } : base.playerStatuses,
    enemyStatuses: patch.enemyStatuses ? { ...base.enemyStatuses, ...patch.enemyStatuses } : base.enemyStatuses,
    trinketEffects: patch.trinketEffects ? { ...base.trinketEffects, ...patch.trinketEffects } : base.trinketEffects,
    talentEffects: patch.talentEffects ? { ...base.talentEffects, ...patch.talentEffects } : base.talentEffects,
    flags: patch.flags ? { ...base.flags, ...patch.flags } : base.flags,
    enemyMitigation: patch.enemyMitigation
      ? { ...base.enemyMitigation, ...patch.enemyMitigation }
      : base.enemyMitigation,
    playerCC: patch.playerCC ? { ...base.playerCC, ...patch.playerCC } : base.playerCC,
    enemyCC: patch.enemyCC ? { ...base.enemyCC, ...patch.enemyCC } : base.enemyCC,
  };
}

export function slashDeck(count: number): BattleCard[] {
  return Array.from({ length: count }, (_, index) =>
    makeTestCard({
      id: `slash-${index}`,
      title: "Slash",
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    }),
  );
}

export function blockDeck(count: number): BattleCard[] {
  return Array.from({ length: count }, (_, index) =>
    makeTestCard({
      id: `block-${index}`,
      title: "Block",
      effects: [{ kind: "player-status", status: "block", amount: 5 }],
    }),
  );
}

export function statusDeck(
  status: "burn" | "poison" | "bleed" | "stun" | "freeze",
  amount: number,
  count: number,
): BattleCard[] {
  return Array.from({ length: count }, (_, index) =>
    makeTestCard({
      id: `${status}-${index}`,
      title: status,
      effects: [{ kind: "damage", damageType: status, amount }],
    }),
  );
}
