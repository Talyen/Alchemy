import { describe, expect, it } from "vitest";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import type { BattleState } from "@/lib/battle/types";
import { isPlayerDefeated } from "@/lib/battle/battle-outcome";
import { makeTestCard, patchBattleState, type BattleStatePatch } from "../../fixtures/battle";
import type { BestiaryEntry } from "@/lib/game-data";
import { companionLibrary } from "@/lib/game-data";

function baseEnemy(enemyId: string): BestiaryEntry {
  return {
    id: enemyId,
    title: "Test Enemy",
    subtitle: "",
    descriptionLines: [],
    art: "",
    enemyType: "normal",
    traits: [],
    abilityIds: ["slash", "burning-blade", "sunder"],
  };
}

function battleState(overrides: BattleStatePatch = {}): BattleState {
  return patchBattleState({
    rng: () => 0.99,
    enemyPhysicalDamageBonus: 6,
    enemyHealth: 50,
    enemyMaxHealth: 50,
    mana: 4,
    maxMana: 4,
    currentEnemy: baseEnemy("test-enemy"),
    ...overrides,
  });
}

describe("endPlayerTurn - haste branch", () => {
  it.each([1, 2])("holds Health and both Blocks while spending one of %i Haste", (haste) => {
    const result = endPlayerTurn(
      battleState({
        playerHealth: 20,
        playerStatuses: { haste, block: 10 },
        enemyMitigation: { block: 8 },
      }),
    );
    expect(result.kind).toBe("haste");
    expect(result.enemyPerformedAbility).toBe(false);
    expect(result.playerTurnSkipped).toBe(false);
    expect(result.state.turnPhase).toBe("player");
    expect(result.state.playerHealth).toBe(20);
    expect(result.state.playerStatuses).toMatchObject({ haste: haste - 1, block: 10 });
    expect(result.state.enemyMitigation.block).toBe(8);
  });

  it("decays each block exactly once across a full haste chain", () => {
    const first = endPlayerTurn(
      battleState({
        playerStatuses: { haste: 1, block: 30 },
        enemyMitigation: { block: 8 },
      }),
    );

    const second = endPlayerTurn(first.state);
    expect(second.enemyPerformedAbility).toBe(true);
    expect(second.state.enemyMitigation.block).toBe(4);
    expect(second.state.playerStatuses.block).toBe(11);
  });
});

