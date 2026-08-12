import { describe, expect, it, vi } from "vitest";
import {
  applyCombatTextPortraitFeedback,
  shouldHurtEnemyFromCombatTexts,
  shouldHurtPlayerFromCombatTexts,
  shouldPlayCardGoldGain,
  shouldShakeEnemyFromCombatTexts,
  shouldShakePlayerFromCombatTexts,
} from "@/features/alchemy/run-loop/battle/battle-feedback";
import { makeTestCard, patchBattleState } from "../../../../fixtures/battle";

function makeState() {
  return patchBattleState();
}

describe("shouldPlayCardGoldGain", () => {
  it("returns true when gold increased and card is not steal", () => {
    const prev = makeState();
    prev.gold = 5;
    const next = makeState();
    next.gold = 8;
    expect(shouldPlayCardGoldGain(prev, next, makeTestCard({ id: "strike" }))).toBe(true);
  });

  it("returns false when gold unchanged", () => {
    const prev = makeState();
    prev.gold = 5;
    const next = makeState();
    next.gold = 5;
    expect(shouldPlayCardGoldGain(prev, next, makeTestCard())).toBe(false);
  });

  it("returns false when gold decreased", () => {
    const prev = makeState();
    prev.gold = 10;
    const next = makeState();
    next.gold = 5;
    expect(shouldPlayCardGoldGain(prev, next, makeTestCard())).toBe(false);
  });

  it("returns false for steal card even if gold increased", () => {
    const prev = makeState();
    prev.gold = 0;
    const next = makeState();
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

describe("shouldHurtPlayerFromCombatTexts", () => {
  it("returns true for player health damage", () => {
    expect(shouldHurtPlayerFromCombatTexts([{ target: "player", kind: "damage", stat: "health", amount: 5 }])).toBe(
      true,
    );
  });

  it("returns true for player burn damage", () => {
    expect(shouldHurtPlayerFromCombatTexts([{ target: "player", kind: "damage", stat: "burn", amount: 3 }])).toBe(true);
  });

  it("returns false for block absorb only", () => {
    expect(shouldHurtPlayerFromCombatTexts([{ target: "player", kind: "damage", stat: "block", amount: 5 }])).toBe(
      false,
    );
  });

  it("returns false for mana loss", () => {
    expect(shouldHurtPlayerFromCombatTexts([{ target: "player", kind: "damage", stat: "mana", amount: 2 }])).toBe(
      false,
    );
  });

  it("returns false for enemy damage only", () => {
    expect(shouldHurtPlayerFromCombatTexts([{ target: "enemy", kind: "damage", stat: "health", amount: 5 }])).toBe(
      false,
    );
  });

  it("returns false for empty array", () => {
    expect(shouldHurtPlayerFromCombatTexts([])).toBe(false);
  });
});

describe("shouldHurtEnemyFromCombatTexts", () => {
  it("returns true for enemy physical damage", () => {
    expect(shouldHurtEnemyFromCombatTexts([{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }])).toBe(
      true,
    );
  });

  it("returns false for enemy heal only", () => {
    expect(shouldHurtEnemyFromCombatTexts([{ target: "enemy", kind: "heal", stat: "health", amount: 5 }])).toBe(false);
  });

  it("returns false for player damage only", () => {
    expect(shouldHurtEnemyFromCombatTexts([{ target: "player", kind: "damage", stat: "health", amount: 5 }])).toBe(
      false,
    );
  });
});

describe("applyCombatTextPortraitFeedback", () => {
  it("triggers enemy hurt and shake for enemy damage texts", () => {
    const feedback = {
      shakeEnemy: vi.fn(),
      shakePlayer: vi.fn(),
      hurtEnemy: vi.fn(),
      hurtPlayer: vi.fn(),
    };
    applyCombatTextPortraitFeedback([{ target: "enemy", kind: "damage", stat: "burn", amount: 3 }], feedback);
    expect(feedback.shakeEnemy).toHaveBeenCalledOnce();
    expect(feedback.hurtEnemy).toHaveBeenCalledOnce();
    expect(feedback.shakePlayer).not.toHaveBeenCalled();
    expect(feedback.hurtPlayer).not.toHaveBeenCalled();
  });
});
