import { expect, it, vi } from "vitest";
import { makeEffect, patchBattleState, makeTestCard, type BattleStatePatch } from "../../fixtures/battle";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { applyDamageStatuses } from "@/lib/battle/damage-status-riders";
import { resolvePlayerHit } from "@/lib/battle/hit-resolution";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import type { BattleCardEffect } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle/types";
import { damageOnlyEffects } from "@/lib/battle/card-classification";
import { processArcheryEchoes } from "@/lib/battle/unique-card-effects";

function battle(patch: BattleStatePatch = {}) {
  return patchBattleState({ enemyHealth: 100, enemyMaxHealth: 100, rng: () => 0.99, ...patch });
}

it("Wardbreaker purges one category per turn in priority order and preserves harmful statuses", () => {
  let state = battle({
    enemyMitigation: { armor: 4, block: 5, forge: 2 },
    enemyStatuses: { thorns: 3, burnBonus: 2, freezeBonus: 1, poison: 4 },
    gearEffects: { attackPurgeOncePerTurn: 1 },
  });
  for (const stat of ["armor", "block", "forge", "thorns", "burnBonus", "freezeBonus"] as const) {
    const texts: CombatTextEvent[] = [];
    const purged = resolvePlayerHit(state, { source: "attack-purge" }, texts);
    expect({ ...purged.enemyMitigation, ...purged.enemyStatuses }[stat]).toBe(0);
    expect(purged.enemyHealth).toBe(100);
    expect(purged.enemyStatuses.poison).toBe(4);
    expect(purged.uniqueGear.wardbreakerPurgeUsed).toBe(true);
    expect(texts).toContainEqual(expect.objectContaining({ target: "enemy", stat, signal: "purge" }));
    expect(resolvePlayerHit(purged, { source: "attack-purge" }, [])).toEqual(purged);
    state = advanceToPlayerTurn(purged);
  }
  const empty = resolvePlayerHit(state, { source: "attack-purge" }, []);
  expect(empty.uniqueGear.wardbreakerPurgeUsed).toBe(false);
  const shielded = { ...empty, enemyMitigation: { ...empty.enemyMitigation, block: 4 } };
  expect(resolvePlayerHit(shielded, { source: "attack-purge" }, []).enemyMitigation.block).toBe(0);
});

it("Wardbreaker purges on a played attack without bypassing its mitigation or adding Holy damage", () => {
  const card = makeTestCard({ effects: [makeEffect("physical", 10)] });
  const state = battle({ hand: [card], enemyMitigation: { armor: 4 }, gearEffects: { attackPurgeOncePerTurn: 1 } });
  const result = playBattleCardResolved(state, card.id, 0);
  expect(result.state.enemyMitigation.armor).toBe(0);
  expect(result.state.enemyHealth).toBe(94);
  expect(state.enemyMitigation.armor).toBe(4);
});

it("Golden Verdict rewards a Stun completed by Holy damage, not ordinary Stun", () => {
  const state = battle({ gold: 10, enemyStatuses: { stun: 60 }, gearEffects: { holyStunBuildupGold: 25 } });
  expect(resolveStunTrigger(state, []).gold).toBe(10);
  const ready = { ...state, enemyStatuses: { ...state.enemyStatuses, stun: 40 } };
  const result = applyDamageStatuses(ready, makeEffect("holy", 15), 15, []);
  expect(result.enemyStatuses.stun).toBe(0);
  expect(result.gold).toBe(35);
});

it("Bloodfire mirrors Burn once and leeches only when both statuses preceded the hit", () => {
  const state = battle({
    playerHealth: 50,
    playerMaxHealth: 100,
    rng: () => 0.05,
    gearEffects: { burnBleedMirrorAndLeech: 1 },
  });
  const first = applyDamageStatuses(state, makeEffect("burn", 20), 20, []);
  expect(first.enemyStatuses).toMatchObject({ burn: 20, bleed: 20 });
  expect(first.playerHealth).toBe(50);
  expect(applyDamageStatuses(first, makeEffect("burn", 20), 20, []).playerHealth).toBe(60);
});

