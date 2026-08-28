import { describe, expect, it } from "vitest";
import { makeStateWithFailedRolls as makeState, makeTestCard } from "../../fixtures/battle";
import { defaultEnemyStatusValues } from "../../fixtures/default-battle-state";
import { applyCardEffects, defaultTalentEffects } from "@/lib/battle";
import type { CombatTextEvent } from "@/lib/battle/types";

describe("Burn Stun Chance / Direct status threshold resolution", () => {
  it("resolves and triggers stun when stun is added from burn damage riders", () => {
    const talentEffects = {
      ...defaultTalentEffects,
      burnStunChance: 100,
    };

    const card = makeTestCard({
      id: "fireball",
      effects: [{ kind: "damage", damageType: "burn", amount: 12 }],
    });

    const state = makeState({
      mana: 10,
      enemyHealth: 20,
      enemyMaxHealth: 20,
      talentEffects,
      hand: [card],
      rng: () => 0.5,
    });

    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);

    expect(result.enemyStatuses.stun).toBe(0);
    expect(result.enemyCC.stunSkipTurns).toBe(1);
    expect(result.enemyCC.cooldown).toBe(0);
    expect(texts).toContainEqual({
      target: "enemy",
      kind: "notice",
      stat: "stun",
      text: "Stunned",
    });
  });

  it("resolves and triggers stun when stun status is applied directly via enemy-status effect", () => {
    const card = makeTestCard({
      id: "apply-stun",
      effects: [{ kind: "enemy-status", status: "stun", amount: 11 }],
    });

    const state = makeState({
      mana: 10,
      enemyHealth: 20,
      enemyMaxHealth: 20,
      hand: [card],
    });

    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);

    expect(result.enemyStatuses.stun).toBe(0);
    expect(result.enemyCC.stunSkipTurns).toBe(1);
    expect(texts).toContainEqual({
      target: "enemy",
      kind: "notice",
      stat: "stun",
      text: "Stunned",
    });
  });

  it("resolves and triggers freeze when freeze status is doubled via multiply-enemy-status effect", () => {
    const card = makeTestCard({
      id: "double-freeze",
      effects: [{ kind: "multiply-enemy-status", status: "freeze", factor: 2 }],
    });

    const state = makeState({
      mana: 10,
      enemyHealth: 20,
      enemyMaxHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ freeze: 6 }),
      hand: [card],
    });

    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);

    expect(result.enemyStatuses.freeze).toBe(0);
    expect(result.enemyCC.freezeSkipTurns).toBe(1);
    expect(texts).toContainEqual({
      target: "enemy",
      kind: "notice",
      stat: "freeze",
      text: "Frozen",
    });
  });
});
