import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";
import { cardById } from "@/lib/game-data";
import { makeStateWithFailedRolls, makeTestCard } from "../../fixtures/battle";

function corrupted(id: string, kind: string) {
  return getCorruptionMutationGroups(cardById[id]!).find((group) => group.kind === kind)!.mutations[0]!.card;
}

function play(id: string, kind: string) {
  const card = corrupted(id, kind);
  const state = makeStateWithFailedRolls({
    hand: [card],
    deck: [cardById.block!],
    playerHealth: 15,
    playerMaxHealth: 30,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    mana: 3,
    maxMana: 3,
  });
  return playBattleCardResolved(state, card.id, 0).state;
}

describe("corrupted effects in battle", () => {
  it("keeps Forge-scaled Burning Blade out of plain-damage bargains and conversions", () => {
    const card = cardById["burning-blade"]!;
    const groups = getCorruptionMutationGroups(card);
    expect(groups.map((group) => group.kind)).toEqual(["strengthen", "weaken", "secondary"]);
    const strengthened = groups.find((group) => group.kind === "strengthen")!.mutations[0]!.card;
    expect(strengthened.effects).toEqual([{ kind: "damage", damageType: "burn", amount: 2, forgeBonusPercent: 50 }]);
  });

  it("excludes secondary gifts already present inside chance and scheduled branches", () => {
    const card = makeTestCard({
      descriptionLines: ["Conditional aid"],
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "heal", amount: 1 }],
          failureEffects: [
            {
              kind: "repeat-over-turns",
              remainingTurns: 2,
              effects: [
                { kind: "player-status", status: "block", amount: 1 },
                { kind: "damage", damageType: "poison", amount: 1 },
              ],
            },
          ],
        },
      ],
    });
    const before = structuredClone(card);
    const secondary = getCorruptionMutationGroups(card).find((group) => group.kind === "secondary")!;
    expect(secondary.mutations.map(({ card }) => card.effects.at(-1))).toEqual([
      { kind: "damage", damageType: "burn", amount: 1 },
    ]);
    expect(card).toEqual(before);
  });

  it("uses stronger damage and the added Block", () => {
    expect(play("slash", "strengthen").enemyHealth).toBe(94);
    const next = play("slash", "secondary");
    expect(next.enemyHealth).toBe(96);
    expect(next.playerStatuses.block).toBe(2);
  });

  it("pays Health for increased Block", () => {
    const next = play("block", "bargain");
    expect(next.playerHealth).toBe(13);
    expect(next.playerStatuses.block).toBe(10);
  });

  it("draws a card and refunds Mana through the existing effect handlers", () => {
    const draw = play("slash", "draw");
    expect(draw.hand.map((card) => card.id)).toEqual(["block"]);
    expect(draw.mana).toBe(2);
    expect(play("heal", "mana").mana).toBe(3);
  });

  it("heals through added Leech", () => {
    expect(play("slash", "leech").playerHealth).toBe(17);
  });

  it("exhausts newly consumable cards and discards newly reusable ones", () => {
    const consumed = play("slash", "consume");
    expect(consumed.enemyHealth).toBe(88);
    expect(consumed.exhausted.map((card) => card.id)).toEqual(["slash"]);
    expect(consumed.discard).toEqual([]);
    const reusable = play("health-potion", "reusable");
    expect(reusable.playerHealth).toBe(23);
    expect(reusable.exhausted).toEqual([]);
    expect(reusable.discard.map((card) => card.id)).toEqual(["health-potion"]);
  });
});
