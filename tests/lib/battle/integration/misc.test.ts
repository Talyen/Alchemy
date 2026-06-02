import { describe, expect, it, vi } from "vitest";
import { makeState, makeCard } from "./helpers";

vi.spyOn(Math, "random").mockReturnValue(0.99);
import { applyCardEffects, defaultTalentEffects } from "@/lib/battle";
import { addEnemyStatus, clampHealth, type CombatTextEvent } from "@/lib/battle/types";
import { type DifficultyModifier } from "@/lib/game-data";
import { clamp } from "@/lib/utils";

describe("null-field in addEnemyStatus", () => {
  it("halves the delta when labyrinth-null-field modifier is present", () => {
    const state = makeState({ difficultyModifiers: [{ kind: "labyrinth-null-field" }] as DifficultyModifier[] });
    const result = addEnemyStatus(state, "burn", 10);
    expect(result.enemyStatuses.burn).toBe(5);
  });

  it("does not halve when modifier is absent", () => {
    const state = makeState();
    const result = addEnemyStatus(state, "burn", 10);
    expect(result.enemyStatuses.burn).toBe(10);
  });

  it("minimum value is 1 even for small deltas", () => {
    const state = makeState({ difficultyModifiers: [{ kind: "labyrinth-null-field" }] as DifficultyModifier[] });
    const result = addEnemyStatus(state, "poison", 1);
    expect(result.enemyStatuses.poison).toBe(1);
  });
});

describe("clamp / clampHealth", () => {
  it("clamps value between min and max", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("clampHealth adds positive delta clamped to max", () => {
    expect(clampHealth(20, 5, 30)).toBe(25);
    expect(clampHealth(28, 5, 30)).toBe(30);
  });

  it("clampHealth subtracts negative delta clamped to 0", () => {
    expect(clampHealth(10, -5, 30)).toBe(5);
    expect(clampHealth(3, -5, 30)).toBe(0);
  });
});

describe("forge burn in null field", () => {
  it("forge burn is halved when null field is active", () => {
    const card = makeCard({ effects: [{ kind: "player-status", status: "forge", amount: 1 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({
      playerStatuses: {
        block: 0, armor: 0, forge: 2, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0,
      },
      talentEffects: { ...defaultTalentEffects, forgeBurnThreshold: 3, forgeBurnDamage: 6 },
      difficultyModifiers: [{ kind: "labyrinth-null-field" }],
    });
    const result = applyCardEffects(state, card, texts);
    // forge: 2 → 3, crosses threshold, triggers forge burn
    // computeForgeBurnAmount halves: Math.round(6 / 2) = 3
    // addEnemyStatus via adjustEnemyStatusDelta halves again: Math.round(3 / 2) = 2
    expect(result.enemyStatuses.burn).toBe(2);
    expect(result.playerStatuses.forge).toBe(3);
  });
});


