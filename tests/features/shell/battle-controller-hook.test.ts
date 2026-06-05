// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { ROUTE_SCREENS } from "@/lib/routing";
import { createEmptyTalentManifest } from "@/lib/game-data";
import { useBattleController } from "@/features/alchemy/shell/use-battle-controller";
import { useBattleStore } from "@/features/alchemy/stores/battle-store";
import { useRunStore } from "@/features/alchemy/stores/run-store";
import { resetScreenStores } from "@/features/alchemy/stores/screen-store";
import { makeRunController, makeTalentController } from "../../helpers/run-controller";

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
  useRunStore.setState(useRunStore.getInitialState());
  useBattleStore.setState(useBattleStore.getInitialState());
  resetScreenStores();
});

function renderBattleController() {
  return renderHook(() =>
    useBattleController({
      run: makeRunController(),
      talents: makeTalentController(),
      discoveredCardIds: [],
      setDiscoveredCardIds: vi.fn(),
      setEncounteredEnemyIds: vi.fn(),
      autoEndTurn: false,
      homesteadEffectsRef: { current: createEmptyTalentManifest() },
      screen: ROUTE_SCREENS.BATTLE,
      setHoveredCardId: vi.fn(),
    }),
  );
}

describe("useBattleController", () => {
  it("startBattle marks combat active and exposes battle state", () => {
    const { result, rerender } = renderBattleController();

    act(() => {
      result.current.startBattle();
      rerender();
    });

    expect(useBattleStore.getState().hasActiveBattle).toBe(true);
    expect(result.current.battleState.playerHealth).toBeGreaterThan(0);
    expect(result.current.battleState).not.toEqual(defaultBattleState());
  });
});
