import { describe, expect, it } from "vitest";
import { applyEnemyDotDamage, dealEnemyDotTick, detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { BATTLE_CONFIG } from "@/lib/game-constants";
import { defaultEnemyMitigation, defaultEnemyStatusValues } from "../../fixtures/default-battle-state";
import { makeCombatTexts as makeTexts, makeTestBattleState, patchBattleState } from "../../fixtures/battle";

describe("applyEnemyDotDamage", () => {
  it("sums pulses into one health transition and applies every stack update", () => {
    const state = patchBattleState({
      enemyHealth: 40,
      enemyStatuses: defaultEnemyStatusValues({ burn: 8, poison: 5 }),
    });
    const next = applyEnemyDotDamage(
      state,
      [
        { status: "burn", finalDamage: 8, nextStacks: 4 },
        { status: "poison", finalDamage: 5, nextStacks: 4 },
      ],
      makeTexts(),
    );
    expect(next.enemyHealth).toBe(27);
    expect(next.enemyStatuses.burn).toBe(4);
    expect(next.enemyStatuses.poison).toBe(4);
  });

  it("pays burn-defeat gear before stack decay so a lethal last stack still counts", () => {
    const state = patchBattleState({
      enemyHealth: 1,
      playerHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ burn: 1 }),
      gearEffects: { ...makeTestBattleState().gearEffects, healOnBurnEnemyDefeated: 6 },
    });
    const next = applyEnemyDotDamage(state, [{ status: "burn", finalDamage: 1, nextStacks: 0 }], makeTexts());
    expect(next.enemyHealth).toBe(0);
    expect(next.enemyStatuses.burn).toBe(0);
    expect(next.playerHealth).toBe(26);
  });

  it("decays enemy armor once for the summed pulse damage", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMitigation: defaultEnemyMitigation({ armor: 3 }),
    });
    const next = applyEnemyDotDamage(
      state,
      [
        { status: "burn", finalDamage: 4, nextStacks: 2 },
        { status: "bleed", finalDamage: 2, nextStacks: 0 },
      ],
      makeTexts(),
    );
    expect(next.enemyHealth).toBe(24);
    expect(next.enemyMitigation.armor).toBe(3 - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT);
  });

  it("runs optional riders after stack updates", () => {
    const state = patchBattleState({
      enemyHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ poison: 4 }),
    });
    const next = applyEnemyDotDamage(
      state,
      [{ status: "poison", finalDamage: 4, nextStacks: 3 }],
      makeTexts(),
      (after) => ({
        ...after,
        gold: after.gold + after.enemyStatuses.poison,
      }),
    );
    expect(next.enemyStatuses.poison).toBe(3);
    expect(next.gold).toBe(state.gold + 3);
  });
});

describe("dealEnemyDotTick", () => {
  it("is a single-pulse applyEnemyDotDamage", () => {
    const state = patchBattleState({
      enemyHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ burn: 6 }),
    });
    const next = dealEnemyDotTick(state, "burn", 6, 3, makeTexts());
    expect(next.enemyHealth).toBe(14);
    expect(next.enemyStatuses.burn).toBe(3);
  });
});

describe("detonateEnemyStatuses", () => {
  it("is a no-op when none of the requested statuses have stacks", () => {
    const state = patchBattleState({
      enemyHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ burn: 4 }),
    });
    expect(detonateEnemyStatuses(state, ["bleed", "poison"], makeTexts())).toBe(state);
  });

  it("bursts remaining bleed and poison in one health transition", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ bleed: 6, poison: 4 }),
    });
    const texts = makeTexts();
    const next = detonateEnemyStatuses(state, ["bleed", "poison"], texts);
    expect(next.enemyHealth).toBe(20);
    expect(next.enemyStatuses.bleed).toBe(0);
    expect(next.enemyStatuses.poison).toBe(0);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "bleed", amount: 6 });
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "poison", amount: 4 });
  });

  it("pays pending bleed leech against actual health lost, then clears the pending amount", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      playerHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ bleed: 6 }),
      pendingBleedLeechHealing: 3,
    });
    const texts = makeTexts();
    const next = detonateEnemyStatuses(state, ["bleed"], texts);
    expect(next.enemyHealth).toBe(24);
    expect(next.pendingBleedLeechHealing).toBe(0);
    expect(next.playerHealth).toBe(22);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 2 });
  });
});

describe("remaining-tick detonation", () => {
  it.each([
    [5, 15],
    [10, 39],
  ])("sums the full decay of %i Poison", (poison, total) => {
    const state = patchBattleState({ enemyHealth: 100, enemyMaxHealth: 100, enemyStatuses: { poison, bleed: 6 } });
    const texts = makeTexts();
    const next = detonateEnemyStatuses(state, ["bleed", "poison"], texts, "remaining-ticks");
    expect(next.enemyHealth).toBe(100 - total - 6);
    expect(next.enemyStatuses.poison).toBe(0);
    expect(next.enemyStatuses.bleed).toBe(0);
    expect(detonateEnemyStatuses(next, ["bleed", "poison"], texts, "remaining-ticks")).toBe(next);
    expect(state.enemyStatuses.poison).toBe(poison);
  });

  it("rounds each projected tick and excludes random Poison growth", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { poison: 5 },
      currentEnemy: {
        ...makeTestBattleState().currentEnemy,
        traits: [{ id: "poison-resistance", title: "Poison Resistance", description: "" }],
      },
      rng: () => {
        throw new Error("Detonation must not roll future procs");
      },
    });
    const multiplier = 0.75;
    const next = detonateEnemyStatuses(state, ["poison"], makeTexts(), "remaining-ticks");
    expect(next.enemyHealth).toBe(100 - [5, 4, 3, 2, 1].reduce((sum, tick) => sum + Math.round(tick * multiplier), 0));
  });
});
