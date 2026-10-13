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

export function makeState(overrides: Parameters<typeof makeTestBattleState>[0] = {}) {
  return makeTestBattleState({ mana: 10, ...overrides });
}

const chanceFailRng = () => 0.99;

export function makeStateWithFailedRolls(overrides: Parameters<typeof makeTestBattleState>[0] = {}) {
  return makeState({ rng: chanceFailRng, ...overrides });
}

type DamageEffect = Extract<BattleCardEffect, { kind: "damage" }>;

export function dealDamage(state: BattleState, card: BattleCard, texts: CombatTextEvent[] = makeCombatTexts()) {
  const effect = card.effects.find((candidate): candidate is DamageEffect => candidate.kind === "damage");
  if (!effect) throw new Error("dealDamage fixture: card has no damage effect");
  return dealDamageToEnemy(state, card, effect, texts);
}

export function makeTestBattleState(overrides: Partial<BattleState> = {}): BattleState {
  const base = defaultBattleState();
  const merged = {
    ...base,
    mana: BASE_PLAYER_MANA,
    maxMana: BASE_PLAYER_MANA,
    rng: seededRng(42),

    appliesFightPacing: false,
  };
  return {
    ...merged,
    ...overrides,
    playerCC: overrides.playerCC ? { ...merged.playerCC, ...overrides.playerCC } : merged.playerCC,
    enemyCC: overrides.enemyCC ? { ...merged.enemyCC, ...overrides.enemyCC } : merged.enemyCC,
  };
}

const BATTLE_RECORD_FIELDS = [
  "playerStatuses",
  "enemyStatuses",
  "trinketEffects",
  "talentEffects",
  "gearEffects",
  "flags",
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

export function patchBattleState(patch: BattleStatePatch = {}): BattleState {
  const base = makeTestBattleState();
  const state = { ...base, ...patch } as BattleState;
  for (const field of BATTLE_RECORD_FIELDS) {
    Object.assign(state, {
      [field]: patch[field] || field === "uniqueGear" ? { ...base[field], ...patch[field] } : base[field],
    });
  }
  return state;
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

/**
 * Shared deterministic battle preset for regression tests.
 * Failing rolls (`rng: () => 0.99`) keep chance branches stable; callers
 * override per-case via `overrides` (an explicit `rng` in overrides wins).
 */
export function regressionBattle(overrides: BattleStatePatch = {}): BattleState {
  return patchBattleState({ rng: () => 0.99, ...overrides });
}
