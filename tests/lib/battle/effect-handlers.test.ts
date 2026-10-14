import { describe, expect, it, vi } from "vitest";
import type { CombatTextEvent } from "@/lib/battle/types";
import { applyCardEffects, applyEffectByKind, EFFECT_APPLY_BY_KIND } from "@/lib/battle/effect-handlers/registry";
import { cardById, companionLibrary } from "@/lib/game-data";
import { applyNumericCorruption, getEditableCorruptionTargets } from "@/lib/corruption/numeric";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

it("applySelfDamageEffect does not grant rider status when Death's Door absorbs the full hit", () => {
  const state = patchBattleState({
    playerHealth: 1,
    playerMaxHealth: 30,
    playerStatuses: { burn: 0 },
  });
  const texts: CombatTextEvent[] = [];
  const result = EFFECT_APPLY_BY_KIND["self-damage"](
    state,
    makeTestCard(),
    { kind: "self-damage", damageType: "burn", amount: 5 },
    1,
    texts,
  );
  expect(result.playerHealth).toBe(1);
  expect(result.playerStatuses.burn).toBe(0);
  expect(result.deathsDoorActive).toBe(true);
});

describe("applyPlayerStatusEffectHandler", () => {
  it.each([2, 0])("uses perManaCrystal scaling %i instead of the fallback amount", (perManaCrystal) => {
    const state = patchBattleState({ maxMana: 5 });
    const result = EFFECT_APPLY_BY_KIND["player-status"](
      state,
      makeTestCard(),
      { kind: "player-status", status: "block", amount: 2, perManaCrystal },
      1,
      [],
    );
    expect(result.playerStatuses.block).toBe(5 * perManaCrystal);
  });

  it.each([3, 0])(
    "scales the start-of-card Mana by %i and spends live Mana even for a zero factor",
    (convertCurrentMana) => {
      const original = cardById["mana-shield"]!;
      const target = getEditableCorruptionTargets(original).find((entry) => entry.field === "convertCurrentMana")!;
      const card = applyNumericCorruption(original, target, convertCurrentMana - target.value);
      const effect = card.effects[0]!;
      if (effect.kind !== "player-status") throw new Error("Expected Mana Shield's status effect");
      const state = patchBattleState({ mana: 4, maxMana: 5 });
      const texts: CombatTextEvent[] = [];
      const result = EFFECT_APPLY_BY_KIND["player-status"](state, card, effect, 2, texts, {
        manaAtStart: 6,
        enemyFreezeSkipTurnsAtStart: 0,
      });
      expect(result.playerStatuses.block).toBe(12 * convertCurrentMana);
      expect(result.mana).toBe(0);
      expect(texts).toEqual([
        { target: "player", kind: "damage", stat: "mana", amount: 4, impact: false },
        ...(convertCurrentMana > 0
          ? [{ target: "player", kind: "status", stat: "block", amount: 12 * convertCurrentMana }]
          : []),
      ]);
      expect(state.mana).toBe(4);
    },
  );
});

it.each(["freeze", "stun"] as const)(
  "enemy-status control activation activates %s at the threshold and acknowledges it",
  (status) => {
    const state = patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30 });
    const texts: CombatTextEvent[] = [];
    const result = EFFECT_APPLY_BY_KIND["enemy-status"](
      state,
      makeTestCard(),
      { kind: "enemy-status", status, amount: 15 },
      1,
      texts,
    );
    expect(result.enemyCC[status === "freeze" ? "freezeSkipTurns" : "stunSkipTurns"]).toBeGreaterThan(0);
    expect(texts).toContainEqual(expect.objectContaining({ kind: "notice", stat: status }));
    expect(state.enemyCC[status === "freeze" ? "freezeSkipTurns" : "stunSkipTurns"]).toBe(0);
  },
);

