// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
import { createEmptyTalentManifest } from "@/lib/game-data";
import { useBattleController } from "@/features/alchemy/shell/use-battle-controller";
import { useBattlePresentationStore } from "@/features/alchemy/shared/stores/battle-presentation-store";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { makeRunController, makeTalentController } from "../../helpers/run-controller";
import {
  getBattleStoreView,
  getNavigationStoreView,
  resetRunBattleSlice,
  resetRunProgressSlice,
} from "../../helpers/run-domain-store-test";

vi.mock("@/lib/audio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audio")>();
  return {
    ...actual,
    playGoldGain: vi.fn(),
    playGoldSpend: vi.fn(),
    stopAllSfx: vi.fn(),
  };
});

beforeEach(() => {
  resetRunProgressSlice();
  resetRunBattleSlice();
  resetTransientRunUi();
});

function renderBattleController(screen: Screen = ROUTE_SCREENS.BATTLE) {
  return renderHook(
    ({ screen: currentScreen }) =>
      useBattleController({
        run: makeRunController(),
        talents: makeTalentController(),
        autoEndTurn: false,
        homesteadEffectsRef: { current: createEmptyTalentManifest() },
        screen: currentScreen,
        setHoveredCardId: vi.fn(),
      }),
    { initialProps: { screen } },
  );
}

describe("useBattleController", () => {
  it("startBattle marks combat active and exposes battle state", () => {
    const { result, rerender } = renderBattleController();

    act(() => {
      result.current.startBattle();
      rerender({ screen: ROUTE_SCREENS.BATTLE });
    });

    expect(getBattleStoreView().hasActiveBattle).toBe(true);
    expect(result.current.battleState.playerHealth).toBeGreaterThan(0);
    expect(result.current.battleState).not.toEqual(defaultBattleState());
  });

  it("clears floating combat text when leaving battle screen with active combat", async () => {
    vi.useFakeTimers();
    getBattleStoreView().setHasActiveBattle(true);
    getNavigationStoreView().setScreen(ROUTE_SCREENS.BATTLE);

    const { rerender } = renderBattleController(ROUTE_SCREENS.BATTLE);

    useBattlePresentationStore.getState().showCombatTexts([
      { target: "enemy", kind: "damage", stat: "health", amount: 5 },
    ]);
    await vi.advanceTimersByTimeAsync(0);
    expect(useBattlePresentationStore.getState().floatingCombatTexts).toHaveLength(1);

    act(() => {
      rerender({ screen: ROUTE_SCREENS.COLLECTION });
    });

    expect(useBattlePresentationStore.getState().floatingCombatTexts).toEqual([]);
    vi.useRealTimers();
  });
});
