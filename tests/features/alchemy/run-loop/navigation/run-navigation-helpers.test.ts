import { describe, expect, it, vi } from "vitest";
import {
  afterCampaignCharacterResolved,
  tryStartNoviceCampaignBattle,
} from "@/features/alchemy/shared/run-flow/campaign-start";
import { getPreviousDestination } from "@/features/alchemy/shared/run-flow/resolve-available-destinations";
import { DEFAULT_BATTLE_ENEMY_TYPE, DEFAULT_CAMPAIGN_DIFFICULTY_ID } from "@/lib/game-constants";

describe("getPreviousDestination", () => {
  it("returns undefined at the start of an act", () => {
    expect(getPreviousDestination(0, ["Normal Combat"])).toBeUndefined();
  });

  it("returns the last completed destination when advancing", () => {
    expect(getPreviousDestination(2, ["Campfire", "Normal Combat"])).toBe("Normal Combat");
  });
});

describe("tryStartNoviceCampaignBattle", () => {
  function makeDeps(overrides: Partial<Parameters<typeof tryStartNoviceCampaignBattle>[1]> = {}) {
    return {
      completedDifficulties: {},
      initializeRunForDifficulty: vi.fn(),
      getDifficultyModifiers: vi.fn(
        (_charId: import("@/lib/game-data").CharacterId, _diffId: import("@/lib/game-data").DifficultyId) =>
          [{ kind: "start-block" as const, amount: 5 }] as Array<
            import("@/lib/game-data/difficulties").DifficultyModifier
          >,
      ),
      startBattle: vi.fn(),
      navigateToBattle: vi.fn(),
      ...overrides,
    };
  }

  it("starts novice campaign battle when difficulty not completed", () => {
    const deps = makeDeps();
    const started = tryStartNoviceCampaignBattle("knight", deps);

    expect(started).toBe(true);
    expect(deps.initializeRunForDifficulty).toHaveBeenCalledWith("knight", DEFAULT_CAMPAIGN_DIFFICULTY_ID);
    expect(deps.startBattle).toHaveBeenCalledWith({
      enemyType: DEFAULT_BATTLE_ENEMY_TYPE,
      modifiers: [{ kind: "start-block", amount: 5 }],
      enemyId: "skeleton",
    });
    expect(deps.navigateToBattle).toHaveBeenCalledOnce();
  });

  it("returns false when novice difficulty already completed", () => {
    const deps = makeDeps({
      completedDifficulties: { knight: [DEFAULT_CAMPAIGN_DIFFICULTY_ID] },
    });
    const started = tryStartNoviceCampaignBattle("knight", deps);

    expect(started).toBe(false);
    expect(deps.startBattle).not.toHaveBeenCalled();
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
        initializeRunForDifficulty: vi.fn(),
        getDifficultyModifiers: vi.fn(() => []),
        startBattle: vi.fn(),
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
        startBattle: vi.fn(),
        navigateToBattle: vi.fn(),
      },
      onContinue,
    );
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
