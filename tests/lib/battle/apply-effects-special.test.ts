import { describe, expect, it } from "vitest";
import { applyCardEffects, defaultTalentEffects } from "@/lib/battle";
import { DAMAGE_TYPES } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle/types";
import { makeTestBattleState, makeTestCard, patchBattleState, seededRng } from "../../fixtures/battle";
import { defaultPlayerStatusValues } from "../../fixtures/default-battle-state";

function makeState(overrides: Parameters<typeof makeTestBattleState>[0] = {}) {
  const enemyHealth = overrides.enemyHealth ?? 30;
  return makeTestBattleState({
    mana: 10,
    enemyHealth,
    enemyMaxHealth: overrides.enemyMaxHealth ?? enemyHealth,
    ...overrides,
  });
}

describe("applyCardEffects â€” cleanse-player-status-to-damage (Exorcism)", () => {
  it("clears player burn and deals holy damage equal to stacks removed", () => {
    const state = makeState({
      playerStatuses: defaultPlayerStatusValues({ burn: 4 }),
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

describe("applyCardEffects â€” equalToGoldPercent (Tithe)", () => {
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

describe("applyCardEffects â€” chance (Roulette)", () => {
  it("damage branch deals 3 of a random type when roll succeeds", () => {
    const rng = seededRng(7);
    const branchRoll = rng();
    expect(branchRoll).toBeLessThan(0.5);
    const typeRoll = rng();
    rng();
    const expectedType = DAMAGE_TYPES[Math.trunc(typeRoll * DAMAGE_TYPES.length)]!;
    const expectedAmount = 3;

    const state = makeState({ rng: seededRng(7), gold: 10 });
    const card = makeTestCard({
      id: "roulette",
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "random-damage", minAmount: 3, maxAmount: 3 }],
          failureEffects: [{ kind: "gain-gold", amount: 3 }],
        },
      ],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);

    expect(result.enemyHealth).toBe(30 - expectedAmount);
    expect(result.gold).toBe(10);
    expect(texts.some((t) => t.kind === "damage" && t.stat === expectedType)).toBe(true);
  });

  it("gold branch gains 3 gold when roll fails", () => {
    const rng = seededRng(99);
    const branchRoll = rng();
    expect(branchRoll).toBeGreaterThanOrEqual(0.5);

    const state = makeState({ rng: seededRng(99), gold: 10 });
    const card = makeTestCard({
      id: "roulette",
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "random-damage", minAmount: 3, maxAmount: 3 }],
          failureEffects: [{ kind: "gain-gold", amount: 3 }],
        },
      ],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);

    expect(result.gold).toBe(13);
    expect(result.enemyHealth).toBe(30);
  });
});

describe("applyCardEffects â€” random-damage (Gambler's Shot)", () => {
  it("uses battle rng for deterministic damage type and amount in range", () => {
    const rng = seededRng(99);
    const firstRoll = rng();
    const secondRoll = rng();
    const expectedType = DAMAGE_TYPES[Math.trunc(firstRoll * DAMAGE_TYPES.length)]!;
    const span = 6;
    const expectedAmount = 1 + Math.trunc(secondRoll * span);

    const state = makeState({ rng: seededRng(99) });
    const card = makeTestCard({
      id: "gamblers-shot",
      effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 6 }],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);

    expect(result.enemyHealth).toBe(30 - expectedAmount);
    expect(texts.some((t) => t.kind === "damage" && t.stat === expectedType)).toBe(true);
  });
});

describe("forge burn", () => {
  it("applies the configured burn amount", () => {
    const card = makeTestCard({ effects: [{ kind: "player-status", status: "forge", amount: 1 }] });
    const texts: CombatTextEvent[] = [];
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
      talentEffects: { ...defaultTalentEffects, forgeBurnThreshold: 3, forgeBurnDamage: 6 },
    });
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyStatuses.burn).toBe(6);
    expect(result.playerStatuses.forge).toBe(3);
  });
});
