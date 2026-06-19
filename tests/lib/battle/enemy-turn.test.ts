import { describe, expect, it } from "vitest";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import type { BattleState, EnemyStatusValues } from "@/lib/battle/types";
import type { BattleCard } from "@/lib/game-data";
import { defaultTalentEffects } from "@/lib/battle";
import { createTestBattleState } from "./test-state";
import type { BestiaryEntry } from "@/lib/game-data";
import { defaultCcState, defaultPlayerStatusValues } from "../../fixtures/default-battle-state";

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "test",
    title: "Test",
    descriptionLines: [""],
    art: "",
    cost: 1,
    effects: [],
    ...overrides,
  };
}

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

const emptyStatuses: EnemyStatusValues = { burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 };
const emptyPlayerStatuses = defaultPlayerStatusValues();

function battleState(overrides: Partial<BattleState> = {}): BattleState {
  return createTestBattleState({
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

describe("endPlayerTurn â€” haste branch", () => {
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
});

describe("endPlayerTurn â€” CC skip branch", () => {
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
      enemyCC: defaultCcState({ stunSkipTurns: 1 }),
      currentEnemy: baseEnemy("rusting-carapace"),
    });
    state.currentEnemy.traits = [{ id: "rusting-carapace", title: "Rusting Carapace", description: "" }];
    const result = endPlayerTurn(state);
    expect(result.state.enemyMitigation.forge).toBeGreaterThan(0);
  });
});

describe("endPlayerTurn â€” standard branch", () => {
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
    const held = makeCard({ id: "held" });
    const state = battleState({ hand: [held], discard: [] });
    const result = endPlayerTurn(state);
    expect(result.enemyTurnStartState?.hand).toEqual([]);
    expect(result.enemyTurnStartState?.discard.some((card) => card.id === "held")).toBe(true);
  });

  it("turns over to player phase", () => {
    const state = battleState();
    const result = endPlayerTurn(state);
    expect(result.state.turnPhase).toBe("player");
    expect(result.state.mana).toBeGreaterThan(0);
  });
});

describe("endPlayerTurn â€” tick order", () => {
  it("ticks enemy DoT before attack when enemy survives", () => {
    const state = battleState({
      enemyHealth: 50,
      enemyStatuses: { ...emptyStatuses, burn: 10 },
      playerHealth: 30,
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
    });
    const result = endPlayerTurn(state);
    expect(result.enemyTurnStartState?.enemyHealth).toBe(40);
    expect(result.enemyPerformedAttack).toBe(true);
    expect(result.state.playerHealth).toBe(20);
  });

  it("skips attack when enemy dies to DoT before attacking", () => {
    const state = battleState({
      enemyHealth: 8,
      enemyStatuses: { ...emptyStatuses, burn: 10 },
      playerHealth: 30,
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
    });
    const result = endPlayerTurn(state);
    expect(result.enemyPerformedAttack).toBe(false);
    expect(result.state.enemyHealth).toBeLessThanOrEqual(0);
  });

  it("applies player DoT only after enemy attack", () => {
    const state = battleState({
      playerHealth: 30,
      playerStatuses: { ...emptyPlayerStatuses, burn: 5 },
      enemyAttackEffects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 10 }],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
    });
    const result = endPlayerTurn(state);
    expect(result.afterAttackState?.playerHealth).toBe(20);
    expect(result.state.playerHealth).toBeLessThan(20);
  });
});

describe("endPlayerTurn â€” Death's Door", () => {
  it("gives grace recovery turn when player hits 0", () => {
    const state = battleState({
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 1,
      turn: 1,
    });
    const result = endPlayerTurn(state);
    expect(result.state.deathsDoorActive).toBe(true);
  });

  it("deactivates Death's Door after grace expires", () => {
    const state = battleState({
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 0,
      turn: 1,
    });
    const result = endPlayerTurn(state);
    expect(result.state.deathsDoorActive).toBe(false);
  });

  it("burn DoT kills player on grace turn when Death's Door expires", () => {
    const state = battleState({
      playerHealth: 1,
      playerStatuses: { ...emptyPlayerStatuses, burn: 4 },
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 0,
      turn: 1,
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerHealth).toBe(0);
    expect(result.state.deathsDoorActive).toBe(false);
    expect(result.state.playerStatuses.burn).toBe(2);
  });

  it("poison DoT kills player on grace turn when Death's Door expires", () => {
    const state = battleState({
      playerHealth: 2,
      playerStatuses: { ...emptyPlayerStatuses, poison: 3 },
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 0,
      turn: 1,
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerHealth).toBe(0);
    expect(result.state.deathsDoorActive).toBe(false);
  });

  it("bleed DoT kills player on grace turn when Death's Door expires", () => {
    const state = battleState({
      playerHealth: 2,
      playerStatuses: { ...emptyPlayerStatuses, bleed: 5 },
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 0,
      turn: 1,
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerHealth).toBe(0);
    expect(result.state.deathsDoorActive).toBe(false);
  });

  it("Death's Door does not re-trigger when already consumed", () => {
    const state = battleState({
      playerHealth: 3,
      deathsDoorUsed: true,
      deathsDoorActive: false,
      enemyAttackEffects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 10 }],
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerHealth).toBe(0);
    expect(result.state.deathsDoorActive).toBe(false);
    expect(result.state.deathsDoorUsed).toBe(true);
  });

  it("CC immunity cooldown does not prevent Death's Door grace recovery turn", () => {
    const state = battleState({
      playerHealth: 0,
      playerStatuses: { ...emptyPlayerStatuses, stun: 20 },
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 1,
      turn: 1,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const result = endPlayerTurn(state);
    expect(result.state.turnPhase).toBe("player");
    expect(result.state.playerCC.stunSkipTurns).toBe(0);
  });
});
