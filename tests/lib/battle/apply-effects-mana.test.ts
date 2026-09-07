import { describe, expect, it } from "vitest";
import { applyEffectByKind } from "@/lib/battle/effect-handlers/registry";
import type { CombatTextEvent } from "@/lib/battle/types";
import { MIN_MAX_MANA_FLOOR } from "@/lib/game-constants";
import { makeCombatTexts as makeTexts, makeTestBattleState, makeTestCard } from "../../fixtures/battle";
import { defaultTrinketManifest } from "../../fixtures/default-battle-state";

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
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "mana", amount: 1 });
  });

  it("does not report Mana loss when already empty", () => {
    const texts = makeTexts();
    applyManaEffect(makeTestBattleState({ mana: 0 }), { kind: "lose-mana", amount: 3 }, 1, texts);
    expect(texts).toEqual([]);
  });

  it("reports only Mana Crystals actually lost at the minimum", () => {
    const texts = makeTexts();
    const state = makeTestBattleState({ mana: 2, maxMana: 2 });
    applyManaEffect(state, { kind: "lose-max-mana", amount: 5 }, 1, texts);
    expect(texts).toEqual([{ target: "player", kind: "damage", stat: "mana", amount: 2 - MIN_MAX_MANA_FLOOR }]);
  });

  it("does not report Mana Crystal loss at the minimum", () => {
    const texts = makeTexts();
    const state = makeTestBattleState({ mana: MIN_MAX_MANA_FLOOR, maxMana: MIN_MAX_MANA_FLOOR });
    applyManaEffect(state, { kind: "lose-max-mana", amount: 1 }, 1, texts);
    expect(texts).toEqual([]);
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

  it("a lethal mana-crystal burn pays lethality payouts", () => {
    const state = makeTestBattleState({
      mana: 4,
      maxMana: 4,
      playerHealth: 20,
      playerMaxHealth: 30,
      enemyHealth: 2,
      talentEffects: { ...makeTestBattleState().talentEffects, burnDamageOnManaCrystalLoss: 3 },
      gearEffects: { ...makeTestBattleState().gearEffects, goldOnKill: 4 },
      trinketEffects: defaultTrinketManifest({ boneCharmHealOnKill: 2 }),
    });
    const texts = makeTexts();
    const effect = { kind: "lose-max-mana" as const, amount: 1 };
    const result = applyManaEffect(state, effect, 1, texts);
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(22);
    expect(result.gold).toBe(4);
  });
});

describe("temporary Mana overflow", () => {
  it.each([4, 5])("adds extra Mana above %i without increasing Mana Crystals", (mana) => {
    const state = makeTestBattleState({ mana, maxMana: 4 });
    const next = applyManaEffect(state, { kind: "restore-mana", amount: 1, allowOverflow: true }, 1, []);
    expect(next.mana).toBe(mana + 1);
    expect(next.maxMana).toBe(4);
  });
  it("ordinary restoration preserves existing overflow without adding more", () => {
    const state = makeTestBattleState({ mana: 5, maxMana: 4 });
    const next = applyManaEffect(state, { kind: "restore-mana", amount: 1 }, 1, []);
    expect(next.mana).toBe(5);
  });
});
