import { describe, expect, it } from "vitest";
import { endPlayerTurn, recoverLegacyEnemyPhase } from "@/lib/battle/enemy-turn";
import type { BattleState, EnemyStatusValues } from "@/lib/battle/types";
import { isPlayerDefeated } from "@/lib/battle/types";
import { defaultTalentEffects } from "@/lib/battle";
import { makeTestBattleState, makeTestCard } from "../../fixtures/battle";
import type { BestiaryEntry } from "@/lib/game-data";
import {
  defaultCcState,
  defaultEnemyMitigation,
  defaultEnemyStatusValues,
  defaultPlayerStatusValues,
} from "../../fixtures/default-battle-state";
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
    attackEffects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 5 }],
  };
}

const emptyStatuses: EnemyStatusValues = defaultEnemyStatusValues();
const emptyPlayerStatuses = defaultPlayerStatusValues();

function battleState(overrides: Partial<BattleState> = {}): BattleState {
  return makeTestBattleState({
    enemyHealth: 50,
    enemyMaxHealth: 50,
    enemyStatuses: { ...emptyStatuses },
    playerStatuses: { ...emptyPlayerStatuses },
    mana: 4,
    maxMana: 4,
    enemyAttackEffects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 10 }],
    currentEnemy: baseEnemy("test-enemy"),
    talentEffects: defaultTalentEffects,
    ...overrides,
  });
}

describe("endPlayerTurn - haste branch", () => {
  it("skips enemy phase entirely when player has haste", () => {
    const state = battleState({ playerStatuses: { ...emptyPlayerStatuses, haste: 1 } });
    const result = endPlayerTurn(state);
    expect(result.enemyPerformedAttack).toBe(false);
    expect(result.playerTurnSkipped).toBe(false);
    expect(result.state.turnPhase).toBe("player");
  });

  it("decrements haste stack", () => {
    const state = battleState({ playerStatuses: { ...emptyPlayerStatuses, haste: 2 } });
    const result = endPlayerTurn(state);
    const { haste } = result.state.playerStatuses;
    expect(haste).toBe(1);
  });

  it("player health unchanged on haste turn", () => {
    const state = battleState({ playerStatuses: { ...emptyPlayerStatuses, haste: 1 }, playerHealth: 20 });
    const result = endPlayerTurn(state);
    expect(result.state.playerHealth).toBe(20);
  });

  it("holds both blocks across a haste turn — no attack window elapsed", () => {
    const state = battleState({
      playerStatuses: { ...emptyPlayerStatuses, haste: 1, block: 10 },
      enemyMitigation: defaultEnemyMitigation({ block: 8 }),
    });
    const result = endPlayerTurn(state);
    expect(result.kind).toBe("haste");
    expect(result.state.playerStatuses.block).toBe(10);
    expect(result.state.enemyMitigation.block).toBe(8);
  });

  it("decays each block exactly once across a full haste chain", () => {
    const first = endPlayerTurn(
      battleState({
        playerStatuses: { ...emptyPlayerStatuses, haste: 1, block: 30 },
        enemyMitigation: defaultEnemyMitigation({ block: 8 }),
      }),
    );
    // Extra player turn ends into a real enemy phase: enemy block halves at phase
    // start, player block halves after absorbing the enemy's attack window.
    const second = endPlayerTurn(first.state);
    expect(second.enemyPerformedAttack).toBe(true);
    expect(second.state.enemyMitigation.block).toBe(4);
    expect(second.state.playerStatuses.block).toBe(10);
  });
});

