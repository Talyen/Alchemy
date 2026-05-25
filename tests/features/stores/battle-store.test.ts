import { describe, expect, it } from "vitest";
import { useBattleStore } from "@/features/alchemy/stores/battle-store";
import { defaultBattleState } from "@/lib/battle";

describe("battle-store initialization", () => {
  it("initializes battleState as a valid BattleState (not null)", () => {
    const state = useBattleStore.getState().battleState;
    expect(state).not.toBeNull();
    expect(typeof state.playerStatuses).toBe("object");
    expect(typeof state.enemyStatuses).toBe("object");
    expect(typeof state.playerStatuses.block).toBe("number");
    expect(typeof state.enemyStatuses.poison).toBe("number");
  });

  it("initializes hasActiveBattle as false", () => {
    expect(useBattleStore.getState().hasActiveBattle).toBe(false);
  });

  it("initializes with empty card ghosts", () => {
    expect(useBattleStore.getState().cardGhosts).toEqual([]);
  });

  it("initializes with empty floating combat texts", () => {
    expect(useBattleStore.getState().floatingCombatTexts).toEqual([]);
  });

  it("initializes shaking state as false", () => {
    const s = useBattleStore.getState();
    expect(s.enemyShaking).toBe(false);
    expect(s.playerShaking).toBe(false);
    expect(s.companionShaking).toBe(false);
  });

  it("getPlayerStatusChips with initial state returns empty array (no crash)", async () => {
    const { getPlayerStatusChips, getEnemyStatusChips } = await import("@/features/alchemy/utils/battle");
    const state = useBattleStore.getState().battleState;
    expect(getPlayerStatusChips(state)).toEqual([]);
    expect(getEnemyStatusChips(state)).toEqual([]);
  });

  it("hydrates a persisted active battle", () => {
    const persisted = { ...defaultBattleState(), turn: 4, playerHealth: 9 };

    useBattleStore.getState().initializeActiveBattle(persisted);

    expect(useBattleStore.getState().hasActiveBattle).toBe(true);
    expect(useBattleStore.getState().battleState.turn).toBe(4);
    expect(useBattleStore.getState().battleState.playerHealth).toBe(9);

    useBattleStore.getState().initializeActiveBattle(null);
  });
});
