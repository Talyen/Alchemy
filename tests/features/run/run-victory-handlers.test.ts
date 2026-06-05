import { describe, expect, it, beforeEach, vi } from "vitest";
import { createRunVictoryHandlers } from "@/features/alchemy/run-loop/run/run-victory-handlers";
import { useBattleStore } from "@/features/alchemy/stores/battle-store";
import { useHomesteadStore } from "@/features/alchemy/stores/homestead-store";
import { useRunStore } from "@/features/alchemy/stores/run-store";
import { resetScreenStores } from "@/features/alchemy/stores/screen-store";
import { computeTalentEffects, createEmptyTalentManifest } from "@/lib/game-data";
import { CONSTANTS } from "@/features/alchemy/types";
import type { TalentStateController } from "@/features/alchemy/stores/run-store";

vi.mock("@/lib/audio", () => ({
  playVictory: vi.fn(),
  stopAllSfx: vi.fn(),
}));

vi.mock("@/features/alchemy/navigation/run-navigation-helpers", () => ({
  applyRunDefeatTeardown: vi.fn(),
}));

import { applyRunDefeatTeardown } from "@/features/alchemy/navigation/run-navigation-helpers";

beforeEach(() => {
  vi.clearAllMocks();
  useBattleStore.setState(useBattleStore.getInitialState());
  useHomesteadStore.setState(useHomesteadStore.getInitialState());
  useRunStore.setState(useRunStore.getInitialState());
  resetScreenStores();
});

function makeHandlers() {
  const rewardTransitionTimer = { current: { clearAll: vi.fn(), setTimeout: vi.fn() } };
  const setScreen = vi.fn();
  const navigateTo = vi.fn();
  const talents: TalentStateController = {
    talentXP: {},
    runTalentXP: {},
    unlockedTalents: {},
    talentEffects: computeTalentEffects(useRunStore.getState().unlockedTalents) ?? createEmptyTalentManifest(),
    awardCardXP: vi.fn(),
    unlockTalent: vi.fn(),
    unlockAllTalents: vi.fn(),
    resetUnlockedTalents: vi.fn(),
    resetRunXP: vi.fn(),
    clearPermanentData: vi.fn(),
    awardMysteryXP: vi.fn(),
    finalizeRunXP: vi.fn(),
  };

  return createRunVictoryHandlers({
    rewardTransitionTimer,
    setScreen,
    navigateTo,
    onLabyrinthFailNode: vi.fn(),
    getAvailableDestinations: () => [],
    talents,
  });
}

describe("createRunVictoryHandlers", () => {
  it("awardRunEndMaterials applies homestead herb bonus", () => {
    useRunStore.setState({ roomsEncountered: 4, currentAct: 1 });
    useHomesteadStore.setState((s) => ({
      effects: { ...s.effects, herbFindBonus: 1 },
    }));
    const woodBefore = useHomesteadStore.getState().materialInventory.wood;

    const mats = makeHandlers().awardRunEndMaterials();

    expect(mats.herbs).toBeGreaterThan(0);
    expect(useHomesteadStore.getState().materialInventory.wood).toBeGreaterThanOrEqual(woodBefore);
  });

  it("clearCombatState clears battle flag", () => {
    useBattleStore.getState().setHasActiveBattle(true);
    makeHandlers().clearCombatState();
    expect(useBattleStore.getState().hasActiveBattle).toBe(false);
  });

  it("handleBattleDefeat invokes applyRunDefeatTeardown for campaign", () => {
    useRunStore.setState({ contentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN });
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
    useRunStore.setState({ contentSystemType: CONSTANTS.CONTENT_SYSTEMS.LABYRINTH });
    const navigateTo = vi.fn();
    const handlers = createRunVictoryHandlers({
      rewardTransitionTimer: { current: { clearAll: vi.fn(), setTimeout: vi.fn() } },
      setScreen: vi.fn(),
      navigateTo,
      onLabyrinthFailNode: vi.fn(),
      getAvailableDestinations: () => [],
      talents: {
        talentXP: {},
        runTalentXP: {},
        unlockedTalents: {},
        talentEffects: computeTalentEffects({}),
        awardCardXP: vi.fn(),
        unlockTalent: vi.fn(),
        unlockAllTalents: vi.fn(),
        resetUnlockedTalents: vi.fn(),
        resetRunXP: vi.fn(),
        clearPermanentData: vi.fn(),
        awardMysteryXP: vi.fn(),
        finalizeRunXP: vi.fn(),
      },
    });
    handlers.handleBattleDefeat();
    expect(applyRunDefeatTeardown).not.toHaveBeenCalled();
    expect(navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.LABYRINTH_MAP);
  });
});