describe("endPlayerTurn - CC skip branch", () => {
  it("skips attack when enemy is stunned", () => {
    const state = battleState({ enemyCC: defaultCcState({ stunSkipTurns: 1 }) });
    const result = endPlayerTurn(state);
    expect(result.enemyPerformedAttack).toBe(false);
  });

  it("skips attack when enemy is frozen", () => {
    const state = battleState({ enemyCC: defaultCcState({ freezeSkipTurns: 1 }) });
    const result = endPlayerTurn(state);
    expect(result.enemyPerformedAttack).toBe(false);
  });

  it("reduces skip turn counters", () => {
    const state = battleState({ enemyCC: defaultCcState({ stunSkipTurns: 2, freezeSkipTurns: 1 }) });
    const result = endPlayerTurn(state);
    expect(result.state.enemyCC.stunSkipTurns).toBe(1);
    expect(result.state.enemyCC.freezeSkipTurns).toBe(0);
  });

  it("still ticks enemy DoTs during CC skip", () => {
    const state = battleState({
      enemyCC: defaultCcState({ stunSkipTurns: 1 }),
      enemyStatuses: { ...emptyStatuses, burn: 10 },
      enemyHealth: 50,
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyHealth).toBe(40);
  });

  it("still applies enemy traits during CC skip", () => {
    const state = battleState({
      turn: 2,
      enemyCC: defaultCcState({ stunSkipTurns: 1 }),
      currentEnemy: baseEnemy("rusting-carapace"),
    });
    state.currentEnemy.traits = [{ id: "rusting-carapace", title: "Rusting Carapace", description: "" }];
    const result = endPlayerTurn(state);
    expect(result.state.enemyMitigation.forge).toBeGreaterThan(0);
  });

  it("still grants encounter-trait per-turn gains during CC skip", () => {
    const state = battleState({
      enemyCC: defaultCcState({ stunSkipTurns: 1 }),
      currentEnemy: baseEnemy("tempered"),
    });
    state.currentEnemy.traits = [{ id: "tempered", title: "Tempered", description: "" }];
    const result = endPlayerTurn(state);
    expect(result.enemyPerformedAttack).toBe(false);
    expect(result.state.enemyMitigation.forge).toBe(1);
  });
});

describe("endPlayerTurn - standard branch", () => {
  it("executes enemy attack and deals damage", () => {
    const state = battleState({ playerHealth: 30 });
    const result = endPlayerTurn(state);
    expect(result.enemyPerformedAttack).toBe(true);
    expect(result.state.playerHealth).toBe(20);
  });

  it("applies player DoT after enemy attack", () => {
    const state = battleState({
      playerHealth: 50,
      playerStatuses: { ...emptyPlayerStatuses, burn: 10 },
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerHealth).toBeLessThan(50);
  });

  it("provides enemy regeneration at turn end", () => {
    const state = battleState({
      enemyRegeneration: 5,
      enemyHealth: 30,
      enemyMaxHealth: 50,
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyHealth).toBeGreaterThan(30);
  });

  it("applies enemy regeneration after player DoT during enemy resolution", () => {
    const state = battleState({
      playerHealth: 50,
      playerStatuses: { ...emptyPlayerStatuses, burn: 3 },
      enemyHealth: 40,
      enemyMaxHealth: 50,
      enemyRegeneration: 5,
    });
    const result = endPlayerTurn(state);
    expect(result.afterAttackState?.playerHealth).toBeLessThan(50);
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

  it("turns over to player phase", () => {
    const state = battleState();
    const result = endPlayerTurn(state);
    expect(result.state.turnPhase).toBe("player");
    expect(result.state.mana).toBeGreaterThan(0);
  });
});

describe("legacy enemy-phase recovery", () => {
  it("returns an old in-flight enemy save to a drawable player turn", () => {
    const held = makeTestCard({ id: "held" });
    const state = battleState({ turnPhase: "enemy", hand: [], deck: [held] });

    const recovered = recoverLegacyEnemyPhase(state);

    expect(recovered.turnPhase).toBe("player");
    expect(recovered.hand.length).toBeGreaterThan(0);
  });

  it("forces player phase even when player CC would re-enter enemy phase", () => {
    const held = makeTestCard({ id: "held" });
    const recovered = recoverLegacyEnemyPhase(
      battleState({
        turnPhase: "enemy",
        hand: [],
        deck: [held],
        playerCC: defaultCcState({ stunSkipTurns: 2 }),
      }),
    );

    expect(recovered.turnPhase).toBe("player");
  });
});

describe("endPlayerTurn — tick order", () => {
  it("ticks enemy DoT before attack when enemy survives", () => {
    const state = battleState({
      enemyHealth: 50,
      enemyStatuses: { ...emptyStatuses, burn: 10 },
      playerHealth: 30,
      deck: [
        makeTestCard({ id: "d1" }),
        makeTestCard({ id: "d2" }),
        makeTestCard({ id: "d3" }),
        makeTestCard({ id: "d4" }),
      ],
    });
    const result = endPlayerTurn(state);
    expect(result.kind).not.toBe("haste");
    if (result.kind === "haste") throw new Error("Expected an enemy-turn resolution");
    expect(result.enemyTurnStartState.enemyHealth).toBe(40);
    expect(result.enemyPerformedAttack).toBe(true);
    expect(result.state.playerHealth).toBe(20);
  });

  it("skips attack when enemy dies to DoT before attacking", () => {
    const state = battleState({
      enemyHealth: 8,
      enemyStatuses: { ...emptyStatuses, burn: 10 },
      playerHealth: 30,
      deck: [
        makeTestCard({ id: "d1" }),
        makeTestCard({ id: "d2" }),
        makeTestCard({ id: "d3" }),
        makeTestCard({ id: "d4" }),
      ],
    });
    const result = endPlayerTurn(state);
    expect(result.enemyPerformedAttack).toBe(false);
    expect(result.state.enemyHealth).toBeLessThanOrEqual(0);
  });

  it("resolves on-attack Bleed after the attack and ends the action when it defeats the enemy", () => {
    const state = battleState({
      enemyHealth: 2,
      enemyStatuses: { ...emptyStatuses, onAttackBleed: 2 },
      enemyRegeneration: 10,
      playerHealth: 30,
      playerStatuses: { ...emptyPlayerStatuses, burn: 5 },
    });

    const result = endPlayerTurn(state);

    expect(result.enemyPerformedAttack).toBe(true);
    expect(result.state.playerHealth).toBe(20);
    expect(result.state.enemyHealth).toBe(0);
    expect(result.state.enemyStatuses.onAttackBleed).toBe(0);
  });

  it("applies player DoT only after enemy attack", () => {
    const state = battleState({
      playerHealth: 30,
      playerStatuses: { ...emptyPlayerStatuses, burn: 5 },
      enemyAttackEffects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 10 }],
      deck: [
        makeTestCard({ id: "d1" }),
        makeTestCard({ id: "d2" }),
        makeTestCard({ id: "d3" }),
        makeTestCard({ id: "d4" }),
      ],
    });
    const result = endPlayerTurn(state);
    expect(result.afterAttackState?.playerHealth).toBe(20);
    expect(result.state.playerHealth).toBeLessThan(20);
  });
});

describe("endPlayerTurn — Death's Door", () => {
  it("gives grace recovery turn when player hits 0", () => {
    const state = battleState({
      playerHealth: 1,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 1,
      enemyAttackEffects: [],
      turn: 1,
    });
    const result = endPlayerTurn(state);
    expect(result.state.deathsDoorActive).toBe(true);
  });

  it("burn DoT does not kill on the enemy phase that expires Death's Door", () => {
    const state = battleState({
      playerHealth: 1,
      playerStatuses: { ...emptyPlayerStatuses, burn: 4 },
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 0,
      turn: 1,
      deck: [makeTestCard(), makeTestCard(), makeTestCard(), makeTestCard()],
    });
    const expiryTurn = endPlayerTurn(state);
    expect(expiryTurn.state.playerHealth).toBe(1);
    expect(expiryTurn.state.deathsDoorActive).toBe(false);
    expect(expiryTurn.state.playerStatuses.burn).toBe(2);

    const result = endPlayerTurn(expiryTurn.state);
    expect(result.state.playerHealth).toBe(0);
    expect(isPlayerDefeated(result.state)).toBe(true);
  });

  it("poison DoT does not kill on the enemy phase that expires Death's Door", () => {
    const state = battleState({
      playerHealth: 2,
      playerStatuses: { ...emptyPlayerStatuses, poison: 3 },
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 0,
      turn: 1,
      enemyAttackEffects: [],
      deck: [makeTestCard(), makeTestCard(), makeTestCard(), makeTestCard()],
    });
    const expiryTurn = endPlayerTurn(state);
    expect(expiryTurn.state.playerHealth).toBe(1);
    expect(expiryTurn.state.deathsDoorActive).toBe(false);

    const result = endPlayerTurn(expiryTurn.state);
    expect(result.state.playerHealth).toBe(0);
  });

  it("bleed DoT does not kill on the enemy phase that expires Death's Door", () => {
    const state = battleState({
      playerHealth: 2,
      playerStatuses: { ...emptyPlayerStatuses, bleed: 5 },
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 0,
      turn: 1,
      deck: [makeTestCard(), makeTestCard(), makeTestCard(), makeTestCard()],
    });
    const expiryTurn = endPlayerTurn(state);
    expect(expiryTurn.state.playerHealth).toBe(1);
    expect(expiryTurn.state.deathsDoorActive).toBe(false);

    const result = endPlayerTurn(expiryTurn.state);
    expect(result.state.playerHealth).toBe(0);
  });

  it("Death's Door does not re-trigger when already consumed", () => {
    const state = battleState({
      playerHealth: 3,
      deathsDoorUsed: true,
      deathsDoorActive: false,
      enemyAttackEffects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 10 }],
      deck: [makeTestCard(), makeTestCard(), makeTestCard(), makeTestCard()],
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
      playerStatuses: { ...emptyPlayerStatuses, stun: 20 },
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 1,
      turn: 1,
      deck: [makeTestCard(), makeTestCard(), makeTestCard(), makeTestCard()],
    });
    const result = endPlayerTurn(state);
    expect(result.state.turnPhase).toBe("player");
    expect(result.state.playerCC.stunSkipTurns).toBe(0);
  });

  it("multi-hit enemy cannot kill through the grace window", () => {
    const state = battleState({
      playerHealth: 2,
      enemyAttackEffects: [
        { kind: "damage" as const, damageType: "physical" as const, amount: 3 },
        { kind: "damage" as const, damageType: "physical" as const, amount: 3 },
      ],
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
      playerStatuses: { ...emptyPlayerStatuses, burn: 4 },
      enemyAttackEffects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 3 }],
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
      deck: [makeTestCard(), makeTestCard(), makeTestCard(), makeTestCard()],
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
      enemyAttackEffects: [],
      enemyHealth: 30,
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyHealth).toBe(30);
    expect(result.state.enemyStatuses.bleed).toBe(0);
  });
});

