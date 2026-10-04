import { describe, expect, it } from "vitest";
import { applyEffectByKind } from "@/lib/battle/effect-handlers/registry";
import type { CombatTextEvent } from "@/lib/battle/types";
import { MIN_MAX_MANA_FLOOR } from "@/lib/game-constants";
import { makeCombatTexts as makeTexts, makeTestCard, patchBattleState } from "../../fixtures/battle";
import { defaultTrinketManifest } from "../../fixtures/default-battle-state";

const manaCard = makeTestCard({ id: "mana-test", effects: [] });

function applyManaEffect(
  state: ReturnType<typeof patchBattleState>,
  effect: Parameters<typeof applyEffectByKind>[2],
  potionMult: number,
  texts: CombatTextEvent[],
) {
  return applyEffectByKind(state, manaCard, effect, potionMult, texts);
}

describe("applyEffectByKind (mana effects)", () => {
  it("scales and caps potion Mana before paying healing for the actual gain", () => {
    const state = patchBattleState({ mana: 0, maxMana: 4, playerHealth: 10, talentEffects: { healthPerMana: 2 } });
    const texts = makeTexts();
    const result = applyManaEffect(state, { kind: "restore-mana", amount: 3 }, 1.5, texts);
    expect(result.mana).toBe(4);
    expect(result.playerHealth).toBe(18);
    expect(texts).toEqual([
      { target: "player", kind: "status", stat: "mana", amount: 4 },
      { target: "player", kind: "heal", stat: "health", amount: 8 },
    ]);
    const cappedTexts = makeTexts();
    const capped = applyManaEffect(result, { kind: "restore-mana", amount: 3 }, 1.5, cappedTexts);
    expect(capped.playerHealth).toBe(18);
    expect(cappedTexts).toEqual([]);
    expect(state.mana).toBe(0);
  });

  it("loses mana without going below zero", () => {
    const state = patchBattleState({ mana: 1, maxMana: 4 });
    const texts = makeTexts();
    const effect = { kind: "lose-mana" as const, amount: 3 };
    const result = applyManaEffect(state, effect, 1, texts);
    expect(result.mana).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "mana", amount: 1 });
  });

  it("does not report Mana loss when already empty", () => {
    const texts = makeTexts();
    applyManaEffect(patchBattleState({ mana: 0 }), { kind: "lose-mana", amount: 3 }, 1, texts);
    expect(texts).toEqual([]);
  });

  it("gains max mana and current mana together", () => {
    const state = patchBattleState({ mana: 2, maxMana: 4 });
    const texts = makeTexts();
    const effect = { kind: "gain-max-mana" as const, amount: 2 };
    const result = applyManaEffect(state, effect, 1, texts);
    expect(result.maxMana).toBe(6);
    expect(result.mana).toBe(4);
  });

  it("clamps Mana Crystals at the floor and emits only actual loss, then stays inert", () => {
    const texts = makeTexts();
    const state = patchBattleState({ mana: 4, maxMana: 4 });
    const result = applyManaEffect(state, { kind: "lose-max-mana", amount: 5 }, 1, texts);
    expect(result.maxMana).toBe(MIN_MAX_MANA_FLOOR);
    expect(result.mana).toBe(MIN_MAX_MANA_FLOOR);
    expect(texts).toEqual([{ target: "player", kind: "damage", stat: "mana", amount: 4 - MIN_MAX_MANA_FLOOR }]);
    const emptyTexts = makeTexts();
    expect(applyManaEffect(result, { kind: "lose-max-mana", amount: 1 }, 1, emptyTexts)).toBe(result);
    expect(emptyTexts).toEqual([]);
    expect(state.maxMana).toBe(4);
  });

  it("burns enemy when losing max mana with burnDamageOnManaCrystalLoss talent", () => {
    const state = patchBattleState({
      mana: 4,
      maxMana: 4,
      enemyHealth: 20,
      talentEffects: { burnDamageOnManaCrystalLoss: 3 },
    });
    const texts = makeTexts();
    const effect = { kind: "lose-max-mana" as const, amount: 1 };
    const result = applyManaEffect(state, effect, 1, texts);
    expect(result.enemyHealth).toBe(17);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 3 });
  });

  it("a lethal mana-crystal burn pays lethality payouts", () => {
    const state = patchBattleState({
      mana: 4,
      maxMana: 4,
      playerHealth: 20,
      playerMaxHealth: 30,
      enemyHealth: 2,
      talentEffects: { burnDamageOnManaCrystalLoss: 3 },
      gearEffects: { goldOnKill: 4 },
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
    const state = patchBattleState({ mana, maxMana: 4 });
    const next = applyManaEffect(state, { kind: "restore-mana", amount: 1, allowOverflow: true }, 1, []);
    expect(next.mana).toBe(mana + 1);
    expect(next.maxMana).toBe(4);
  });
  it("ordinary restoration preserves existing overflow without adding more", () => {
    const state = patchBattleState({ mana: 5, maxMana: 4 });
    const next = applyManaEffect(state, { kind: "restore-mana", amount: 1 }, 1, []);
    expect(next.mana).toBe(5);
  });
});
