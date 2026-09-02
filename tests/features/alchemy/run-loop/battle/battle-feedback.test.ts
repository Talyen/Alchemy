import { describe, expect, it, vi } from "vitest";
import {
  applyCombatTextShakeFeedback,
  shouldPlayCardGoldGain,
  shouldShakeEnemyFromCombatTexts,
  shouldShakePlayerFromCombatTexts,
} from "@/features/alchemy/run-loop/battle/battle-status";
import { makeTestCard, patchBattleState } from "../../../../fixtures/battle";

describe("shouldPlayCardGoldGain", () => {
  it("returns true when gold increased and card is not steal", () => {
    const prev = patchBattleState();
    prev.gold = 5;
    const next = patchBattleState();
    next.gold = 8;
    expect(shouldPlayCardGoldGain(prev, next, makeTestCard({ id: "strike" }))).toBe(true);
  });

  it("returns false when gold unchanged", () => {
    const prev = patchBattleState();
    prev.gold = 5;
    const next = patchBattleState();
    next.gold = 5;
    expect(shouldPlayCardGoldGain(prev, next, makeTestCard())).toBe(false);
  });

  it("returns false when gold decreased", () => {
    const prev = patchBattleState();
    prev.gold = 10;
    const next = patchBattleState();
    next.gold = 5;
    expect(shouldPlayCardGoldGain(prev, next, makeTestCard())).toBe(false);
  });

  it("returns false for steal card even if gold increased", () => {
    const prev = patchBattleState();
    prev.gold = 0;
    const next = patchBattleState();
    next.gold = 10;
    expect(shouldPlayCardGoldGain(prev, next, makeTestCard({ id: "steal" }))).toBe(false);
  });
});

describe("shouldShakeEnemyFromCombatTexts", () => {
  it("returns true when any combat text damages enemy", () => {
    expect(shouldShakeEnemyFromCombatTexts([{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }])).toBe(
      true,
    );
  });

  it("returns false when no enemy damage events", () => {
    expect(shouldShakeEnemyFromCombatTexts([{ target: "player", kind: "damage", stat: "physical", amount: 5 }])).toBe(
      false,
    );
  });

  it("returns false for player status events only", () => {
    expect(shouldShakeEnemyFromCombatTexts([{ target: "player", kind: "status", stat: "block", amount: 5 }])).toBe(
      false,
    );
  });

  it("returns false for empty array", () => {
    expect(shouldShakeEnemyFromCombatTexts([])).toBe(false);
  });
});

describe("shouldShakePlayerFromCombatTexts", () => {
  it("returns true when any combat text damages player", () => {
    expect(shouldShakePlayerFromCombatTexts([{ target: "player", kind: "damage", stat: "physical", amount: 5 }])).toBe(
      true,
    );
  });

  it("returns false when no player damage events", () => {
    expect(shouldShakePlayerFromCombatTexts([{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }])).toBe(
      false,
    );
  });

  it("returns false for player heal events only", () => {
    expect(shouldShakePlayerFromCombatTexts([{ target: "player", kind: "heal", stat: "health", amount: 5 }])).toBe(
      false,
    );
  });

  it("returns true for player burn damage", () => {
    expect(shouldShakePlayerFromCombatTexts([{ target: "player", kind: "damage", stat: "burn", amount: 3 }])).toBe(
      true,
    );
  });

  it("returns false for empty array", () => {
    expect(shouldShakePlayerFromCombatTexts([])).toBe(false);
  });
});

describe("applyCombatTextShakeFeedback", () => {
  it("triggers only the damaged target's shake", () => {
    const feedback = {
      shakeEnemy: vi.fn(),
      shakePlayer: vi.fn(),
    };
    applyCombatTextShakeFeedback([{ target: "enemy", kind: "damage", stat: "burn", amount: 3 }], feedback);
    expect(feedback.shakeEnemy).toHaveBeenCalledOnce();
    expect(feedback.shakePlayer).not.toHaveBeenCalled();
  });
});
