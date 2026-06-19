// Deterministic battle setup helpers for Vitest (mirrors tests/helpers.ts card shapes).
import type { BattleCard } from "@/lib/game-data";
import type { BattleState } from "@/lib/battle/types";
import { defaultBattleState } from "@/lib/battle";
import { makeTestCard } from "./cards";
import { seededRng } from "./rng";

export { makeTestCard } from "./cards";
export { seededRng } from "./rng";

export function makeTestBattleState(overrides: Partial<BattleState> = {}): BattleState {
  const base = defaultBattleState();
  const merged = {
    ...base,
    mana: 4,
    maxMana: 4,
    rng: seededRng(42),
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