it.each([0, 5])("applyRemovePlayerStatusEffect grants Cleanse healing only when removing %i Burn stacks", (burn) => {
  const state = patchBattleState({
    playerHealth: 10,
    playerMaxHealth: 30,
    playerStatuses: { burn },
    trinketEffects: { sinEaterHealOnHarmfulStatusRemove: 3 },
    talentEffects: { healOnStatusCleanse: 2 },
  });
  const result = EFFECT_APPLY_BY_KIND["remove-player-status"](
    state,
    makeTestCard(),
    { kind: "remove-player-status", status: "burn" },
    1,
    [],
  );
  expect(result.playerStatuses.burn).toBe(0);
  expect(result.playerHealth).toBe(burn ? 15 : 10);
  if (burn === 0) expect(result).toBe(state);
});

describe("conditional effect handlers", () => {
  it.each([0, 5])("converts %i Burn stacks to damage and preserves an empty state", (burn) => {
    const state = patchBattleState({ playerStatuses: { burn }, enemyHealth: 30, rng: () => 0.99 });
    const result = EFFECT_APPLY_BY_KIND["cleanse-player-status-to-damage"](
      state,
      makeTestCard(),
      { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "physical" },
      1,
      [],
    );
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.enemyHealth).toBe(30 - burn);
    if (burn === 0) expect(result).toBe(state);
  });

  it.each([
    [0, 0, 1],
    [2, 1, 3],
    [1, 1, 1],
  ])("restores Mana only for a new Freeze (%i live turns, %i starting turns)", (live, starting, mana) => {
    const state = patchBattleState({ mana: 1, enemyCC: { freezeSkipTurns: live } });
    const result = EFFECT_APPLY_BY_KIND["restore-mana"](
      state,
      makeTestCard(),
      { kind: "restore-mana", amount: 2, ifEnemyFrozen: true },
      1,
      [],
      { manaAtStart: 1, enemyFreezeSkipTurnsAtStart: starting },
    );
    expect(result.mana).toBe(mana);
    if (live === starting) expect(result).toBe(state);
  });

  it.each([
    [0, 0, 5],
    [2, 0, 7],
    [0, 5, 5],
  ])("pays conditional Gold for Stun turns rather than buildup (%i turns, %i stacks)", (turns, buildup, gold) => {
    const state = patchBattleState({ gold: 5, enemyCC: { stunSkipTurns: turns }, enemyStatuses: { stun: buildup } });
    const texts: CombatTextEvent[] = [];
    const result = EFFECT_APPLY_BY_KIND["gain-gold"](
      state,
      makeTestCard(),
      { kind: "gain-gold", amount: 2, ifEnemyStunned: true },
      1,
      texts,
    );
    expect(result.gold).toBe(gold);
    expect(texts).toEqual(turns ? [{ target: "player", kind: "status", stat: "gold", amount: 2 }] : []);
    if (turns === 0) expect(result).toBe(state);
  });
});

it.each(["nope", "toString", "constructor", "__proto__"])(
  "applyEffectByKind unknown kind rejects unknown kind %s without invoking a handler",
  (kind) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const state = patchBattleState();
      const unknown = applyEffectByKind(state, makeTestCard(), { kind } as never, 1, []);
      expect(unknown).toBe(state);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Missing handler"));
    } finally {
      warn.mockRestore();
    }
  },
);

describe("applyCompanionActionEffect", () => {
  it("no-ops without an active companion", () => {
    const state = patchBattleState({ activeCompanion: null });
    const result = EFFECT_APPLY_BY_KIND["companion-action"](
      state,
      makeTestCard(),
      { kind: "companion-action", amount: 2 },
      1,
      [],
    );
    expect(result).toBe(state);
  });

  it.each([1, 2])("resolves exactly %i Companion actions", (amount) => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.wolf,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      rng: () => 0.99,
    });
    const result = EFFECT_APPLY_BY_KIND["companion-action"](
      state,
      makeTestCard(),
      { kind: "companion-action", amount },
      1,
      [],
    );
    expect(result.enemyHealth).toBe(100 - amount);
    expect(state.enemyHealth).toBe(100);
  });
});

it("range bounds errors share one message random-draw and random-damage throw the same bounds message", () => {
  const state = patchBattleState();
  for (const effect of [
    { kind: "random-draw", minAmount: 6, maxAmount: 1 },
    { kind: "random-damage", minAmount: 6, maxAmount: 1 },
  ] as const) {
    expect(() => applyCardEffects(state, makeTestCard({ effects: [effect] }), [])).toThrow(
      "maxAmount must be >= minAmount",
    );
  }
});

