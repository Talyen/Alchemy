// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { useBattleController } from "@/features/alchemy/shell/use-battle-controller";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
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
        homesteadEffects: defaultHomesteadEffects,
        screen: currentScreen,
        setHoveredCardId: vi.fn(),
      }),
    { initialProps: { screen } },
  );
}

describe("useBattleController", () => {
  it("startBattle marks combat active without exposing battle display state", () => {
    const { result, rerender } = renderBattleController();

    act(() => {
      result.current.startBattle();
      rerender({ screen: ROUTE_SCREENS.BATTLE });
    });

    expect(getBattleStoreView().hasActiveBattle).toBe(true);
    expect(getBattleStoreView().battleState.playerHealth).toBeGreaterThan(0);
    expect(getBattleStoreView().battleState).not.toEqual(defaultBattleState());
    expect(result.current.hasActiveBattle).toBe(true);
  });

  it("startBattle restores preferred autoplay even without a playback bind", () => {
    useSettingsStore.getState().setRememberAutoplayPreference(false);
    const { result } = renderBattleController();

    act(() => {
      result.current.setAutoplayEnabled(true);
      result.current.startBattle();
    });

    expect(result.current.isAutoplayEnabled).toBe(false);
  });

  it("persists autoplay when remember is on", () => {
    useSettingsStore.getState().setRememberAutoplayPreference(true);
    const { result } = renderBattleController();

    act(() => {
      result.current.setAutoplayEnabled(true);
    });

    expect(useSettingsStore.getState().autoplayEnabled).toBe(true);
  });

  it("keeps a session autoplay toggle when leaving the battle screen", () => {
    const { result, rerender } = renderBattleController();

    act(() => {
      result.current.startBattle();
      result.current.setAutoplayEnabled(true);
      rerender({ screen: ROUTE_SCREENS.COLLECTION });
    });

    expect(result.current.isAutoplayEnabled).toBe(true);
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
});
