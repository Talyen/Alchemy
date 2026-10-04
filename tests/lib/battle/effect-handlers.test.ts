import { describe, expect, it, vi } from "vitest";
import type { CombatTextEvent } from "@/lib/battle/types";
import { applyCardEffects, applyEffectByKind, EFFECT_APPLY_BY_KIND } from "@/lib/battle/effect-handlers/registry";
import { companionLibrary } from "@/lib/game-data";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("applySelfDamageEffect", () => {
  it("does not grant rider status when Death's Door absorbs the full hit", () => {
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
});

describe("applyPlayerStatusEffectHandler", () => {
  it("applies perManaCrystal scaling", () => {
    const state = patchBattleState({ maxMana: 5 });
    const result = EFFECT_APPLY_BY_KIND["player-status"](
      state,
      makeTestCard(),
      { kind: "player-status", status: "block", amount: 2, perManaCrystal: 2 },
      1,
      [],
    );
    expect(result.playerStatuses.block).toBe(10);
  });

  it("scales the start-of-card Mana snapshot and spends the live Mana only once", () => {
    const state = patchBattleState({ mana: 4, maxMana: 5 });
    const texts: CombatTextEvent[] = [];
    const result = EFFECT_APPLY_BY_KIND["player-status"](
      state,
      makeTestCard(),
      { kind: "player-status", status: "block", amount: 0, convertCurrentMana: 3 },
      2,
      texts,
      { manaAtStart: 6, enemyFreezeSkipTurnsAtStart: 0 },
    );
    expect(result.playerStatuses.block).toBe(36);
    expect(result.mana).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 36 });
    expect(state.mana).toBe(4);
  });
});

describe("enemy-status control activation", () => {
  it.each(["freeze", "stun"] as const)("activates %s at the threshold and acknowledges it", (status) => {
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
  });
});

describe("applyRemovePlayerStatusEffect", () => {
  it("removes player status and applies heals from trinkets and talents", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      playerStatuses: { burn: 5 },
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
    expect(result.playerHealth).toBe(15);
  });

  it("no-ops when player has 0 stacks of the status", () => {
    const state = patchBattleState({
      playerStatuses: { burn: 0 },
    });
    const result = EFFECT_APPLY_BY_KIND["remove-player-status"](
      state,
      makeTestCard(),
      { kind: "remove-player-status", status: "burn" },
      1,
      [],
    );
    expect(result).toBe(state);
  });
});

describe("applyMultiplyEnemyStatusEffect", () => {
  it("no-ops when current status is 0", () => {
    const state = patchBattleState({
      enemyStatuses: { poison: 0 },
    });
    const result = EFFECT_APPLY_BY_KIND["multiply-enemy-status"](
      state,
      makeTestCard(),
      { kind: "multiply-enemy-status", status: "poison", factor: 2 },
      1,
      [],
    );
    expect(result).toBe(state);
  });

  it("multiplies enemy status and triggers freeze resolution", () => {
    const state = patchBattleState({
      enemyStatuses: { freeze: 4 },
    });
    const result = EFFECT_APPLY_BY_KIND["multiply-enemy-status"](
      state,
      makeTestCard(),
      { kind: "multiply-enemy-status", status: "freeze", factor: 3 },
      1,
      [],
    );
    expect(result.enemyStatuses.freeze).toBe(12);
  });
});

describe("applyCleansePlayerStatusToDamageEffect", () => {
  it("no-ops when player has 0 stacks", () => {
    const state = patchBattleState();
    const result = EFFECT_APPLY_BY_KIND["cleanse-player-status-to-damage"](
      state,
      makeTestCard(),
      { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "physical" },
      1,
      [],
    );
    expect(result).toBe(state);
  });

  it("cleanses status and deals damage", () => {
    const state = patchBattleState({
      playerStatuses: { burn: 5 },
      enemyHealth: 30,
    });
    const result = EFFECT_APPLY_BY_KIND["cleanse-player-status-to-damage"](
      state,
      makeTestCard(),
      { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "physical" },
      1,
      [],
    );
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.enemyHealth).toBe(25);
  });
});