describe("endPlayerTurn - CC skip branch", () => {
  it.each(["stunSkipTurns", "freezeSkipTurns"] as const)("skips attacks during %s", (control) => {
    const result = endPlayerTurn(battleState({ enemyCC: { [control]: 1 } }));
    expect(result.enemyPerformedAbility).toBe(false);
    expect(result.state.enemyCC[control]).toBe(0);
  });

  it("reduces skip turn counters", () => {
    const state = battleState({ enemyCC: { stunSkipTurns: 2, freezeSkipTurns: 1 } });
    const result = endPlayerTurn(state);
    expect(result.state.enemyCC.stunSkipTurns).toBe(1);
    expect(result.state.enemyCC.freezeSkipTurns).toBe(0);
  });

  it("still ticks enemy DoTs during CC skip", () => {
    const state = battleState({
      enemyCC: { stunSkipTurns: 1 },
      enemyStatuses: { burn: 10 },
      enemyHealth: 50,
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyHealth).toBe(40);
  });

  it("still applies enemy traits during CC skip", () => {
    const state = battleState({
      turn: 2,
      enemyCC: { stunSkipTurns: 1 },
      currentEnemy: baseEnemy("rusting-carapace"),
    });
    state.currentEnemy.traits = [{ id: "rusting-carapace", title: "Rusting Carapace", description: "" }];
    const result = endPlayerTurn(state);
    expect(result.state.enemyMitigation.forge).toBeGreaterThan(0);
  });

  it("still grants encounter-trait per-turn gains during CC skip", () => {
    const state = battleState({
      enemyCC: { stunSkipTurns: 1 },
      currentEnemy: baseEnemy("tempered"),
    });
    state.currentEnemy.traits = [{ id: "tempered", title: "Tempered", description: "" }];
    const result = endPlayerTurn(state);
    expect(result.enemyPerformedAbility).toBe(false);
    expect(result.state.enemyMitigation.forge).toBe(1);
  });
});

describe("endPlayerTurn - standard branch", () => {
  it("executes enemy attack and deals damage", () => {
    const state = battleState({ playerHealth: 30 });
    const result = endPlayerTurn(state);
    expect(result.enemyPerformedAbility).toBe(true);
    expect(result.state.playerHealth).toBe(21);
    expect(result.state.turnPhase).toBe("player");
    expect(result.state.mana).toBeGreaterThan(0);
  });

  it("applies enemy regeneration after player DoT during enemy resolution", () => {
    const state = battleState({
      playerHealth: 50,
      playerStatuses: { burn: 3 },
      enemyHealth: 40,
      enemyMaxHealth: 50,
      enemyRegeneration: 5,
    });
    const result = endPlayerTurn(state);
    expect(result.afterAbilityState?.playerHealth).toBeLessThan(50);
    expect(result.state.enemyHealth).toBe(45);
  });

  it("moves the hand into discard when the enemy phase begins", () => {
    const held = makeTestCard({ id: "held" });
    const state = battleState({ hand: [held], discard: [] });
    const result = endPlayerTurn(state);
    expect(result.kind).not.toBe("haste");
    if (result.kind === "haste") throw new Error("Expected an enemy-turn resolution");
    expect(result.enemyTurnStartState.hand).toEqual([]);
    expect(result.enemyTurnStartState.discard.some((card) => card.id === "held")).toBe(true);
  });
});

describe("endPlayerTurn — tick order", () => {
  it.each([
    { stunSkipTurns: 0, kind: "standard" },
    { stunSkipTurns: 1, kind: "skipped" },
  ] as const)("keeps $kind playback at the lethal status tick without an attack frame", ({ stunSkipTurns, kind }) => {
    const state = battleState({
      enemyHealth: 2,
      enemyStatuses: { burn: 3 },
      enemyCC: { stunSkipTurns },
      playerHealth: 30,
    });
    const result = endPlayerTurn(state);

    expect(result.kind).toBe(kind);
    if (result.kind === "haste") throw new Error("Expected an enemy-turn resolution");
    expect(result.enemyTurnStartState.enemyHealth).toBe(0);
    expect(result.state).toEqual(result.enemyTurnStartState);
    expect(result.enemyPerformedAbility).toBe(false);
    expect(result).not.toHaveProperty("afterAbilityState");
    expect(result.enemyResolutionCombatTexts).toEqual([]);
    expect(result.combatTexts).toEqual(result.enemyTurnStartCombatTexts);
    expect(result.combatTexts).toContainEqual(expect.objectContaining({ target: "enemy", stat: "burn", amount: 3 }));
    expect(result.state.lastEnemyAbilityId).toBe(state.lastEnemyAbilityId);
    expect(result.state.playerHealth).toBe(30);
  });

  it("ticks enemy DoT before attack when enemy survives", () => {
    const state = battleState({
      enemyHealth: 50,
      enemyStatuses: { burn: 10 },
      playerHealth: 30,
      deck: Array.from({ length: 4 }, (_, index) => makeTestCard({ id: `d${index + 1}` })),
    });
    const result = endPlayerTurn(state);
    expect(result.kind).not.toBe("haste");
    if (result.kind === "haste") throw new Error("Expected an enemy-turn resolution");
    expect(result.enemyTurnStartState.enemyHealth).toBe(40);
    expect(result.enemyPerformedAbility).toBe(true);
    expect(result.state.playerHealth).toBe(21);
  });

  it("resolves on-attack Bleed after the attack and ends the action when it defeats the enemy", () => {
    const state = battleState({
      enemyHealth: 2,
      enemyStatuses: { onAttackBleed: 2 },
      enemyRegeneration: 10,
      playerHealth: 30,
      playerStatuses: { burn: 5 },
    });

    const result = endPlayerTurn(state);

    expect(result.enemyPerformedAbility).toBe(true);
    expect(result.state.playerHealth).toBe(21);
    expect(result.state.enemyHealth).toBe(0);
    expect(result.state.enemyStatuses.onAttackBleed).toBe(0);
  });

  it("applies player DoT only after enemy attack", () => {
    const state = battleState({
      playerHealth: 30,
      playerStatuses: { burn: 5 },
      deck: Array.from({ length: 4 }, (_, index) => makeTestCard({ id: `d${index + 1}` })),
    });
    const result = endPlayerTurn(state);
    expect(result.afterAbilityState?.playerHealth).toBe(21);
    expect(result.state.playerHealth).toBeLessThan(20);
  });
});

describe("endPlayerTurn — Death's Door", () => {
  it.each([
    { status: "burn", amount: 4, health: 1, remaining: 2 },
    { status: "poison", amount: 3, health: 2, remaining: 2 },
    { status: "bleed", amount: 5, health: 2, remaining: 0 },
  ] as const)(
    "protects against $status during grace expiry, then permits defeat",
    ({ status, amount, health, remaining }) => {
      const state = battleState({
        playerHealth: health,
        playerStatuses: { [status]: amount },
        deathsDoorUsed: true,
        deathsDoorActive: true,
        deathsDoorTriggeredTurn: 1,
        deathsDoorGraceTurnsRemaining: 0,
        turn: 1,
        deck: Array.from({ length: 4 }, () => makeTestCard()),
      });
      const expiryTurn = endPlayerTurn(state);
      expect(expiryTurn.state.playerHealth).toBe(1);
      expect(expiryTurn.state.deathsDoorActive).toBe(false);
      expect(expiryTurn.state.playerStatuses[status]).toBe(remaining);
      const result = endPlayerTurn(expiryTurn.state);
      expect(result.state.playerHealth).toBe(0);
      expect(isPlayerDefeated(result.state)).toBe(true);
    },
  );

  it("Death's Door does not re-trigger when already consumed", () => {
    const state = battleState({
      playerHealth: 3,
      deathsDoorUsed: true,
      deathsDoorActive: false,
      deck: Array.from({ length: 4 }, () => makeTestCard()),
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerHealth).toBe(0);
    expect(result.state.deathsDoorActive).toBe(false);
    expect(result.state.deathsDoorUsed).toBe(true);
    expect(isPlayerDefeated(result.state)).toBe(true);
  });

  it("CC immunity cooldown does not prevent Death's Door grace recovery turn", () => {
    const state = battleState({
      playerHealth: 1,
      playerStatuses: { stun: 20 },
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 1,
      turn: 1,
      deck: Array.from({ length: 4 }, () => makeTestCard()),
    });
    const result = endPlayerTurn(state);
    expect(result.state.turnPhase).toBe("player");
    expect(result.state.playerCC.stunSkipTurns).toBe(0);
  });

  it("multi-hit enemy cannot kill through the grace window", () => {
    const state = battleState({
      currentEnemy: { ...baseEnemy("multi-hit"), abilityIds: ["slash", "sunder", "burning-blade"] },
      playerHealth: 2,
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerHealth).toBe(1);
    expect(result.state.deathsDoorActive).toBe(true);
    expect(result.state.deathsDoorUsed).toBe(true);
    expect(result.state.turnPhase).toBe("player");
  });

  it("DoT tick after a lethal hit cannot kill through the grace window", () => {
    const state = battleState({
      playerHealth: 2,
      playerStatuses: { burn: 4 },
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerHealth).toBe(1);
    expect(result.state.deathsDoorActive).toBe(true);
    expect(result.state.deathsDoorUsed).toBe(true);
    expect(result.state.playerStatuses.burn).toBe(2);
  });

  it("lethal hit after grace expires kills on a later enemy phase", () => {
    const state = battleState({
      playerHealth: 1,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 0,
      turn: 1,
      deck: Array.from({ length: 4 }, () => makeTestCard()),
    });
    const expiryTurn = endPlayerTurn(state);
    expect(expiryTurn.state.playerHealth).toBe(1);
    expect(expiryTurn.state.deathsDoorActive).toBe(false);
    expect(expiryTurn.state.deathsDoorUsed).toBe(true);

    const result = endPlayerTurn(expiryTurn.state);
    expect(result.state.playerHealth).toBe(0);
    expect(isPlayerDefeated(result.state)).toBe(true);
  });
});

describe("endPlayerTurn — companion", () => {
  it("does not apply companion turn-start effects", () => {
    const state = battleState({
      activeCompanion: companionLibrary.wolf,
      enemyHealth: 30,
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyHealth).toBe(30);
    expect(result.state.enemyStatuses.bleed).toBe(0);
  });
});

describe("endPlayerTurn — pending turn-start pulses", () => {
  it("keeps newly scheduled pulses for later turns without executing them immediately", () => {
    const state = battleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      enemyCC: { stunSkipTurns: 4 },
      pendingTurnStartEffects: [
        {
          remainingTurns: 1,
          effects: [{ kind: "repeat-over-turns", remainingTurns: 2, effects: [{ kind: "heal", amount: 4 }] }],
          sourceCard: { id: "scheduled-remedy" },
        },
      ],
    });
    const first = endPlayerTurn(state);
    expect(first.state.playerHealth).toBe(10);
    expect(first.state.pendingTurnStartEffects).toEqual([
      { remainingTurns: 2, effects: [{ kind: "heal", amount: 4 }], sourceCard: { id: "scheduled-remedy" } },
    ]);
    const second = endPlayerTurn(first.state);
    expect(second.state.playerHealth).toBe(14);
    expect(second.state.pendingTurnStartEffects).toEqual([
      { remainingTurns: 1, effects: [{ kind: "heal", amount: 4 }], sourceCard: { id: "scheduled-remedy" } },
    ]);
    const third = endPlayerTurn(second.state);
    expect(third.state.playerHealth).toBe(18);
    expect(third.state.pendingTurnStartEffects).toEqual([]);
    expect(state.pendingTurnStartEffects[0]?.remainingTurns).toBe(1);
  });

  it("repeats a pulse on each of the remaining player turns", () => {
    const state = battleState({
      enemyHealth: 30,
      pendingTurnStartEffects: [{ remainingTurns: 2, effects: [{ kind: "damage", damageType: "freeze", amount: 2 }] }],
    });
    const first = endPlayerTurn(state);
    expect(first.state.pendingTurnStartEffects).toEqual([
      { remainingTurns: 1, effects: [{ kind: "damage", damageType: "freeze", amount: 2 }] },
    ]);
    expect(first.state.enemyHealth).toBe(28);
    expect(first.state.enemyStatuses.freeze).toBe(2);
    const second = endPlayerTurn(first.state);
    expect(second.state.pendingTurnStartEffects).toEqual([]);
    expect(second.state.enemyHealth).toBe(26);
  });

  it("does not crit or consume nextHitCrit on delayed pulses", () => {
    const state = battleState({
      enemyHealth: 30,
      flags: { nextHitCrit: true },
      pendingTurnStartEffects: [{ remainingTurns: 1, effects: [{ kind: "damage", damageType: "freeze", amount: 2 }] }],
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyHealth).toBe(28);
    expect(result.state.flags.nextHitCrit).toBe(true);
  });
});

describe("terminal battle turns", () => {
  it.each([false, true])("Lifegiving cannot revive lethal damage (Poison: %s)", (poison) => {
    const state = battleState({
      playerHealth: 1,
      deathsDoorUsed: true,
      deathsDoorActive: false,
      gearEffects: { healthPerTurn: 1 },
      playerStatuses: { poison: poison ? 2 : 0 },
      enemyCC: { stunSkipTurns: poison ? 1 : 0 },
      rng: () => 0.99,
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerHealth).toBe(0);
    expect(result.state.turn).toBe(state.turn);
    expect(result.state.hand).toEqual(state.hand);
  });
});

it("stops enemy trait pulses when Poison defeats the hero", () => {
  const base = patchBattleState();
  const state = battleState({
    playerHealth: 1,
    deathsDoorUsed: true,
    deathsDoorActive: false,
    currentEnemy: { ...base.currentEnemy, traits: [ENCOUNTER_TRAITS.caustic.enemyTrait] },
    playerStatuses: { ...base.playerStatuses, poison: 2, armor: 5 },
    rng: () => 0.99,
  });
  const result = endPlayerTurn(state).state;
  expect(result.playerHealth).toBe(0);
  expect(result.playerStatuses.poison).toBe(1);
  expect(result.playerStatuses.armor).toBe(4);
  expect(result.battleMetrics?.enemyAbilityActivations.caustic ?? 0).toBe(0);
  expect(result.turn).toBe(state.turn);
});
