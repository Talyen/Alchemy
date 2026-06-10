import { describe, expect, it } from "vitest";
import {
  getPlayerStatusChips,
  getEnemyStatusChips,
  getBattleCardPlayTarget,
  sampleItems,
  getCombatTextColorClass,
  getCombatTextIcon,
} from "@/features/alchemy/shared/utils";
import { createTestBattleState } from "../lib/battle/test-state";

describe("getPlayerStatusChips", () => {
  it("returns only statuses with positive values, in order", () => {
    const state = createTestBattleState({
      playerStatuses: { block: 5, forge: 2, burn: 3, armor: 0, haste: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    });
    const chips = getPlayerStatusChips(state);
    expect(chips).toEqual([{ id: "block", value: 5 }, { id: "forge", value: 2 }, { id: "burn", value: 3 }]);
  });

  it("returns empty array when no statuses", () => {
    expect(getPlayerStatusChips(createTestBattleState())).toEqual([]);
  });
});

describe("getEnemyStatusChips", () => {
  it("returns enemy statuses with positive values", () => {
    const state = createTestBattleState({
      enemyStatuses: { burn: 4, poison: 0, bleed: 0, freeze: 0, stun: 1 },
    });
    const chips = getEnemyStatusChips(state);
    expect(chips).toEqual([{ id: "burn", value: 4 }, { id: "stun", value: 1 }]);
  });
});

describe("getBattleCardPlayTarget", () => {
  function card(overrides = {}) {
    return { id: "c", title: "T", descriptionLines: [""], art: "", cost: 1, effects: [], ...overrides };
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

describe("getCombatTextColorClass", () => {
  it("returns red for health damage", () => {
    expect(getCombatTextColorClass({ target: "player", kind: "damage", stat: "health", amount: 5 })).toBe("text-red-400");
  });

  it("returns type color for damage by type", () => {
    expect(getCombatTextColorClass({ target: "enemy", kind: "damage", stat: "burn", amount: 5 })).toBe("text-orange-400");
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