it("Rimeheart grants Block from the first Freeze hit and restores Mana on successful Freeze", () => {
  const state = battle({
    mana: 0,
    maxMana: 10,
    enemyStatuses: { freeze: 40 },
    gearEffects: { freezeGrantsBlockAndMana: 1 },
  });
  const result = applyDamageStatuses(state, makeEffect("freeze", 15), 15, []);
  expect(result.playerStatuses.block).toBe(15);
  expect(result.mana).toBe(8);
  expect(result.enemyCC.freezeSkipTurns).toBeGreaterThan(0);
  expect(applyDamageStatuses(result, makeEffect("freeze", 15), 15, []).playerStatuses.block).toBe(15);
});

it.each([0, 7])("Dance of Blades plays and discards a drawn card with %i cards in hand", (handSize) => {
  const counter = makeTestCard({ id: "counter", effects: [makeEffect("physical", 20)] });
  const hand = Array.from({ length: handSize }, (_, i) => makeTestCard({ id: `filler-${i}` }));
  let rolls = 0;
  const state = battle({
    hand,
    deck: [counter],
    playerHealth: 100,
    playerMaxHealth: 100,
    playerStatuses: { armor: 10, block: 8 },
    gearEffects: { dodgeDrawAndPlay: 1 },
    rng: () => (++rolls <= 2 ? 0.01 : 0.99),
  });
  const texts: CombatTextEvent[] = [];
  const result = applyEnemyAbility(state, makeTestCard({ effects: [makeEffect("physical", 8)] }), texts);
  expect(result.playerHealth).toBe(100);
  expect(result.playerStatuses).toMatchObject({ armor: 10, block: 8 });
  expect(result.enemyHealth).toBe(80);
  expect(result.hand).toEqual(hand);
  expect(result.deck).toEqual([]);
  expect(result.discard.map(({ id }) => id)).toEqual(["counter"]);
  expect(texts).toContainEqual(expect.objectContaining({ kind: "notice", stat: "dodge" }));
});

it.each([
  [100, 95, 15, 10],
  [35, 30, 15, 10],
  [34, 0, 0, 0],
])("Blackfletch checks Health after the arrow at %i Health", (health, remaining, bleed, poison) => {
  const card = makeTestCard({ tags: ["archery"], effects: [makeEffect("physical", 5)] });
  const state = battle({
    hand: [card],
    enemyHealth: health,
    enemyStatuses: { bleed: 15, poison: 10 },
    gearEffects: { archeryDetonateBleedPoison: 1 },
  });
  const result = playBattleCardResolved(state, card.id, 0).state;
  expect(result.enemyHealth).toBe(remaining);
  expect(result.enemyStatuses).toMatchObject({ bleed, poison });
});

it.each([
  { roll: 0.1, expected: "freeze-second" },
  { roll: 0.9, expected: "burn-second" },
])("Twin Casting chooses one mixed-card type with roll $roll and assigns a fresh UID", ({ roll, expected }) => {
  const rng = vi.fn().mockReturnValueOnce(roll).mockReturnValueOnce(0.9);
  const card = makeTestCard({ id: "mixed", cost: 0, tags: ["burn", "freeze"], effects: [] });
  const deck = ["freeze-first", "burn-first", "freeze-second", "burn-second"].map((id) =>
    makeTestCard({ id, tags: [id.startsWith("freeze") ? "freeze" : "burn"], effects: [] }),
  );
  const state = battle({ hand: [card], deck, nextCardUid: 100, gearEffects: { elementalTwinCasting: 1 }, rng });
  const result = playBattleCardResolved(state, card.id, 0).state;
  expect(result.hand.map(({ id, uid }) => ({ id, uid }))).toEqual([{ id: expected, uid: 100 }]);
  expect(result.deck).toEqual(deck.filter(({ id }) => id !== expected));
  expect(result.nextCardUid).toBe(101);
  expect(rng).toHaveBeenCalledTimes(2);
  expect(state.deck).toEqual(deck);
});

