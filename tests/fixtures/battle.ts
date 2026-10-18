import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "@/lib/battle/types";
import { dealDamageToEnemy } from "@/lib/battle/damage";
import { BASE_PLAYER_MANA } from "@/lib/game-constants";
import { makeTestCard } from "./cards";
import { seededRng } from "./rng";
import { defaultBattleState } from "@/lib/battle";

export { makeTestCard, makeTestCardWithId } from "./cards";
export { seededRng } from "./rng";

export function makeCombatTexts(): CombatTextEvent[] {
  return [];
}

type DamageEffect = Extract<BattleCardEffect, { kind: "damage" }>;

export function makeEffect(
  damageType: DamageEffect["damageType"],
  amount: number,
  extras: Partial<Omit<DamageEffect, "kind" | "damageType" | "amount">> = {},
): DamageEffect {
  return { kind: "damage", damageType, amount, ...extras };
}

export function makeState(overrides: Parameters<typeof makeTestBattleState>[0] = {}) {
  return makeTestBattleState({ mana: 10, ...overrides });
}

const chanceFailRng = () => 0.99;

export function makeStateWithFailedRolls(overrides: Parameters<typeof makeTestBattleState>[0] = {}) {
  return makeState({ rng: chanceFailRng, ...overrides });
}

export function dealDamage(state: BattleState, card: BattleCard, texts: CombatTextEvent[] = makeCombatTexts()) {
  const effect = card.effects.find((candidate): candidate is DamageEffect => candidate.kind === "damage");
  if (!effect) throw new Error("dealDamage fixture: card has no damage effect");
  return dealDamageToEnemy(state, card, effect, texts);
}

const BATTLE_RECORD_FIELDS = [
  "playerStatuses",
  "enemyStatuses",
  "trinketEffects",
  "talentEffects",
  "gearEffects",
  "flags",
  "reactions",
  "uniqueGear",
  "enemyMitigation",
  "playerCC",
  "enemyCC",
  "currentEnemy",
] as const;
type BattleRecordField = (typeof BATTLE_RECORD_FIELDS)[number];

export type BattleStatePatch = Partial<Omit<BattleState, BattleRecordField>> & {
  [K in BattleRecordField]?: Partial<BattleState[K]>;
};

export function makeTestBattleState(patch: BattleStatePatch = {}): BattleState {
  const base = {
    ...defaultBattleState(),
    mana: BASE_PLAYER_MANA,
    maxMana: BASE_PLAYER_MANA,
    rng: seededRng(42),
    appliesFightPacing: false,
  };
  const state = { ...base, ...patch } as BattleState;
  for (const field of BATTLE_RECORD_FIELDS) {
    if (!Object.hasOwn(patch, field)) continue;
    Object.assign(state, { [field]: { ...base[field], ...patch[field] } });
  }
  return state;
}

export function patchBattleState(patch: BattleStatePatch = {}): BattleState {
  return makeTestBattleState(patch);
}

function dodgeThenMissRng() {
  let calls = 0;
  return () => {
    calls += 1;
    return calls === 1 ? 0.01 : 0.99;
  };
}

export function incomingPhysical(overrides: Parameters<typeof patchBattleState>[0] = {}) {
  return patchBattleState({
    playerHealth: 100,
    playerMaxHealth: 100,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    rng: dodgeThenMissRng(),
    ...overrides,
  });
}

function effectDeck(id: string, title: string, effect: BattleCardEffect, count: number): BattleCard[] {
  return Array.from({ length: count }, (_, index) =>
    makeTestCard({ id: `${id}-${index}`, title, effects: [{ ...effect }] }),
  );
}

export function slashDeck(count: number): BattleCard[] {
  return effectDeck("slash", "Slash", { kind: "damage", damageType: "physical", amount: 6 }, count);
}

/**
 * Shared deterministic battle preset for regression tests.
 * Failing rolls (`rng: () => 0.99`) keep chance branches stable; callers
 * override per-case via `overrides` (an explicit `rng` in overrides wins).
 */
export function regressionBattle(overrides: BattleStatePatch = {}): BattleState {
  return patchBattleState({ rng: () => 0.99, ...overrides });
}
