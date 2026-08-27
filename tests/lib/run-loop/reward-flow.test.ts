import { describe, expect, it } from "vitest";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { ENEMY_TYPES } from "@/lib/game-data";
import { finalizeRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import { DESTINATIONS, REWARD_ROUTES } from "@/lib/routing";

function makeCard(id: string) {
  return { id, name: id, cost: 1, effects: [] } as unknown as ReturnType<
    typeof createEmptyRewardState
  >["choices"][number];
}

describe("reward-flow", () => {
  it("clears reward and routes to companion when companion cards pending", () => {
    const rewardState = {
      ...createEmptyRewardState([DESTINATIONS.CARD_SHOP]),
      rewardType: "card" as const,
      choices: [makeCard("strike")],
      selectedId: null,
      lastVictoryEnemyType: ENEMY_TYPES.NORMAL,
      lastVictoryContentSystem: CONTENT_SYSTEMS.CAMPAIGN,
    };
    const companionCards = [makeCard("wolf")] as unknown as typeof rewardState.choices;
    const result = finalizeRewardState({ rewardState, companionRewardCards: companionCards as never });
    expect(result.route).toBe(REWARD_ROUTES.COMPANION_REWARD);
    expect(result.clearCompanionRewardCards).toBe(true);
    expect(result.nextRewardState.choices).toEqual(companionCards);
  });

  it("routes labyrinth victories to labyrinth map regardless of enemy type", () => {
    const rewardState = {
      ...createEmptyRewardState(),
      rewardType: "card" as const,
      choices: [],
      lastVictoryEnemyType: ENEMY_TYPES.BOSS,
      lastVictoryContentSystem: CONTENT_SYSTEMS.LABYRINTH,
    };
    const result = finalizeRewardState({ rewardState, companionRewardCards: null });
    expect(result.route).toBe(REWARD_ROUTES.LABYRINTH_MAP);
  });

  it("routes wildwood to wildwood victory and campaign boss to act complete", () => {
    const wildwoodState = {
      ...createEmptyRewardState(),
      rewardType: "card" as const,
      choices: [],
      lastVictoryEnemyType: ENEMY_TYPES.NORMAL,
      lastVictoryContentSystem: CONTENT_SYSTEMS.WILDWOOD,
    };
    expect(finalizeRewardState({ rewardState: wildwoodState, companionRewardCards: null }).route).toBe(
      REWARD_ROUTES.WILDWOOD_VICTORY,
    );

    const bossState = {
      ...createEmptyRewardState(),
      rewardType: "card" as const,
      choices: [],
      lastVictoryEnemyType: ENEMY_TYPES.BOSS,
      lastVictoryContentSystem: CONTENT_SYSTEMS.CAMPAIGN,
    };
    expect(finalizeRewardState({ rewardState: bossState, companionRewardCards: null }).route).toBe(
      REWARD_ROUTES.ACT_COMPLETE,
    );
  });

  it("resolves selectedChoice by selectedId", () => {
    const card = makeCard("strike");
    const rewardState = {
      ...createEmptyRewardState(),
      rewardType: "card" as const,
      choices: [card as never],
      selectedId: "strike",
      lastVictoryEnemyType: ENEMY_TYPES.NORMAL,
      lastVictoryContentSystem: CONTENT_SYSTEMS.CAMPAIGN,
    };
    const result = finalizeRewardState({ rewardState, companionRewardCards: null });
    expect(result.selectedChoice).toBeTruthy();
  });
});
