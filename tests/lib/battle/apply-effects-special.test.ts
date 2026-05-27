import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle/apply-effects";
import { DAMAGE_TYPES } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle/types";
import { makeTestBattleState, makeTestCard, seededRng } from "../../fixtures/battle";

function makeState(overrides: Parameters<typeof makeTestBattleState>[0] = {}) {
  const enemyHealth = overrides.enemyHealth ?? 30;
  return makeTestBattleState({
    mana: 10,
    enemyHealth,
    enemyMaxHealth: overrides.enemyMaxHealth ?? enemyHealth,
    ...overrides,
  });
}

describe("applyCardEffects — cleanse-player-status-to-damage (Exorcism)", () => {
  it("clears player burn and deals holy damage equal to stacks removed", () => {
    const state = makeState({
      playerStatuses: {
        block: 0,
        armor: 0,
        forge: 0,
        haste: 0,
        burn: 4,
        poison: 0,
        bleed: 0,
        freeze: 0,
        stun: 0,
      },
    });
    const card = makeTestCard({
      id: "exorcism",
      effects: [{ kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy" }],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);

    expect(result.playerStatuses.burn).toBe(0);
    expect(result.enemyHealth).toBe(26);
  });

  it("does nothing when player has no burn", () => {
    const state = makeState();
    const card = makeTestCard({
      id: "exorcism",
      effects: [{ kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy" }],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);

    expect(result.playerStatuses.burn).toBe(0);
    expect(result.enemyHealth).toBe(30);
  });
});

describe("applyCardEffects — equalToGoldPercent (Tithe)", () => {
  it("deals holy damage equal to 10% of battle gold", () => {
    const state = makeState({ gold: 47 });
    const card = makeTestCard({
      id: "tithe",
      effects: [{ kind: "damage", damageType: "holy", amount: 0, equalToGoldPercent: 10 }],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);

    expect(result.enemyHealth).toBe(25);
  });
});

describe("applyCardEffects — random-damage (Roulette)", () => {
  it("uses battle rng for deterministic damage type and amount", () => {
    const rng = seededRng(99);
    const firstRoll = rng();
    const secondRoll = rng();
    const expectedType = DAMAGE_TYPES[Math.trunc(firstRoll * DAMAGE_TYPES.length)]!;
    const span = 7;
    const expectedAmount = 1 + Math.trunc(secondRoll * span);

    const state = makeState({ rng: seededRng(99) });
    const card = makeTestCard({
      id: "roulette",
      effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 7 }],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);

    expect(result.enemyHealth).toBe(30 - expectedAmount);
    expect(texts.some((t) => t.kind === "damage" && t.stat === expectedType)).toBe(true);
  });
});
