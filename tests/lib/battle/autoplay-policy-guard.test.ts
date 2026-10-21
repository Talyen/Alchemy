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

  it("scores random damage at its exact average instead of rounding odd ranges up", () => {
    const odd = makeTestCard({
      cost: 0,
      effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 4 }],
    });
    const even = makeTestCard({
      cost: 0,
      effects: [{ kind: "random-damage", minAmount: 2, maxAmount: 4 }],
    });
    const state = makeTestBattleState();
    // True uniform expectation is 2.5; rounding would inflate Gambler's Shot-style cards to 3.
    // Reaction scoring uses the same exact average so autoplay and the simulator agree.
    expect(getImmediateDamage(odd, state)).toBe(2.5);
    expect(getEffectiveDamageScore(odd, state)).toBe(2.5);
    expect(getEffectiveDamageScore(even, state)).toBe(3);
  });

  it("scores conditional double and triple damage live when a snapshot is available", () => {
    const burnCard = makeTestCard({
      cost: 0,
      effects: [{ kind: "damage", damageType: "burn", amount: 7, tripleIfEnemyNotBurning: true }],
    });
    const bleedCard = makeTestCard({
      cost: 0,
      effects: [{ kind: "damage", damageType: "bleed", amount: 5, doubleIfEnemyBleeding: true }],
    });
    // Stateless draft heuristics cannot see enemy statuses, so they stay nominal.
    expect(getImmediateDamage(burnCard)).toBe(7);
    expect(getImmediateDamage(bleedCard)).toBe(5);
    expect(getImmediateDamage(burnCard, makeTestBattleState({ enemyStatuses: { burn: 1 } }))).toBe(7);
    expect(getImmediateDamage(burnCard, makeTestBattleState({ enemyStatuses: { burn: 0 } }))).toBe(21);
    expect(getImmediateDamage(bleedCard, makeTestBattleState({ enemyStatuses: { bleed: 0 } }))).toBe(5);
    expect(getImmediateDamage(bleedCard, makeTestBattleState({ enemyStatuses: { bleed: 2 } }))).toBe(10);
  });

  it("scores ordinary damage with the usual Forge bonus like the live base pipeline", () => {
    const strike = makeTestCard({
      cost: 0,
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    // Stateless heuristics stay nominal; physical converts Forge at full value with state.
    expect(getImmediateDamage(strike)).toBe(5);
    expect(getImmediateDamage(strike, makeTestBattleState({ playerStatuses: { forge: 0 } }))).toBe(5);
    expect(getImmediateDamage(strike, makeTestBattleState({ playerStatuses: { forge: 3 } }))).toBe(8);
    expect(getEffectiveDamageScore(strike, makeTestBattleState({ playerStatuses: { forge: 3 } }))).toBe(8);
  });

  it("rounds multiply-enemy-status scoring like the live pipeline", () => {
    const multiply = makeTestCard({
      cost: 0,
      effects: [{ kind: "multiply-enemy-status", status: "burn", factor: 2 }],
    });
    const state = makeTestBattleState({ enemyStatuses: { burn: 3 } });
    // Live adds Math.round(current * (factor - 1)); integer factors stay exact.
    expect(getEffectiveDamageScore(multiply, state)).toBe(3);
    const fractional = makeTestCard({
      cost: 0,
      effects: [{ kind: "multiply-enemy-status", status: "burn", factor: 1.5 as unknown as 2 }],
    });
    // (1.5 - 1) * 3 = 1.5 rounds to 2, matching addEnemyStatus.
    expect(getEffectiveDamageScore(fractional, state)).toBe(2);
  });

  it("treats a mana-conversion guard as non-defensive without current Mana", () => {
    const convert = makeTestCard({
      cost: 0,
      effects: [{ kind: "player-status", status: "block", amount: 0, convertCurrentMana: 2 }],
    });
    // Stateless draft heuristics use the authored factor; live defense needs actual Mana.
    expect(getImmediateDefense(convert)).toBeGreaterThan(0);
    expect(getImmediateDefense(convert, makeTestBattleState({ mana: 0 }))).toBe(0);
    expect(getImmediateDefense(convert, makeTestBattleState({ mana: 3 }))).toBeGreaterThan(0);
  });

  it("scores random damage with expected Forge bonus when a snapshot is available", () => {
    const randomAttack = makeTestCard({
      cost: 0,
      effects: [{ kind: "random-damage", minAmount: 2, maxAmount: 4, damageTypePool: ["physical", "nature"] }],
    });
    // Stateless uses the nominal average (3); with 4 Forge, physical gets +4 while nature gets 0, so average is +2.
    expect(getImmediateDamage(randomAttack)).toBe(3);
    const forged = makeTestBattleState({ playerStatuses: { forge: 4 } });
    expect(getImmediateDamage(randomAttack, forged)).toBe(5);
    expect(getEffectiveDamageScore(randomAttack, forged)).toBe(5);
  });

  it("scores cleanse-player-status-to-damage nominally in draft and with status and Forge live", () => {
    const purifyingFlame = makeTestCard({
      cost: 0,
      effects: [{ kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy" }],
    });
    // Draft heuristics count it nominally as 1; live scores the cleansed stacks.
    expect(getImmediateDamage(purifyingFlame)).toBe(1);
    expect(getImmediateDamage(purifyingFlame, makeTestBattleState({ playerStatuses: { burn: 0 } }))).toBe(0);
    expect(getImmediateDamage(purifyingFlame, makeTestBattleState({ playerStatuses: { burn: 5 } }))).toBe(5);
    expect(getEffectiveDamageScore(purifyingFlame, makeTestBattleState({ playerStatuses: { burn: 5 } }))).toBe(5);
  });

  it("scores nested chance and repeat-over-turns in immediate damage and defense", () => {
    const chanceAttack = makeTestCard({
      cost: 0,
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "damage", damageType: "physical", amount: 6 }],
          failureEffects: [{ kind: "damage", damageType: "physical", amount: 2 }],
        },
      ],
    });
    expect(getImmediateDamage(chanceAttack)).toBe(4);

    const repeatDefense = makeTestCard({
      cost: 0,
      effects: [
        {
          kind: "repeat-over-turns",
          remainingTurns: 3,
          effects: [{ kind: "player-status", status: "block", amount: 4 }],
        },
      ],
    });
    expect(getImmediateDefense(repeatDefense)).toBe(12);
  });

  it("scores 0-amount Forge-scaling attacks nominally in stateless draft heuristics", () => {
    const forgeAttack = makeTestCard({
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 0, forgeBonusPercent: 50 }],
    });
    expect(getImmediateDamage(forgeAttack)).toBe(1);
  });

  it("scores cleanse-player-status-to-damage as defense when status is present", () => {
    const purifyingFlame = makeTestCard({
      cost: 0,
      effects: [{ kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy" }],
    });
    // Stateless counts nominally; live counts if and only if harmful burn stacks are present
    expect(getImmediateDefense(purifyingFlame)).toBeGreaterThan(0);
    expect(getImmediateDefense(purifyingFlame, makeTestBattleState({ playerStatuses: { burn: 0 } }))).toBe(0);
    expect(getImmediateDefense(purifyingFlame, makeTestBattleState({ playerStatuses: { burn: 4 } }))).toBeGreaterThan(
      0,
    );
  });
});
