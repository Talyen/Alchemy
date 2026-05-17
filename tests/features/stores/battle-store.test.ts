import { describe, expect, it } from "vitest";
import { useBattleStore } from "@/features/alchemy/stores/battle-store";

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

  it("initializes with no shimmer state", () => {
    expect(useBattleStore.getState().shimmerState).toBeNull();
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
});