it.each(["burn", "freeze"] as const)("Twin Casting draws the opposite element after a %s card", (type) => {
  const opposite = type === "burn" ? "freeze" : "burn";
  const card = makeTestCard({ effects: [makeEffect(type, 1)] });
  const drawn = makeTestCard({ id: "drawn", effects: [makeEffect(opposite, 1)] });
  const state = battle({ hand: [card], deck: [drawn], nextCardUid: 100, gearEffects: { elementalTwinCasting: 1 } });
  const result = playBattleCardResolved(state, card.id, 0).state;
  expect(result.hand).toEqual([{ ...drawn, uid: 100 }]);
  expect(result.deck).toEqual([]);
  expect(result.nextCardUid).toBe(101);
});

it("Twin Casting does not refill from discard or draw after a lethal hit", () => {
  const frost = makeTestCard({ id: "frost", tags: ["freeze"], effects: [] });
  const card = makeTestCard({ tags: ["burn"], effects: [makeEffect("burn", 10)] });
  const base = battle({ hand: [card], gearEffects: { elementalTwinCasting: 1 } });
  const empty = playBattleCardResolved({ ...base, discard: [frost] }, card.id, 0).state;
  expect(empty.hand).toEqual([]);
  expect(empty.discard).toEqual([frost, card]);
  const lethal = playBattleCardResolved({ ...base, enemyHealth: 5, deck: [frost] }, card.id, 0).state;
  expect(lethal.enemyHealth).toBe(0);
  expect(lethal.deck).toEqual([frost]);
  expect(lethal.hand).toEqual([]);
});

it("Saintfall heals on each Block depletion while the enemy survives", () => {
  const state = battle({
    playerHealth: 50,
    playerMaxHealth: 100,
    playerStatuses: { block: 5 },
    gearEffects: { saintfallRetribution: 4 },
  });
  const hit = (current: ReturnType<typeof battle>) => processEnemyDamageEffect(current, makeEffect("physical", 15), []);
  const first = hit(state);
  expect(first.playerStatuses.block).toBe(0);
  expect(first.playerHealth).toBe(44);
  const second = hit({ ...first, playerStatuses: { ...first.playerStatuses, block: 5 } });
  expect(second.playerHealth).toBe(38);
  const lethal = hit({ ...state, enemyHealth: 2 });
  expect(lethal.enemyHealth).toBe(0);
  expect(lethal.playerHealth).toBe(40);
});

it("damage-only repeats preserve nested branches and schedules without utility or empty wrappers", () => {
  const hit: BattleCardEffect = { kind: "random-damage", minAmount: 1, maxAmount: 3, damageTypePool: ["burn"] };
  const support: BattleCardEffect = { kind: "draw-cards", amount: 1 };
  const chance: BattleCardEffect = {
    kind: "chance",
    probability: 0.5,
    successEffects: [support, hit],
    failureEffects: [support],
  };
  const source: BattleCardEffect[] = [
    makeEffect("physical", 3),
    support,
    chance,
    { kind: "repeat-over-turns", remainingTurns: 2, effects: [chance] },
    { kind: "repeat-over-turns", remainingTurns: 1, effects: [support] },
  ];
  const before = structuredClone(source);
  const filteredChance = { ...chance, successEffects: [hit], failureEffects: [] };
  expect(damageOnlyEffects(source)).toEqual([
    makeEffect("physical", 3),
    filteredChance,
    { kind: "repeat-over-turns", remainingTurns: 2, effects: [filteredChance] },
  ]);
  expect(source).toEqual(before);
});

it("disabling Returning Gale clears queued echoes without dealing damage", () => {
  const echo = makeTestCard({ effects: [makeEffect("physical", 4)] });
  const result = processArcheryEchoes(battle({ uniqueGear: { archeryEchoes: [echo] } }), []);
  expect(result.uniqueGear.archeryEchoes).toEqual([]);
  expect(result.enemyHealth).toBe(100);
});
