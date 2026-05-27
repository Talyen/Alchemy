import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  afterCampaignCharacterResolved,
  applyRunDefeatTeardown,
  getPreviousDestination,
  tryStartNoviceCampaignBattle,
} from "@/features/alchemy/navigation/run-navigation-helpers";
import { DEFAULT_BATTLE_ENEMY_TYPE, DEFAULT_CAMPAIGN_DIFFICULTY_ID } from "@/lib/game-constants";
import { getStartingDeck } from "@/lib/game-data";

vi.mock("@/lib/audio", () => ({
  stopAllSfx: vi.fn(),
  playDefeat: vi.fn(),
}));

import { playDefeat, stopAllSfx } from "@/lib/audio";

describe("getPreviousDestination", () => {
  it("returns undefined at the start of an act", () => {
    expect(getPreviousDestination(0, ["Normal Combat"])).toBeUndefined();
  });

  it("returns the last completed destination when advancing", () => {
    expect(getPreviousDestination(2, ["Campfire", "Normal Combat"])).toBe("Normal Combat");
  });
});

describe("tryStartNoviceCampaignBattle", () => {
  const freshDeck = getStartingDeck("knight");

  function makeDeps(overrides: Partial<Parameters<typeof tryStartNoviceCampaignBattle>[1]> = {}) {
    return {
      completedDifficulties: {},
      initializeRunForDifficulty: vi.fn(() => ({ freshDeck, totalStartGold: 99 })),
      getDifficultyModifiers: vi.fn(() => [{ id: "test-mod", title: "Test", description: "" }]),
      onStartBattle: vi.fn(),
      navigateToBattle: vi.fn(),
      ...overrides,
    };
  }

  it("starts novice campaign battle when difficulty not completed", () => {
    const deps = makeDeps();
    const started = tryStartNoviceCampaignBattle("knight", deps);

    expect(started).toBe(true);
    expect(deps.initializeRunForDifficulty).toHaveBeenCalledWith("knight", DEFAULT_CAMPAIGN_DIFFICULTY_ID);
    expect(deps.onStartBattle).toHaveBeenCalledWith(
      freshDeck,
      99,
      DEFAULT_BATTLE_ENEMY_TYPE,
      [{ id: "test-mod", title: "Test", description: "" }],
    );
    expect(deps.navigateToBattle).toHaveBeenCalledOnce();
  });

  it("returns false when novice difficulty already completed", () => {
    const deps = makeDeps({
      completedDifficulties: { knight: [DEFAULT_CAMPAIGN_DIFFICULTY_ID] },
    });
    const started = tryStartNoviceCampaignBattle("knight", deps);

    expect(started).toBe(false);
    expect(deps.onStartBattle).not.toHaveBeenCalled();
    expect(deps.navigateToBattle).not.toHaveBeenCalled();
  });
});

describe("afterCampaignCharacterResolved", () => {
  it("skips onContinue when novice auto-start runs", () => {
    const onContinue = vi.fn();
    afterCampaignCharacterResolved(
      "knight",
      {
        completedDifficulties: {},
        initializeRunForDifficulty: vi.fn(() => ({ freshDeck: getStartingDeck("knight"), totalStartGold: 0 })),
        getDifficultyModifiers: vi.fn(() => []),
        onStartBattle: vi.fn(),
        navigateToBattle: vi.fn(),
      },
      onContinue,
    );
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("calls onContinue when novice already completed", () => {
    const onContinue = vi.fn();
    afterCampaignCharacterResolved(
      "knight",
      {
        completedDifficulties: { knight: [DEFAULT_CAMPAIGN_DIFFICULTY_ID] },
        initializeRunForDifficulty: vi.fn(),
        getDifficultyModifiers: vi.fn(),
        onStartBattle: vi.fn(),
        navigateToBattle: vi.fn(),
      },
      onContinue,
    );
    expect(onContinue).toHaveBeenCalledOnce();
  });
});

describe("applyRunDefeatTeardown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("awards materials, finalizes XP, stops audio, and clears combat", () => {
    const awardRunEndMaterials = vi.fn();
    const finalizeRunXP = vi.fn();
    const clearCombatState = vi.fn();

    applyRunDefeatTeardown({ awardRunEndMaterials, finalizeRunXP, clearCombatState });

    expect(awardRunEndMaterials).toHaveBeenCalledOnce();
    expect(finalizeRunXP).toHaveBeenCalledOnce();
    expect(clearCombatState).toHaveBeenCalledOnce();
    expect(stopAllSfx).toHaveBeenCalledOnce();
    expect(playDefeat).toHaveBeenCalledOnce();
  });
});
