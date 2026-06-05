import { describe, expect, it } from "vitest";
import { canPlayCard, defaultBattleState } from "@/lib/battle";
import { makeTestBattleState, makeTestCard } from "../../fixtures/battle";

describe("balance simulator playability (canPlayCard contract)", () => {
  it("allows affordable cards on the player turn", () => {
    const card = makeTestCard({ id: "strike", cost: 2, effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    const state = makeTestBattleState({ mana: 3, hand: [card], turnPhase: "player" });
    expect(canPlayCard(state, card, 0)).toBe(true);
  });

  it("blocks play when mana is insufficient", () => {
    const card = makeTestCard({ cost: 5 });
    const state = makeTestBattleState({ mana: 2, hand: [card], turnPhase: "player" });
    expect(canPlayCard(state, card, 0)).toBe(false);
  });

  it("blocks play during enemy turn, wish selection, or after defeat", () => {
    const card = makeTestCard({ cost: 1 });
    const base = makeTestBattleState({ mana: 5, hand: [card] });
    expect(canPlayCard({ ...base, turnPhase: "enemy" }, card, 0)).toBe(false);
    expect(canPlayCard({ ...base, wishOptions: [card] }, card, 0)).toBe(false);
    expect(canPlayCard({ ...base, playerHealth: 0, deathsDoorActive: false }, card, 0)).toBe(false);
    expect(canPlayCard({ ...base, enemyHealth: 0 }, card, 0)).toBe(false);
  });

  it("requires hand index to match card id and uid", () => {
    const handCard = makeTestCard({ id: "a", uid: 1 });
    const otherCard = makeTestCard({ id: "b", uid: 2 });
    const state = makeTestBattleState({ mana: 5, hand: [handCard], turnPhase: "player" });
    expect(canPlayCard(state, handCard, 0)).toBe(true);
    expect(canPlayCard(state, otherCard, 0)).toBe(false);
  });

  it("matches defaultBattleState mana baseline used by headless sim", () => {
    const card = makeTestCard({ cost: 1 });
    const state = { ...defaultBattleState(), hand: [card], turnPhase: "player" as const, mana: 0 };
    expect(canPlayCard(state, card, 0)).toBe(false);
  });
});
