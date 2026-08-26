import { describe, expect, it } from "vitest";
import { getBattleCardPlayTarget } from "@/lib/battle";
import { makeTestCard } from "../../fixtures/battle";

describe("getBattleCardPlayTarget", () => {
  it('returns "enemy" for damage cards', () => {
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    expect(getBattleCardPlayTarget(card)).toBe("enemy");
  });

  it('returns "enemy" for enemy-status cards', () => {
    const card = makeTestCard({ effects: [{ kind: "enemy-status", status: "burn", amount: 3 }] });
    expect(getBattleCardPlayTarget(card)).toBe("enemy");
  });

  it('returns "player" for player-status cards', () => {
    const card = makeTestCard({ effects: [{ kind: "player-status", status: "block", amount: 5 }] });
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });

  it('returns "player" for heal cards', () => {
    const card = makeTestCard({ effects: [{ kind: "heal", amount: 5 }] });
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });

  it('returns "player" for restore-mana cards', () => {
    const card = makeTestCard({ effects: [{ kind: "restore-mana", amount: 2 }] });
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });

  it('returns "player" for draw-cards cards', () => {
    const card = makeTestCard({ effects: [{ kind: "draw-cards", amount: 1 }] });
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });

  it('returns "player" for summon-companion cards', () => {
    const card = makeTestCard({ effects: [{ kind: "summon-companion", companionId: "wolf" }] });
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });

  it('returns "player" for wish cards', () => {
    const card = makeTestCard({ effects: [{ kind: "wish", amount: 1 }] });
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });

  it('returns "enemy" for damage even when preceded by wish/gold', () => {
    const card = makeTestCard({
      effects: [
        { kind: "damage", damageType: "physical", amount: 5 },
        { kind: "gain-gold", amount: 5 },
      ],
    });
    expect(getBattleCardPlayTarget(card)).toBe("enemy");
  });

  it('returns "player" for player-status even when preceded by draw-cards', () => {
    const card = makeTestCard({
      effects: [
        { kind: "draw-cards", amount: 1 },
        { kind: "player-status", status: "block", amount: 5 },
      ],
    });
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });

  it("aims chance-card VFX from the failure branch when success has no target", () => {
    const card = makeTestCard({
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [],
          failureEffects: [{ kind: "damage", damageType: "physical", amount: 3 }],
        },
      ],
    });
    expect(getBattleCardPlayTarget(card)).toBe("enemy");
  });
});
