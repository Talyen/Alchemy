import { describe, expect, it, vi } from "vitest";
import {
  afterCampaignCharacterResolved,
  getPreviousDestination,
  tryStartNoviceCampaignBattle,
} from "@/features/alchemy/run-loop/navigation/run-navigation-helpers";
import { DEFAULT_BATTLE_ENEMY_TYPE, DEFAULT_CAMPAIGN_DIFFICULTY_ID } from "@/lib/game-constants";
import { getStartingDeck } from "@/lib/game-data";

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
      getDifficultyModifiers: vi.fn(
        (_charId: import("@/lib/game-data").CharacterId, _diffId: import("@/lib/game-data").DifficultyId) =>
          [{ kind: "start-block" as const, amount: 5 }] as Array<
            import("@/lib/game-data/difficulties").DifficultyModifier
          >,
      ),
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
    expect(deps.onStartBattle).toHaveBeenCalledWith(freshDeck, 99, DEFAULT_BATTLE_ENEMY_TYPE, [
      { kind: "start-block", amount: 5 },
    ]);
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
