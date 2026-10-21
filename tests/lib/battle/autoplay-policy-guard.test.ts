import { describe, expect, it } from "vitest";
import {
  AUTOPLAY_EFFECT_SCORE,
  getEffectiveDamageScore,
  getImmediateDamage,
  getImmediateDefense,
  pickHighestScoring,
} from "@/lib/battle/autoplay-policy";
import { makeTestBattleState } from "../../fixtures/battle";
import { makeTestCard } from "../../fixtures/cards";

describe("autoplay policy", () => {
  it("scores equal-to-resource damage with applicable Forge", () => {
    const blockCard = makeTestCard({
      cost: 0,
      effects: [{ kind: "damage", damageType: "physical", amount: 0, equalToBlock: true }],
    });
    const armorCard = makeTestCard({
      cost: 0,
      effects: [{ kind: "damage", damageType: "physical", amount: 0, equalToArmor: true }],
    });
    const state = makeTestBattleState({ playerStatuses: { block: 7, armor: 5, forge: 3 } });
    // Live base is resource + Forge (physical converts Forge at full value).
    expect(getEffectiveDamageScore(blockCard, state)).toBe(10);
    expect(getEffectiveDamageScore(armorCard, state)).toBe(8);
  });

  it("counts equal-to-resource attacks in stateless heuristics and scores them live with state", () => {
    const blockCard = makeTestCard({
      cost: 0,
      effects: [{ kind: "damage", damageType: "stun", amount: 0, equalToBlock: true, equalToBlockPercent: 50 }],
    });
    // Draft and archetype heuristics have no snapshot: a zero-amount
    // equal-resource attack must still count as an attack.
    expect(getImmediateDamage(blockCard)).toBeGreaterThan(0);
    const state = makeTestBattleState({ playerStatuses: { block: 6, forge: 0 } });
    expect(getImmediateDamage(blockCard, state)).toBe(3);
    const forged = makeTestBattleState({ playerStatuses: { block: 6, forge: 4 } });
    expect(getImmediateDamage(blockCard, forged)).toBeGreaterThan(3);
  });

  it("chooses a refill only when it has usable Mana room and keeps hand order on equal scores", () => {
    const refill = makeTestCard({ cost: 0, effects: [{ kind: "restore-mana", amount: 2 }] });
    const draw = makeTestCard({ cost: 0, effects: [{ kind: "draw-cards", amount: 1 }] });
    const playable = [
      { card: refill, index: 3 },
      { card: draw, index: 5 },
    ];
    for (const [mana, chosen] of [
      [1, 3],
      [2, 3],
      [3, 5],
    ]) {
      const state = makeTestBattleState({ mana, maxMana: 3, deck: [makeTestCard()] });
      expect(pickHighestScoring(playable, (card) => getEffectiveDamageScore(card, state))?.index).toBe(chosen);
    }
  });

  it("counts queued draws and Mana spent by the card before scoring its refill", () => {
    const draw = makeTestCard({ id: "draw", cost: 1, effects: [{ kind: "draw-cards", amount: 3 }] });
    const refill = makeTestCard({ id: "refill", cost: 1, effects: [{ kind: "restore-mana", amount: 2 }] });
    const hand = [draw, refill, ...Array.from({ length: 5 }, (_, index) => makeTestCard({ id: `filler-${index}` }))];
    const state = makeTestBattleState({
      hand,
      mana: 3,
      maxMana: 3,
      deck: Array.from({ length: 3 }, (_, index) => makeTestCard({ id: `next-${index}` })),
    });
    expect(getEffectiveDamageScore(draw, state)).toBe(3 * AUTOPLAY_EFFECT_SCORE.draw);
    expect(getEffectiveDamageScore(refill, state)).toBe(AUTOPLAY_EFFECT_SCORE.mana);
  });

  it("keeps prepared Dodge effects from poisoning card and Wish selection with a nonnumeric score", () => {
    const card = makeTestCard({ cost: 0, effects: [{ kind: "dodge-next-attack" }, { kind: "draw-cards", amount: 1 }] });
    const state = makeTestBattleState({ deck: [makeTestCard()] });
    expect(getEffectiveDamageScore(card, state)).toBe(AUTOPLAY_EFFECT_SCORE.draw);
    const attack = makeTestCard({ cost: 0, effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });
    expect(
      pickHighestScoring(
        [
          { card: attack, index: 0 },
          { card, index: 2 },
        ],
        (candidate) => getEffectiveDamageScore(candidate, state),
      )?.index,
    ).toBe(2);
  });

  it("preserves nested chance defense, including resource conversion and capped healing", () => {
    const card = makeTestCard({
      effects: [
        { kind: "player-status", status: "block", amount: 2 },
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [
            { kind: "player-status", status: "block", amount: 0, convertCurrentMana: 2 },
            {
              kind: "chance",
              probability: 0.25,
              successEffects: [{ kind: "heal", amount: 20 }],
              failureEffects: [{ kind: "player-status", status: "armor", amount: 4 }],
            },
          ],
          failureEffects: [{ kind: "heal", amount: 5 }],
        },
      ],
    });
    const state = makeTestBattleState({ mana: 3, playerHealth: 99, playerMaxHealth: 100 });
    expect(getImmediateDefense(card, state)).toBe(7.125);
    expect(getImmediateDefense(card)).toBe(9.5);
  });
});