describe("recursive effects", () => {
  it("queues delayed effects with source metadata without applying them immediately", () => {
    const state = patchBattleState({ playerHealth: 20 });
    const effect = {
      kind: "repeat-over-turns" as const,
      remainingTurns: 2,
      effects: [{ kind: "heal" as const, amount: 4 }],
    };
    const card = makeTestCard({ id: "bread", consume: true, tags: ["holy"], effects: [effect] });
    const result = applyCardEffects(state, card, []);
    expect(result.pendingTurnStartEffects).toEqual([
      ...state.pendingTurnStartEffects,
      {
        remainingTurns: effect.remainingTurns,
        effects: effect.effects,
        sourceCard: { id: "bread", consume: true, tags: ["holy"] },
      },
    ]);
    expect(result.playerHealth).toBe(state.playerHealth);
    expect(result.enemyHealth).toBe(state.enemyHealth);
  });

  it("runs the empty failure branch as a no-op", () => {
    const state = patchBattleState({ rng: () => 0.99 });
    const card = makeTestCard({
      effects: [{ kind: "chance", probability: 0, successEffects: [{ kind: "heal", amount: 5 }], failureEffects: [] }],
    });
    const result = applyCardEffects(state, card, []);
    expect(result.playerHealth).toBe(state.playerHealth);
  });
});

it("repeat action scope suppresses potion scaling ignores potionPotency during unique repeats", () => {
  const card = makeTestCard({ id: "health-potion", consume: true, effects: [{ kind: "heal", amount: 4 }] });
  const base = patchBattleState({
    playerHealth: 10,
    playerMaxHealth: 30,
    talentEffects: { potionPotency: 2 },
  });
  const scaled = applyCardEffects(base, card, []);
  const suppressed = applyCardEffects(
    { ...base, action: { source: "repeat", cardBonuses: "ineligible", repeatActive: true } },
    card,
    [],
  );
  expect(scaled.playerHealth).toBe(18);
  expect(suppressed.playerHealth).toBe(14);
});

// Handler-per-kind coverage lives in
// tests/lib/game-data/effect-kind-coverage.test.ts; this file pins dispatch
// behavior (snapshots, branches, and failure handling).

describe("effect selection", () => {
  it.each([
    [0.25, 27, 10],
    [0.75, 30, 13],
  ])("resolves only the selected chance branch (%s)", (roll, enemyHealth, gold) => {
    const rng = vi.fn(() => 0.99).mockReturnValueOnce(roll);
    const state = patchBattleState({ gold: 10, rng });
    const card = makeTestCard({
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "random-damage", minAmount: 3, maxAmount: 3 }],
          failureEffects: [{ kind: "gain-gold", amount: 3 }],
        },
      ],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(enemyHealth);
    expect(result.gold).toBe(gold);
    if (roll < 0.5) expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "nature", amount: 3 });
    else expect(texts).toEqual([{ target: "player", kind: "status", stat: "gold", amount: 3 }]);
  });

  it.each([
    [0, 0, "stun", 1],
    [0.99, 0.99, "bleed", 4],
  ] as const)("uses injected rolls %s/%s for random damage type and amount", (typeRoll, amountRoll, stat, amount) => {
    const rng = vi
      .fn(() => 0.99)
      .mockReturnValueOnce(typeRoll)
      .mockReturnValueOnce(amountRoll);
    const state = patchBattleState({ rng });
    const card = makeTestCard({
      effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 4, damageTypePool: ["stun", "physical", "bleed"] }],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(30 - amount);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat, amount });
  });

  it.each([
    ["next-hit-crit", "nextHitCrit"],
    ["next-hit-leech", "nextHitLeech"],
    ["play-next-card-twice", "playNextCardTwice"],
  ] as const)("arms %s for a later action", (kind, flag) => {
    const state = patchBattleState();
    const result = applyCardEffects(state, makeTestCard({ effects: [{ kind }] }), []);
    expect(result.flags[flag]).toBe(true);
    expect(state.flags[flag]).toBe(false);
  });
});
