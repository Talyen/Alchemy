import { describe, expect, it } from "vitest";
import {
  AUTOPLAY_EFFECT_SCORE,
  getEffectiveDamageScore,
  getImmediateDamage,
  getImmediateDefense,
  pickHighestScoring,
} from "@/lib/battle/autoplay-policy";
import type { BattleCardEffect, DamageType } from "@/lib/game-data";
import { makeTestBattleState, type BattleStatePatch } from "../../fixtures/battle";
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

  // Independent expected values pin both draft estimates and live scores. Keep
  // resource scaling, rounding, conditional damage and pool averages visible here.
  const hit = (
    damageType: DamageType,
    amount: number,
    extra: Partial<Extract<BattleCardEffect, { kind: "damage" }>> = {},
  ): BattleCardEffect => ({ kind: "damage", damageType, amount, ...extra });
  it.each<[string, BattleCardEffect, BattleStatePatch, number, number]>([
    ["odd random range", { kind: "random-damage", minAmount: 1, maxAmount: 4 }, {}, 2.5, 2.5],
    ["even random range", { kind: "random-damage", minAmount: 2, maxAmount: 4 }, {}, 3, 3],
    [
      "random pool Forge",
      { kind: "random-damage", minAmount: 2, maxAmount: 4, damageTypePool: ["physical", "nature"] },
      { playerStatuses: { forge: 4 } },
      3,
      5,
    ],
    [
      "damage pool Forge",
      hit("poison", 2, { damageTypePool: ["poison", "physical"] }),
      { playerStatuses: { forge: 4 } },
      2,
      4,
    ],
    ["Burn against Burning", hit("burn", 7, { tripleIfEnemyNotBurning: true }), { enemyStatuses: { burn: 1 } }, 7, 7],
    ["Burn against unburned", hit("burn", 7, { tripleIfEnemyNotBurning: true }), {}, 7, 21],
    ["Bleed against unbleeding", hit("bleed", 5, { doubleIfEnemyBleeding: true }), {}, 5, 5],
    [
      "Bleed against Bleeding",
      hit("bleed", 5, { doubleIfEnemyBleeding: true }),
      { enemyStatuses: { bleed: 2 } },
      5,
      10,
    ],
    ["ordinary hit", hit("physical", 5), {}, 5, 5],
    ["ordinary Forge", hit("physical", 5), { playerStatuses: { forge: 3 } }, 5, 8],
    ["Burn detonation", hit("burn", 1, { detonateAllBurn: true }), { enemyStatuses: { burn: 8 } }, 1, 9],
    ["Bleed detonation", hit("bleed", 2, { detonateAllBleed: true }), { enemyStatuses: { bleed: 6 } }, 2, 8],
    ["empty cleanse damage", { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy" }, {}, 1, 0],
    [
      "stored cleanse damage",
      { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy" },
      { playerStatuses: { burn: 5 } },
      1,
      5,
    ],
    ["empty Forge scaling", hit("physical", 0, { forgeBonusPercent: 50 }), {}, 1, 0],
  ])("preserves %s damage in drafting, immediate estimates and autoplay", (_name, effect, patch, nominal, live) => {
    const card = makeTestCard({ cost: 0, effects: [effect] });
    const state = makeTestBattleState(patch);
    expect(getImmediateDamage(card)).toBe(nominal);
    expect(getImmediateDamage(card, state)).toBe(live);
    expect(getEffectiveDamageScore(card, state)).toBe(live);
  });

  it.each<[string, BattleCardEffect, BattleStatePatch, number, number, number]>([
    [
      "empty Mana conversion",
      { kind: "player-status", status: "block", amount: 0, convertCurrentMana: 2 },
      { mana: 0 },
      2,
      0,
      0,
    ],
    [
      "funded Mana conversion",
      { kind: "player-status", status: "block", amount: 0, convertCurrentMana: 2 },
      { mana: 3 },
      2,
      6,
      3,
    ],
    ["empty targeted cleanse", { kind: "remove-player-status", status: "burn" }, {}, 3, 0, 0],
    ["targeted cleanse", { kind: "remove-player-status", status: "burn" }, { playerStatuses: { burn: 2 } }, 3, 3, 3],
    ["empty fixed cleanse", { kind: "remove-harmful-status", amount: 1 }, {}, 3, 0, 0],
    ["empty full cleanse", { kind: "remove-harmful-status", removeAll: true }, {}, 3, 0, 0],
    [
      "fixed cleanse",
      { kind: "remove-harmful-status", amount: 1 },
      { playerStatuses: { burn: 5, poison: 3, bleed: 2 } },
      3,
      3,
      3,
    ],
    [
      "full cleanse",
      { kind: "remove-harmful-status", removeAll: true },
      { playerStatuses: { burn: 5, poison: 3, bleed: 2 } },
      3,
      9,
      9,
    ],
    [
      "empty cleanse damage",
      { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy" },
      {},
      3,
      0,
      0,
    ],
    [
      "stored cleanse damage",
      { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy" },
      { playerStatuses: { burn: 4 } },
      3,
      3,
      4,
    ],
  ])(
    "preserves %s defense without confusing it with the autoplay score",
    (_name, effect, patch, nominal, live, score) => {
      const card = makeTestCard({ cost: 0, effects: [effect] });
      const state = makeTestBattleState(patch);
      expect(getImmediateDefense(card)).toBe(nominal);
      expect(getImmediateDefense(card, state)).toBe(live);
      expect(getEffectiveDamageScore(card, state)).toBe(score);
    },
  );

  it("includes scheduled effects in draft estimates while immediate live estimates exclude them", () => {
    const card = makeTestCard({
      effects: [
        {
          kind: "repeat-over-turns",
          remainingTurns: 3,
          effects: [hit("physical", 6), { kind: "player-status", status: "block", amount: 4 }],
        },
      ],
    });
    expect(getImmediateDamage(card)).toBe(18);
    expect(getImmediateDefense(card)).toBe(12);
    expect(getImmediateDamage(card, makeTestBattleState())).toBe(0);
    expect(getImmediateDefense(card, makeTestBattleState())).toBe(0);
    const chance = makeTestCard({
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [hit("physical", 6)],
          failureEffects: [hit("physical", 2)],
        },
      ],
    });
    expect(getImmediateDamage(chance)).toBe(4);
    expect(getImmediateDamage(chance, makeTestBattleState())).toBe(4);
  });
});
