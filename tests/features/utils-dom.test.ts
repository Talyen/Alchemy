import { describe, expect, it } from "vitest";
import { getBattleCardPlayTarget, getCardRect } from "@/features/alchemy/utils/dom";
import type { BattleCard } from "@/lib/game-data";

function makeCard(effects: BattleCard["effects"]): BattleCard {
  return {
    id: "test",
    title: "Test",
    descriptionLines: [""],
    art: "",
    cost: 1,
    effects,
  };
}

describe("getBattleCardPlayTarget", () => {
  it('returns "enemy" for damage cards', () => {
    const card = makeCard([{ kind: "damage", damageType: "physical", amount: 5 }]);
    expect(getBattleCardPlayTarget(card)).toBe("enemy");
  });

  it('returns "player" for player-status cards', () => {
    const card = makeCard([{ kind: "player-status", status: "block", amount: 5 }]);
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });

  it('returns "player" for heal cards', () => {
    const card = makeCard([{ kind: "heal", amount: 5 }]);
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });

  it('returns "enemy" as default when no matching effect kind is found', () => {
    const card = makeCard([{ kind: "draw-cards", amount: 1 }]);
    expect(getBattleCardPlayTarget(card)).toBe("enemy");
  });

  it('returns "enemy" for damage even when preceded by other effects', () => {
    const card = makeCard([
      { kind: "gain-gold", amount: 5 },
      { kind: "damage", damageType: "physical", amount: 5 },
    ]);
    expect(getBattleCardPlayTarget(card)).toBe("enemy");
  });

  it('returns "player" for player-status even when preceded by draw-cards', () => {
    const card = makeCard([
      { kind: "draw-cards", amount: 1 },
      { kind: "player-status", status: "block", amount: 5 },
    ]);
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });
});

describe("getCardRect", () => {
  it("transforms a DOMRect to a CardRect", () => {
    const rect = { x: 10, y: 20, width: 100, height: 150, top: 20, right: 110, bottom: 170, left: 10, toJSON() {} } as DOMRect;
    const cardRect = getCardRect(rect);
    expect(cardRect).toEqual({ x: 10, y: 20, width: 100, height: 150 });
  });
});