describe("endPlayerTurn — pending turn-start pulses", () => {
  it("resolves queued freeze damage at the start of the next player turn", () => {
    const state = battleState({
      enemyHealth: 30,
      enemyAttackEffects: [],
      pendingTurnStartEffects: [{ remainingTurns: 1, effects: [{ kind: "damage", damageType: "freeze", amount: 2 }] }],
    });
    const result = endPlayerTurn(state);
    expect(result.state.pendingTurnStartEffects).toEqual([]);
    expect(result.state.enemyHealth).toBe(28);
    expect(result.state.enemyStatuses.freeze).toBe(2);
  });

  it("repeats a pulse on each of the remaining player turns", () => {
    const state = battleState({
      enemyHealth: 30,
      enemyAttackEffects: [],
      pendingTurnStartEffects: [{ remainingTurns: 2, effects: [{ kind: "damage", damageType: "freeze", amount: 2 }] }],
    });
    const first = endPlayerTurn(state);
    expect(first.state.pendingTurnStartEffects).toEqual([
      { remainingTurns: 1, effects: [{ kind: "damage", damageType: "freeze", amount: 2 }] },
    ]);
    expect(first.state.enemyHealth).toBe(28);
    const second = endPlayerTurn(first.state);
    expect(second.state.pendingTurnStartEffects).toEqual([]);
    expect(second.state.enemyHealth).toBe(26);
  });

  it("does not crit or consume nextHitCrit on delayed pulses", () => {
    const state = battleState({
      enemyHealth: 30,
      enemyAttackEffects: [],
      flags: { ...makeTestBattleState().flags, nextHitCrit: true },
      pendingTurnStartEffects: [{ remainingTurns: 1, effects: [{ kind: "damage", damageType: "freeze", amount: 2 }] }],
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyHealth).toBe(28);
    expect(result.state.flags.nextHitCrit).toBe(true);
  });

  it("does not consume first-holy doubling on delayed pulses", () => {
    const state = battleState({
      enemyHealth: 30,
      enemyAttackEffects: [],
      trinketEffects: { ...makeTestBattleState().trinketEffects, firstHolyDamageDoubled: true },
      pendingTurnStartEffects: [{ remainingTurns: 1, effects: [{ kind: "damage", damageType: "holy", amount: 4 }] }],
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyHealth).toBe(26);
    expect(result.state.flags.firstHolyDamageBonusUsed).toBe(false);
  });
});