describe("applyRestoreManaEffect ifEnemyFrozen", () => {
  it("no-ops when enemy not frozen and ifEnemyFrozen set", () => {
    const state = patchBattleState({ enemyCC: { freezeSkipTurns: 0, stunSkipTurns: 0, cooldown: 0 } });
    const result = EFFECT_APPLY_BY_KIND["restore-mana"](
      state,
      makeTestCard(),
      { kind: "restore-mana", amount: 2, ifEnemyFrozen: true },
      1,
      [],
      { manaAtStart: 0, enemyFreezeSkipTurnsAtStart: 0 },
    );
    expect(result).toBe(state);
  });

  it("restores when enemy frozen at start", () => {
    const state = patchBattleState({ mana: 1, enemyCC: { freezeSkipTurns: 2, stunSkipTurns: 0, cooldown: 0 } });
    const result = EFFECT_APPLY_BY_KIND["restore-mana"](
      state,
      makeTestCard(),
      { kind: "restore-mana", amount: 2, ifEnemyFrozen: true },
      1,
      [],
      { manaAtStart: 1, enemyFreezeSkipTurnsAtStart: 1 },
    );
    expect(result.mana).toBe(3);
  });
});

describe("applyGainGoldEffect ifEnemyStunned", () => {
  it("no-ops when the enemy is not stunned and ifEnemyStunned is set", () => {
    const state = patchBattleState({ enemyCC: { freezeSkipTurns: 0, stunSkipTurns: 0, cooldown: 0 } });
    const result = EFFECT_APPLY_BY_KIND["gain-gold"](
      state,
      makeTestCard(),
      { kind: "gain-gold", amount: 2, ifEnemyStunned: true },
      1,
      [],
      { manaAtStart: 0, enemyFreezeSkipTurnsAtStart: 0 },
    );
    expect(result).toBe(state);
  });

  it("pays gold when the enemy is stunned", () => {
    const state = patchBattleState({ gold: 5, enemyCC: { freezeSkipTurns: 0, stunSkipTurns: 2, cooldown: 0 } });
    const texts: CombatTextEvent[] = [];
    const result = EFFECT_APPLY_BY_KIND["gain-gold"](
      state,
      makeTestCard(),
      { kind: "gain-gold", amount: 2, ifEnemyStunned: true },
      1,
      texts,
      { manaAtStart: 0, enemyFreezeSkipTurnsAtStart: 0 },
    );
    expect(result.gold).toBe(7);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 2 });
  });

  it("ignores stun buildup that has not skipped a turn", () => {
    const state = patchBattleState({
      gold: 0,
      enemyCC: { freezeSkipTurns: 0, stunSkipTurns: 0, cooldown: 0 },
      enemyStatuses: { stun: 5 },
    });
    const result = EFFECT_APPLY_BY_KIND["gain-gold"](
      state,
      makeTestCard(),
      { kind: "gain-gold", amount: 2, ifEnemyStunned: true },
      1,
      [],
      { manaAtStart: 0, enemyFreezeSkipTurnsAtStart: 0 },
    );
    expect(result.gold).toBe(0);
  });
});

describe("applyEffectByKind unknown kind", () => {
  it.each(["nope", "toString", "constructor", "__proto__"])(
    "rejects unknown kind %s without invoking a handler",
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
});

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

  it("acts once per amount with an active companion", () => {
    const base = patchBattleState({ activeCompanion: companionLibrary.wolf, enemyHealth: 100 });
    const once = EFFECT_APPLY_BY_KIND["companion-action"](
      base,
      makeTestCard(),
      { kind: "companion-action", amount: 1 },
      1,
      [],
    );
    const twice = EFFECT_APPLY_BY_KIND["companion-action"](
      base,
      makeTestCard(),
      { kind: "companion-action", amount: 2 },
      1,
      [],
    );
    expect(once.enemyHealth).toBeLessThan(100);
    expect(twice.enemyHealth).toBeLessThan(once.enemyHealth);
  });
});

describe("range bounds errors share one message", () => {
  it("random-draw and random-damage throw the same bounds message", () => {
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
});

describe("recursive effects", () => {
  it("queues repeat-over-turns with source card id", () => {
    const state = patchBattleState();
    const card = makeTestCard({
      id: "bread",
      effects: [{ kind: "repeat-over-turns", remainingTurns: 2, effects: [{ kind: "heal", amount: 4 }] }],
    });
    const result = applyCardEffects(state, card, []);
    expect(result.pendingTurnStartEffects).toHaveLength(state.pendingTurnStartEffects.length + 1);
    expect(result.pendingTurnStartEffects.at(-1)).toMatchObject({
      remainingTurns: 2,
      sourceCard: { id: "bread" },
    });
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

describe("repeat action scope suppresses potion scaling", () => {
  it("ignores potionPotency during unique repeats", () => {
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
});

// Handler-per-kind coverage lives in
// tests/lib/game-data/effect-kind-coverage.test.ts; this file pins dispatch
// behavior (snapshots, branches, and failure handling).
