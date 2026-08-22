import { describe, expect, it } from "vitest";
import { applyEffectByKind } from "@/lib/battle/effect-handlers/registry";
import type { CombatTextEvent } from "@/lib/battle/types";
import { MIN_MAX_MANA_FLOOR } from "@/lib/game-constants";
import { makeCombatTexts as makeTexts, makeTestBattleState, makeTestCard } from "../../fixtures/battle";

const manaCard = makeTestCard({ id: "mana-test", effects: [] });

function applyManaEffect(
  state: ReturnType<typeof makeTestBattleState>,
  effect: Parameters<typeof applyEffectByKind>[3],
  potionMult: number,
  texts: CombatTextEvent[],
) {
  return applyEffectByKind(effect.kind, state, manaCard, effect, potionMult, texts);
}

describe("applyEffectByKind (mana effects)", () => {
  it("restores mana and emits combat text", () => {
    const state = makeTestBattleState({ mana: 2, maxMana: 4 });
    const texts = makeTexts();
    const effect = { kind: "restore-mana" as const, amount: 2 };
    const result = applyManaEffect(state, effect, 1, texts);
    expect(result.mana).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "mana", amount: 2 });
  });

  it("applies potion multiplier to restore-mana", () => {
    const state = makeTestBattleState({ mana: 0, maxMana: 4 });
    const texts = makeTexts();
    const effect = { kind: "restore-mana" as const, amount: 3 };
    const result = applyManaEffect(state, effect, 1.5, texts);
    // 3 * 1.5 rounds to 5 but gains cap at maxMana.
    expect(result.mana).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "mana", amount: 4 });
  });

  it("heals on mana gain when healOnManaGain talent is active", () => {
    const state = makeTestBattleState({
      mana: 2,
      maxMana: 4,
      playerHealth: 20,
      talentEffects: { ...makeTestBattleState().talentEffects, healOnManaGain: 3 },
    });
    const texts = makeTexts();
    const effect = { kind: "restore-mana" as const, amount: 1 };
    const result = applyManaEffect(state, effect, 1, texts);
    expect(result.playerHealth).toBe(23);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 3 });
  });

  it("loses mana without going below zero", () => {
    const state = makeTestBattleState({ mana: 1, maxMana: 4 });
    const texts = makeTexts();
    const effect = { kind: "lose-mana" as const, amount: 3 };
    const result = applyManaEffect(state, effect, 1, texts);
    expect(result.mana).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "mana", amount: 3 });
  });

  it("gains max mana and current mana together", () => {
    const state = makeTestBattleState({ mana: 2, maxMana: 4 });
    const texts = makeTexts();
    const effect = { kind: "gain-max-mana" as const, amount: 2 };
    const result = applyManaEffect(state, effect, 1, texts);
    expect(result.maxMana).toBe(6);
    expect(result.mana).toBe(4);
  });

  it("reduces max mana and clamps current mana to the new cap", () => {
    const state = makeTestBattleState({ mana: 4, maxMana: 4 });
    const texts = makeTexts();
    const effect = { kind: "lose-max-mana" as const, amount: 2 };
    const result = applyManaEffect(state, effect, 1, texts);
    expect(result.maxMana).toBe(2);
    expect(result.mana).toBe(2);
    expect(result.maxMana).toBeGreaterThanOrEqual(MIN_MAX_MANA_FLOOR);
  });

  it("does not drop max mana below MIN_MAX_MANA_FLOOR", () => {
    const state = makeTestBattleState({ mana: 1, maxMana: 1 });
    const texts = makeTexts();
    const effect = { kind: "lose-max-mana" as const, amount: 5 };
    const result = applyManaEffect(state, effect, 1, texts);
    expect(result.maxMana).toBe(MIN_MAX_MANA_FLOOR);
    expect(result.mana).toBe(MIN_MAX_MANA_FLOOR);
  });

  it("burns enemy when losing max mana with burnDamageOnManaCrystalLoss talent", () => {
    const state = makeTestBattleState({
      mana: 4,
      maxMana: 4,
      enemyHealth: 20,
      talentEffects: { ...makeTestBattleState().talentEffects, burnDamageOnManaCrystalLoss: 3 },
    });
    const texts = makeTexts();
    const effect = { kind: "lose-max-mana" as const, amount: 1 };
    const result = applyManaEffect(state, effect, 1, texts);
    expect(result.enemyHealth).toBe(17);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 3 });
  });
});
