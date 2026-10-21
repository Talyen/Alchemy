import { describe, expect, it, vi } from "vitest";
import { patchBattleState, makeTestCard } from "../../fixtures/battle";
import { resolvePlayerHit } from "@/lib/battle/hit-resolution";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import type { BattleCardEffect } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle/types";
import { damageOnlyEffects } from "@/lib/battle/card-classification";
import { processArcheryEchoes } from "@/lib/battle/unique-card-effects";

it("Wardbreaker spends its use only on a benefit, purges in order, and resets next turn", () => {
  const empty = patchBattleState({ gearEffects: { attackPurgeOncePerTurn: 1 } });
  expect(resolvePlayerHit(empty, { source: "attack-purge" }, []).uniqueGear.wardbreakerPurgeUsed).toBe(false);
  const initial = patchBattleState({
    enemyHealth: 100,
    enemyMaxHealth: 100,
    enemyMitigation: { armor: 10, block: 15, forge: 5 },
    enemyStatuses: { thorns: 3, burnBonus: 2, freezeBonus: 1, poison: 4 },
    gearEffects: { attackPurgeOncePerTurn: 1 },
  });
  let state = initial;
  for (const stat of ["armor", "block", "forge", "thorns", "burnBonus", "freezeBonus"] as const) {
    const texts: CombatTextEvent[] = [];
    const purged = resolvePlayerHit(state, { source: "attack-purge" }, texts);
    expect({ ...purged.enemyMitigation, ...purged.enemyStatuses }[stat]).toBe(0);
    expect(purged.enemyHealth).toBe(100);
    expect(purged.enemyStatuses.poison).toBe(4);
    expect(texts).toEqual([expect.objectContaining({ target: "enemy", stat, signal: "purge" })]);
    expect(resolvePlayerHit(purged, { source: "attack-purge" }, [])).toBe(purged);
    state = advanceToPlayerTurn(purged);
  }
  expect(state.enemyMitigation).toEqual({ armor: 0, block: 0, forge: 0 });
  expect(state.enemyStatuses).toMatchObject({ thorns: 0, burnBonus: 0, freezeBonus: 0, poison: 4 });
  expect(initial.enemyMitigation.armor).toBe(10);
});

