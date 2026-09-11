import "../../../../helpers/mock-audio";
import { beforeEach, describe, expect, it } from "vitest";
import { resolveBattleTurn } from "@/lib/battle";
import { companionLibrary } from "@/lib/game-data";
import { commitEndTurn, resumePendingBattleTransition } from "@/features/alchemy/run-loop/battle/turn-orchestration";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { initializeActiveBattle } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { resetRunDomainStore } from "../../../../helpers/run-domain-store-test";
import { patchBattleState, slashDeck, seededRng } from "../../../../fixtures/battle";
import { makeBattleTurnSession } from "./turn-orchestration-fixture";

beforeEach(resetRunDomainStore);

describe("resolved turns", () => {
  it("resolves a skipped enemy turn and the Companion before returning serializable playback", () => {
    const before = patchBattleState({
      playerHealth: 1000,
      playerMaxHealth: 1000,
      enemyHealth: 1000,
      enemyMaxHealth: 1000,
      deck: slashDeck(20),
      enemyCC: { stunSkipTurns: 1 },
      activeCompanion: companionLibrary.wolf,
    });
    const first = resolveBattleTurn(before, { rng: seededRng(24) });
    expect(first.state.turnPhase).toBe("player");
    expect(first.frames[0]?.turn.kind).toBe("skipped");
    expect(first.frames.at(-1)?.companion?.id).toBe("wolf");
    expect(first.frames.slice(0, -1).every((frame) => frame.companion === null)).toBe(true);
    expect(structuredClone(first)).toEqual(first);
    expect(resolveBattleTurn(before, { rng: seededRng(24) })).toEqual(first);
    expect(before.turn).toBe(1);
  });

  it("does not run the Companion after fatal enemy damage", () => {
    const before = patchBattleState({
      playerHealth: 1,
      deathsDoorUsed: true,
      activeCompanion: companionLibrary.wolf,
      enemyHealth: 1000,
      enemyMaxHealth: 1000,
      currentEnemy: { abilityIds: ["slash", "stab", "bash"] },
    });
    const result = resolveBattleTurn(before, { rng: () => 0.99 });
    expect(result.state.playerHealth).toBe(0);
    expect(result.frames.every((frame) => frame.companion === null)).toBe(true);
  });

  it("commits a Haste turn without leaving a logical continuation for its draw animation", () => {
    dispatchRunSessionCommand((draft) =>
      initializeActiveBattle(draft, patchBattleState({ playerStatuses: { haste: 1 }, deck: slashDeck(8) })),
    );
    const result = commitEndTurn();
    expect(result.frames[0]?.turn.kind).toBe("haste");
    expect(readGameplayState().battle.pendingBattleTransition).toBeNull();
    expect(readGameplayState().battle.battleState).toEqual(result.state);
  });
});

describe("legacy continuation compatibility", () => {
  it.each(["opening-draw", "enemy-turn"] as const)("consumes a saved %s result once without rerolling", (kind) => {
    const initial = patchBattleState();
    const resultState = patchBattleState({ turn: 4, playerHealth: 19, hand: slashDeck(3) });
    dispatchRunSessionCommand((draft) =>
      initializeActiveBattle(draft, initial, { kind, resultState, playerTurnSkipped: false }),
    );
    const counters = readGameplayState().run.activeRun.rng.counters;
    resumePendingBattleTransition(1, makeBattleTurnSession());
    const resolved = readGameplayState();
    expect(resolved.battle.battleState).toMatchObject({ turn: 4, playerHealth: 19 });
    expect(resolved.run.activeRun.rng.counters).toEqual(counters);
    expect(resolved.battle.pendingBattleTransition).toBeNull();
    resumePendingBattleTransition(1, makeBattleTurnSession());
    expect(readGameplayState()).toBe(resolved);
  });

  it("ignores a stale playback session", () => {
    dispatchRunSessionCommand((draft) =>
      initializeActiveBattle(draft, patchBattleState(), {
        kind: "opening-draw",
        resultState: patchBattleState({ turn: 4 }),
      }),
    );
    const before = readGameplayState();
    resumePendingBattleTransition(1, makeBattleTurnSession({ isCurrentBattleSession: () => false }));
    expect(readGameplayState()).toBe(before);
  });
});
