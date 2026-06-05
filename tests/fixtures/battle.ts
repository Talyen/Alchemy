// Deterministic battle setup helpers for Vitest (mirrors tests/helpers.ts card shapes).
import type { BattleState } from "@/lib/battle/types";
import { defaultBattleState } from "@/lib/battle";
import { makeTestCard } from "./cards";

export { makeTestCard } from "./cards";

/** Seeded PRNG for `createBattleState({ rng })` and battle talent rolls. */
export function seededRng(seed = 42): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

export function makeTestBattleState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    ...defaultBattleState(),
    mana: 4,
    maxMana: 4,
    rng: seededRng(42),
    ...overrides,
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
