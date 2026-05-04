import { describe, expect, it, vi } from "vitest";
import { getHoverId, getPlayerStatusChips, getEnemyStatusChips, getBattleCardPlayTarget, randomBetween, sampleItems, tokenizeDescription, getCombatTextColorClass, getCombatTextIcon } from "@/features/alchemy/utils";
import type { BattleState, CombatTextEvent } from "@/lib/battle/types";

function makeState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    deck: [], hand: [], discard: [], exhausted: [], mana: 0, maxMana: 0, gold: 0,
    turn: 1, turnPhase: "player", playerHealth: 30, enemyHealth: 30,
    enemyMaxHealth: 30, enemyAttack: 8,
    playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    enemyStatuses: { burn: 0, poison: 0, bleed: 0, bleedLeech: 0, freeze: 0, stun: 0 },
    enemySkipTurns: 0, wishOptions: null,
    currentEnemy: { id: "skeleton", title: "Skeleton", subtitle: "", descriptionLines: [""], art: "" },
    talentEffects: { flatPhysicalDamage: 0, armorToPhysicalDamage: false, physicalCritChance: 0 },
    ...overrides,
  };
}

describe("getHoverId", () => {
  it("combines scope and cardId", () => expect(getHoverId("hand", "card-1")).toBe("hand-card-1"));
});

describe("getPlayerStatusChips", () => {
  it("returns only statuses with positive values, in order", () => {
    const state = makeState({ playerStatuses: { block: 5, forge: 2, burn: 3, armor: 0, haste: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 } });
    const chips = getPlayerStatusChips(state);
    expect(chips).toEqual([{ id: "block", value: 5 }, { id: "forge", value: 2 }, { id: "burn", value: 3 }]);
  });

  it("returns empty array when no statuses", () => {
    expect(getPlayerStatusChips(makeState())).toEqual([]);
  });
});

describe("getEnemyStatusChips", () => {
  it("returns enemy statuses with positive values", () => {
    const state = makeState({ enemyStatuses: { burn: 4, poison: 0, bleed: 0, bleedLeech: 0, freeze: 0, stun: 1 } });
    const chips = getEnemyStatusChips(state);
    expect(chips).toEqual([{ id: "burn", value: 4 }, { id: "stun", value: 1 }]);
  });
});

describe("getBattleCardPlayTarget", () => {
  function card(overrides = {}) {
    return { id: "c", title: "T", descriptionLines: [""], art: "", cost: 1, template: "mechanical" as const, effects: [], ...overrides };
  }

  it("returns 'enemy' for damage cards", () => {
    expect(getBattleCardPlayTarget(card({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] }))).toBe("enemy");
  });

  it("returns 'player' for heal cards", () => {
    expect(getBattleCardPlayTarget(card({ effects: [{ kind: "heal", amount: 5 }] }))).toBe("player");
  });

  it("returns 'player' for status cards", () => {
    expect(getBattleCardPlayTarget(card({ effects: [{ kind: "player-status", status: "block", amount: 5 }] }))).toBe("player");
  });
});

describe("randomBetween", () => {
  it("returns a number within the range", () => {
    for (let i = 0; i < 100; i++) {
      const n = randomBetween(5, 10);
      expect(n).toBeGreaterThanOrEqual(5);
      expect(n).toBeLessThanOrEqual(10);
    }
  });
});

describe("sampleItems", () => {
  it("returns the requested count of items", () => {
    const items = [1, 2, 3, 4, 5];
    const result = sampleItems(items, 3);
    expect(result).toHaveLength(3);
  });

  it("returns all items if count exceeds array length", () => {
    expect(sampleItems([1, 2], 5)).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(sampleItems([], 3)).toEqual([]);
  });
});

describe("tokenizeDescription", () => {
  it("returns plain text when no keyword matches", () => {
    expect(tokenizeDescription("Deal 5 damage")).toEqual([{ text: "Deal 5 damage" }]);
  });

  it("highlights matched keywords with keywordId", () => {
    const result = tokenizeDescription("Deal 5 Physical damage");
    expect(result).toContainEqual({ text: "Physical", keywordId: "physical" });
  });

  it("handles multiple keyword matches", () => {
    const result = tokenizeDescription("Physical and Burn damage");
    const kwIds = result.filter((p) => "keywordId" in p).map((p) => (p as { keywordId: string }).keywordId);
    expect(kwIds).toContain("physical");
    expect(kwIds).toContain("burn");
  });
});

describe("getCombatTextColorClass", () => {
  it("returns red for health damage", () => {
    expect(getCombatTextColorClass({ target: "player", kind: "damage", stat: "health", amount: 5 })).toBe("text-red-400");
  });

  it("returns type color for damage by type", () => {
    expect(getCombatTextColorClass({ target: "enemy", kind: "damage", stat: "burn", amount: 5 })).toBe("text-orange-300");
  });

  it("returns green for heals", () => {
    expect(getCombatTextColorClass({ target: "player", kind: "heal", stat: "health", amount: 5 })).toBe("text-green-400");
  });
});

describe("getCombatTextIcon", () => {
  it("returns HeartPulse for heal", () => {
    const icon = getCombatTextIcon({ target: "player", kind: "heal", stat: "health", amount: 5 });
    expect(icon).toBeDefined();
  });

  it("returns the stat's icon for damage", () => {
    const icon = getCombatTextIcon({ target: "enemy", kind: "damage", stat: "burn", amount: 5 });
    expect(icon).toBeDefined();
  });
});
