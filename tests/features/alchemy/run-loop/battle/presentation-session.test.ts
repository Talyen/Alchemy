import { afterEach, expect, it, vi } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { createBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { clearBattlePresentationUi, teardownRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import { defaultBattleState } from "@/lib/battle";
import { COMBAT_TEXT_LIFETIME_MS, SHAKE_DURATION_MS } from "@/lib/game-constants";
import { initializeBattleForTest } from "../../../../helpers/run-domain-store-test";

afterEach(() => vi.useRealTimers());

it("binds visibility, clearing, teardown and timer disposal to the owning session", async () => {
  vi.useFakeTimers();
  const firstSession = createGameSession();
  const secondSession = createGameSession();
  const first = createBattlePresentationStore(firstSession);
  const second = createBattlePresentationStore(secondSession);
  const events = [{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }] as const;
  try {
    dispatchRunSessionCommand(
      (tx) => {
        initializeBattleForTest(tx, defaultBattleState());
        setScreen(tx, "battle");
        return acceptCommand();
      },
      undefined,
      firstSession,
    );
    first.getState().showCombatTexts([...events]);
    second.getState().showCombatTexts([...events]);
    expect(first.getState().floatingCombatBursts).toHaveLength(1);
    expect(second.getState().floatingCombatBursts).toEqual([]);
    second.getState().setHiddenHandCardKeys(() => ["second-card"]);
    clearBattlePresentationUi(firstSession);
    expect(first.getState().floatingCombatBursts).toEqual([]);
    expect(second.getState().hiddenHandCardKeys).toEqual(["second-card"]);
    first.getState().setDisplayedBattle(defaultBattleState());
    teardownRun(firstSession);
    expect(first.getState().displayedBattle).toBeNull();
    expect(second.getState().hiddenHandCardKeys).toEqual(["second-card"]);
    second.getState().shakeEnemy();
    const changed = vi.fn();
    const unsubscribe = second.subscribe(changed);
    await secondSession.dispose();
    expect(second.getState().enemyShaking).toBe(false);
    expect(second.getState().hiddenHandCardKeys).toEqual([]);
    changed.mockClear();
    await vi.advanceTimersByTimeAsync(COMBAT_TEXT_LIFETIME_MS + SHAKE_DURATION_MS);
    expect(changed).not.toHaveBeenCalled();
    unsubscribe();
  } finally {
    await firstSession.dispose();
    await secondSession.dispose();
  }
});
