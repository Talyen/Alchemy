import { describe, expect, it, vi } from "vitest";
import type { BattleCardEffect } from "@/lib/game-data";
import { battleSnapshot } from "@/lib/battle/battle-snapshot";
import { inspectBattleCardDamage } from "@/lib/battle/card-damage-inspection";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { createSeededRng } from "@/lib/rng";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

const blockHit: BattleCardEffect = { kind: "damage", damageType: "physical", amount: 0, equalToBlock: true };
const hit: BattleCardEffect = { kind: "damage", damageType: "physical", amount: 6 };
const block = (amount: number): BattleCardEffect => ({ kind: "player-status", status: "block", amount });
const chance = (successEffects: BattleCardEffect[], failureEffects: BattleCardEffect[]): BattleCardEffect => ({
  kind: "chance",
  probability: 0.5,
  successEffects,
  failureEffects,
});

describe("inspection resolves correlated production outcomes", () => {
  it("shows 4–8 Block-scaled damage instead of inventing the original zero Block", () => {
    const card = makeTestCard({ cost: 0, effects: [chance([block(4)], [block(8)]), blockHit] });
    const rng = vi.fn(() => 0.99);
    const state = patchBattleState({ hand: [card], enemyHealth: 100, enemyMaxHealth: 100, rng });
    const before = structuredClone(battleSnapshot(state));
    for (let index = 0; index < 3; index++) {
      const inspected = inspectBattleCardDamage(card, state);
      expect(inspected.card.effects[1]).toMatchObject({ kind: "random-damage", minAmount: 4, maxAmount: 8 });
      expect(inspected.outcomes.get("1")?.kind).toBe("alternatives");
      expect(inspected.card.descriptionLines).toContain("Deal 4–8 Physical damage");
    }
    expect(rng).not.toHaveBeenCalled();
    expect(battleSnapshot(state)).toEqual(before);
    expect(
      [0.25, 0.99].map(
        (roll) => 100 - playBattleCardResolved({ ...state, rng: () => roll }, card.id, 0).state.enemyHealth,
      ),
    ).toEqual([4, 8]);
  });

  it("keeps correlated Block and Armor together through a fatal multi-hit sequence", () => {
    const armor = (amount: number): BattleCardEffect => ({ kind: "player-status", status: "armor", amount });
    const card = makeTestCard({
      cost: 0,
      effects: [
        chance([block(4), armor(8)], [block(8), armor(4)]),
        blockHit,
        { kind: "damage", damageType: "physical", amount: 0, equalToArmor: true },
        hit,
      ],
    });
    const state = patchBattleState({ hand: [card], enemyHealth: 10, enemyMaxHealth: 100 });
    const inspected = inspectBattleCardDamage(card, state);
    expect(inspected.card.effects.slice(1)).toMatchObject([
      { kind: "random-damage", minAmount: 4, maxAmount: 8 },
      { kind: "random-damage", minAmount: 4, maxAmount: 8 },
      { kind: "damage", amount: 0 },
    ]);
    for (const roll of [0.25, 0.99])
      expect(playBattleCardResolved({ ...state, rng: () => roll }, card.id, 0).state.enemyHealth).toBe(0);
  });

  it("carries uncertain Health across a damage threshold", () => {
    const card = makeTestCard({
      cost: 0,
      effects: [chance([{ kind: "heal", amount: 2 }], [{ kind: "lose-health", amount: 2 }]), hit],
    });
    const state = patchBattleState({
      playerHealth: 20,
      playerMaxHealth: 40,
      talentEffects: { physicalDoubledBelowHalfHealth: true },
    });
    expect(inspectBattleCardDamage(card, state).card.effects[1]).toMatchObject({
      kind: "random-damage",
      minAmount: 6,
      maxAmount: 12,
    });
  });

  it("includes interior random outcomes when thresholds and branch-local defeat are nonlinear", () => {
    const card = makeTestCard({
      cost: 0,
      effects: [
        { kind: "random-damage", minAmount: 1, maxAmount: 6, damageTypePool: ["physical"] },
        { kind: "damage", damageType: "physical", amount: 3 },
      ],
    });
    const state = patchBattleState({
      hand: [card],
      enemyHealth: 6,
      enemyMaxHealth: 8,
      talentEffects: { physicalDoubledBelowQuarterHealth: true },
    });
    // Endpoints leave the next hit at 3 or 0. An interior hit of 5 leaves
    // one Health and enables the doubled 6-damage packet.
    expect(inspectBattleCardDamage(card, state).card.effects[1]).toMatchObject({
      kind: "random-damage",
      minAmount: 0,
      maxAmount: 6,
    });
    const live = playBattleCardResolved({ ...state, rng: () => 0.75 }, card.id, 0);
    expect(
      live.combatTexts
        .filter((event) => event.target === "enemy" && event.kind === "damage" && event.stat === "physical")
        .reduce((sum, event) => sum + ("amount" in event ? event.amount : 0), 0),
    ).toBe(11);
  });

  it("keeps already known packets but downgrades unenumerated dependent outcomes to unknown", () => {
    const card = makeTestCard({
      cost: 0,
      effects: [hit, { kind: "random-damage", minAmount: 1, maxAmount: 10000, damageTypePool: ["physical"] }, blockHit],
    });
    const result = inspectBattleCardDamage(card, patchBattleState({ playerStatuses: { forge: 4 } }));
    expect(result.card.effects[0]).toMatchObject({ kind: "damage", amount: 10 });
    expect(result.outcomes.get("0")?.kind).toBe("exact");
    expect(result.outcomes.get("1")?.kind).toBe("unknown");
    expect(result.outcomes.get("2")?.kind).toBe("unknown");
    expect(result.card.effects.slice(1)).toEqual(card.effects.slice(1));
  });

  it("does not guess drawn card identities or continue with a fabricated post-draw state", () => {
    const card = makeTestCard({ cost: 0, effects: [hit, { kind: "draw-cards", amount: 1 }, blockHit] });
    const state = patchBattleState({ deck: [makeTestCard()], playerStatuses: { forge: 4 } });
    const before = JSON.stringify(state);
    const result = inspectBattleCardDamage(card, state);
    expect(result.card.effects[0]).toMatchObject({ amount: 10 });
    expect(result.outcomes.get("2")?.kind).toBe("unknown");
    expect(result.card.effects[2]).toEqual(blockHit);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("never borrows an execution callback from an inspected battle", () => {
    const card = makeTestCard({ effects: [{ kind: "draw-cards", amount: 1 }, hit] });
    const onEmptyDraw = vi.fn((state) => state);
    const state = patchBattleState({ deck: [], discard: [], onEmptyDraw });
    expect(inspectBattleCardDamage(card, state).card.effects[1]).toMatchObject({ amount: 6 });
    expect(onEmptyDraw).not.toHaveBeenCalled();
  });

  it("distinguishes repeated occurrences even when an authored effect object is shared", () => {
    const card = makeTestCard({ effects: [hit, hit] });
    const result = inspectBattleCardDamage(card, patchBattleState({ flags: { nextHitPhysicalBonus: 4 } }));
    expect(result.card.descriptionLines).toEqual(["Deal 10 Physical damage", "Deal 6 Physical damage"]);
    expect(result.outcomes.get("0")).not.toEqual(result.outcomes.get("1"));
  });

  it("retains future-turn effects as authored data", () => {
    const delayed: BattleCardEffect = { kind: "repeat-over-turns", remainingTurns: 2, effects: [hit] };
    const card = makeTestCard({ effects: [delayed, hit] });
    const result = inspectBattleCardDamage(card, patchBattleState({ playerStatuses: { forge: 4 } }));
    expect(result.card.effects[0]).toEqual(delayed);
    expect(result.card.effects[1]).toMatchObject({ amount: 10 });
    expect(result.outcomes.has("0.0")).toBe(false);
  });

  it("does not let a full-card repeat rewrite the first application's branch observations", () => {
    const card = makeTestCard({ effects: [chance([hit], [{ ...hit, amount: 10 }])] });
    const result = inspectBattleCardDamage(
      card,
      patchBattleState({ flags: { playNextCardTwice: true }, playerStatuses: { forge: 4 } }),
    );
    expect(result.card.effects[0]).toMatchObject({
      kind: "chance",
      successEffects: [{ kind: "damage", amount: 10 }],
      failureEffects: [{ kind: "damage", amount: 14 }],
    });
  });

  it("observation preserves live seeded state, combat texts, and RNG position; snapshots strip all execution ports", () => {
    const card = makeTestCard({ cost: 0, effects: [chance([block(4)], [block(8)]), blockHit, hit] });
    const base = patchBattleState({ hand: [card], enemyHealth: 100, enemyMaxHealth: 100 });
    for (const seed of [1, 42, 127]) {
      const rng = createSeededRng(seed);
      const observedRng = createSeededRng(seed);
      const result = playBattleCardResolved({ ...base, rng }, card.id, 0);
      const seen: unknown[] = [];
      const observed = playBattleCardResolved(
        {
          ...base,
          rng: observedRng,
          observer: {
            step: () => {},
            effect: (_card, _effect, resolve) => resolve(),
            branch: () => {},
            attack: (packet) => {
              seen.push(packet);
            },
            unknownDraw: () => {
              throw new Error("Unexpected draw");
            },
          },
        },
        card.id,
        0,
      );
      expect(battleSnapshot(observed.state)).toEqual(battleSnapshot(result.state));
      expect(observed.combatTexts).toEqual(result.combatTexts);
      expect(observedRng()).toBe(rng());
      expect(seen.length).toBeGreaterThan(0);
      expect(battleSnapshot(observed.state)).not.toHaveProperty("observer");
      const saved = battleSnapshot({ ...observed.state, sampleWishOptions: () => ({ cards: [], deferred: true }) });
      expect(saved).not.toHaveProperty("sampleWishOptions");
      expect(() => structuredClone(saved)).not.toThrow();
    }
  });
});
