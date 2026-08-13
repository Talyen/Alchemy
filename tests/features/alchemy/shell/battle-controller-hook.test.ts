// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { useBattleController } from "@/features/alchemy/shell/use-battle-controller";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { makeRunController, makeTalentController } from "../../../helpers/run-controller";
import {
  getBattleStoreView,
  getNavigationStoreView,
  resetRunBattleSlice,
  resetRunProgressSlice,
} from "../../../helpers/run-domain-store-test";

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
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
});

function renderBattleController(screen: Screen = ROUTE_SCREENS.BATTLE) {
  return renderHook(
    ({ screen: currentScreen }) =>
      useBattleController({
        run: makeRunController(),
        talents: makeTalentController(),
        autoEndTurn: false,
        gameMenuOpen: false,
        homesteadEffects: defaultHomesteadEffects,
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

  it("clears floating combat text and other VFX when leaving battle screen with active combat", async () => {
    vi.useFakeTimers();
    getBattleStoreView().setHasActiveBattle(true);
    getNavigationStoreView().setScreen(ROUTE_SCREENS.BATTLE);

    const { rerender } = renderBattleController(ROUTE_SCREENS.BATTLE);

    useBattlePresentationStore
      .getState()
      .showCombatTexts([{ target: "enemy", kind: "damage", stat: "health", amount: 5 }]);
    useBattlePresentationStore.getState().spawnCardGhost({
      art: "test.webp",
      rect: { x: 0, y: 0, width: 10, height: 10 },
      rotation: 0,
      delay: 0,
      variant: "activate",
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(useBattlePresentationStore.getState().floatingCombatTexts).toHaveLength(1);
    expect(useBattlePresentationStore.getState().cardGhosts).toHaveLength(1);

    act(() => {
      rerender({ screen: ROUTE_SCREENS.COLLECTION });
    });

    expect(useBattlePresentationStore.getState().floatingCombatTexts).toEqual([]);
    expect(useBattlePresentationStore.getState().cardGhosts).toEqual([]);
    vi.useRealTimers();
  });

  it("resets autoplay off on a new battle when remember is off", () => {
    const { result, rerender } = renderBattleController();

    act(() => {
      result.current.startBattle();
      rerender({ screen: ROUTE_SCREENS.BATTLE });
    });
    act(() => {
      result.current.toggleAutoplay();
    });
    expect(result.current.isAutoplayEnabled).toBe(true);
    expect(useSettingsStore.getState().autoplayEnabled).toBe(false);

    act(() => {
      result.current.startBattle();
      rerender({ screen: ROUTE_SCREENS.BATTLE });
    });
    expect(result.current.isAutoplayEnabled).toBe(false);
  });

  it("restores and persists autoplay when remember is on", () => {
    useSettingsStore.getState().setRememberAutoplayPreference(true);
    useSettingsStore.getState().setAutoplayEnabled(true);
    const { result, rerender } = renderBattleController();

    act(() => {
      result.current.startBattle();
      rerender({ screen: ROUTE_SCREENS.BATTLE });
    });
    expect(result.current.isAutoplayEnabled).toBe(true);

    act(() => {
      result.current.toggleAutoplay();
    });
    expect(result.current.isAutoplayEnabled).toBe(false);
    expect(useSettingsStore.getState().autoplayEnabled).toBe(false);

    act(() => {
      result.current.toggleAutoplay();
    });
    expect(useSettingsStore.getState().autoplayEnabled).toBe(true);
  });
});