it.each([34, 35])("Blackfletch checks its strict Health cutoff after the arrow (%i starting Health)", (health) => {
  const card = makeTestCard({ tags: ["archery"], effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
  const state = patchBattleState({
    hand: [card],
    enemyHealth: health,
    enemyMaxHealth: 100,
    enemyStatuses: { bleed: 15, poison: 10 },
    gearEffects: { archeryDetonateBleedPoison: 1 },
    rng: () => 0.99,
  });
  const result = playBattleCardResolved(state, card.id, 0).state;
  expect(result.enemyHealth).toBe(health === 34 ? 0 : 30);
  expect(result.enemyStatuses).toMatchObject({ bleed: health === 34 ? 0 : 15, poison: health === 34 ? 0 : 10 });
});

it.each([100, 2])(
  "Saintfall heals after each depletion only while combat continues (%i enemy Health)",
  (enemyHealth) => {
    let state = patchBattleState({
      playerHealth: 50,
      playerMaxHealth: 100,
      enemyHealth,
      enemyMaxHealth: 100,
      playerStatuses: { block: 5 },
      gearEffects: { saintfallRetribution: 4 },
    });
    for (let depletion = 1; depletion <= 2; depletion++) {
      state = processEnemyDamageEffect(
        { ...state, playerStatuses: { ...state.playerStatuses, block: 5 } },
        { kind: "damage", damageType: "physical", amount: 15 },
        [],
      );
      expect(state.playerStatuses.block).toBe(0);
      expect(state.enemyStatuses.stun).toBe(0);
      expect(state.playerHealth).toBe(enemyHealth === 2 ? 40 : 50 - 6 * depletion);
      if (enemyHealth === 2) {
        expect(state.enemyHealth).toBe(0);
        break;
      }
    }
  },
);

it.each([
  { roll: 0.1, expected: "freeze-second" },
  { roll: 0.9, expected: "burn-second" },
])("Twin Casting preserves mixed-card selection with roll $roll", ({ roll, expected }) => {
  const rng = vi.fn().mockReturnValueOnce(roll).mockReturnValueOnce(0.9);
  const card = makeTestCard({ id: "mixed", cost: 0, tags: ["burn", "freeze"], effects: [] });
  const deck = ["freeze-first", "burn-first", "freeze-second", "burn-second"].map((id) =>
    makeTestCard({ id, tags: [id.startsWith("burn") ? "burn" : "freeze"], effects: [] }),
  );
  const state = patchBattleState({
    hand: [card],
    deck,
    nextCardUid: 100,
    gearEffects: { elementalTwinCasting: 1 },
    rng,
  });
  const result = playBattleCardResolved(state, card.id, 0).state;
  expect(result.hand.map(({ id, uid }) => ({ id, uid }))).toEqual([{ id: expected, uid: 100 }]);
  expect(result.deck).toEqual(deck.filter(({ id }) => id !== expected));
  expect(result.nextCardUid).toBe(101);
  expect(rng).toHaveBeenCalledTimes(2);
  expect(state.deck).toEqual(deck);
});

it.each([
  [0, "freeze"],
  [0.4, "burn"],
  [0.9, "holy"],
] as const)("plays exactly the pooled damage type selected by roll %s", (roll, damageType) => {
  const card = makeTestCard({
    effects: [{ kind: "damage", damageType: "holy", damageTypePool: ["freeze", "burn", "holy"], amount: 4 }],
  });
  let calls = 0;
  const state = patchBattleState({ hand: [card], rng: () => (calls++ === 0 ? roll : 0.99) });
  const result = playBattleCardResolved(state, card.id, 0);
  expect(result.state.enemyHealth).toBe(state.enemyHealth - 4);
  expect(result.combatTexts.filter((event) => event.kind === "damage" && event.target === "enemy")).toEqual([
    expect.objectContaining({ stat: damageType, amount: 4 }),
  ]);
  expect(result.state.enemyStatuses).toMatchObject({
    freeze: damageType === "freeze" ? 4 : 0,
    burn: damageType === "burn" ? 4 : 0,
  });
});

describe("damageOnlyEffects", () => {
  it("keeps damage order and chance branches while leaving the source tree untouched", () => {
    const damage: BattleCardEffect = { kind: "damage", damageType: "physical", amount: 3 };
    const chance: BattleCardEffect = {
      kind: "chance",
      probability: 0.5,
      successEffects: [{ kind: "heal", amount: 2 }, damage],
      failureEffects: [{ kind: "draw-cards", amount: 1 }],
    };
    const source: BattleCardEffect[] = [damage, { kind: "heal", amount: 1 }, chance, damage];
    const before = structuredClone(source);
    const filtered = damageOnlyEffects(source);
    expect(filtered).toEqual([damage, { ...chance, successEffects: [damage], failureEffects: [] }, damage]);
    expect(source).toEqual(before);
    expect(filtered[1]).not.toBe(chance);
  });

  it("preserves nested scheduled damage and drops empty wrappers without repeating support effects", () => {
    const damage: BattleCardEffect = { kind: "random-damage", minAmount: 1, maxAmount: 3, damageTypePool: ["burn"] };
    const support: BattleCardEffect = { kind: "draw-cards", amount: 1 };
    const source: BattleCardEffect[] = [
      { kind: "repeat-over-turns", remainingTurns: 2, effects: [support] },
      {
        kind: "repeat-over-turns",
        remainingTurns: 3,
        effects: [{ kind: "chance", probability: 0.2, successEffects: [support], failureEffects: [damage, support] }],
      },
    ];
    const before = structuredClone(source);
    expect(damageOnlyEffects(source)).toEqual([
      {
        kind: "repeat-over-turns",
        remainingTurns: 3,
        effects: [{ kind: "chance", probability: 0.2, successEffects: [], failureEffects: [damage] }],
      },
    ]);
    expect(source).toEqual(before);
  });

  it("retains cleanse-player-status-to-damage as a recognized damage effect", () => {
    const cleanseDamage: BattleCardEffect = {
      kind: "cleanse-player-status-to-damage",
      status: "burn",
      damageType: "holy",
    };
    const support: BattleCardEffect = { kind: "draw-cards", amount: 1 };
    expect(damageOnlyEffects([support, cleanseDamage])).toEqual([cleanseDamage]);
  });
});

it("processArcheryEchoes clears queued echoes even when the echo gear is disabled", () => {
  const echo = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4 }] });
  const state = patchBattleState({
    enemyHealth: 40,
    uniqueGear: { archeryEchoes: [echo] },
    gearEffects: { archeryEchoNextTurn: 0 },
  });
  const result = processArcheryEchoes(state, []);
  expect(result.uniqueGear.archeryEchoes).toEqual([]);
  expect(result.enemyHealth).toBe(40);
});
