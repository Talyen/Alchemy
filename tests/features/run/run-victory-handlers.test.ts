import { describe, expect, it, beforeEach, vi } from "vitest";
import { createRunFlowHandlers } from "@/features/alchemy/run-loop/run/run-flow-handlers";
import { useHomesteadStore } from "@/features/alchemy/shared/stores/homestead-store";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import {
  getBattleStoreView,
  resetRunBattleSlice,
  resetRunProgressSlice,
  setRunProgress,
} from "../../helpers/run-domain-store-test";
import { makeFlowHandlerDeps } from "../../helpers/run-flow-handler-deps";

vi.mock("@/lib/audio", () => ({
  playVictory: vi.fn(),
  stopAllSfx: vi.fn(),
}));

vi.mock("@/features/alchemy/shared/stores/run-transitions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/stores/run-transitions")>();
  return {
    ...actual,
    applyRunDefeatTeardown: vi.fn(),
  };
});

import { applyRunDefeatTeardown } from "@/features/alchemy/shared/stores/run-transitions";

beforeEach(() => {
  vi.clearAllMocks();
  resetRunBattleSlice();
  useHomesteadStore.setState(useHomesteadStore.getInitialState());
  resetRunProgressSlice();
  resetTransientRunUi();
});

function makeHandlers() {
  return createRunFlowHandlers(makeFlowHandlerDeps());
}

describe("createRunFlowHandlers victory paths", () => {
  it("awardRunEndMaterials applies homestead herb bonus", () => {
    setRunProgress({ roomsEncountered: 4, currentAct: 1 });
    useHomesteadStore.setState((s) => ({
      effects: { ...s.effects, herbFindBonus: 1 },
    }));
    const woodBefore = useHomesteadStore.getState().materialInventory.wood;

    const mats = makeHandlers().awardRunEndMaterials();

    expect(mats.herbs).toBeGreaterThan(0);
    expect(useHomesteadStore.getState().materialInventory.wood).toBeGreaterThanOrEqual(woodBefore);
  });

  it("clearCombatState clears battle flag", () => {
    getBattleStoreView().setHasActiveBattle(true);
    makeHandlers().clearCombatState();
    expect(getBattleStoreView().hasActiveBattle).toBe(false);
  });

  it("handleBattleDefeat invokes applyRunDefeatTeardown for campaign", () => {
    setRunProgress({ contentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN });
    const handlers = makeHandlers();
    handlers.handleBattleDefeat();
    expect(applyRunDefeatTeardown).toHaveBeenCalledWith(
      expect.objectContaining({
        awardRunEndMaterials: handlers.awardRunEndMaterials,
        finalizeRunXP: expect.any(Function),
        clearCombatState: handlers.clearCombatState,
      }),
    );
  });

  it("handleBattleDefeat routes labyrinth to map without teardown", () => {
    setRunProgress({ contentSystemType: CONSTANTS.CONTENT_SYSTEMS.LABYRINTH });
    const navigateTo = vi.fn();
    const handlers = createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo }));
    handlers.handleBattleDefeat();
    expect(applyRunDefeatTeardown).not.toHaveBeenCalled();
    expect(navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.LABYRINTH_MAP);
  });
});
