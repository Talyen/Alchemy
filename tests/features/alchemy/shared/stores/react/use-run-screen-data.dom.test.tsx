import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useRunScreenData } from "@/features/alchemy/shared/stores/react/use-run-screen-data";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { cardById } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { mutateGameplayForTest, resetAllTestStores } from "../../../../../helpers/run-domain-store-test";

afterEach(() => {
  cleanup();
  resetAllTestStores();
});

it("keeps the reward subscription stable and updates its preview when the stockpile changes", () => {
  resetAllTestStores();
  mutateGameplayForTest((draft) => {
    draft.run.initialized = true;
    draft.session.activity = { kind: "rewards" };
    draft.session.rewardFlow.state = {
      ...createEmptyRewardState(),
      choices: [cardById.slash!],
      lastVictoryContentSystem: "campaign",
      lastVictoryEnemyType: "boss",
    };
  });
  const { result, rerender } = renderHook(() => useRunScreenData("rewards"));
  expect(result.current.rewardMaterials).toMatchObject({ wood: 4, stone: 4 });
  const preview = result.current;
  rerender();
  expect(result.current).toBe(preview);
  act(() =>
    mutateGameplayForTest((draft) => {
      draft.runProfile.materialInventory = { ...emptyInventory(), wood: 3 };
    }),
  );
  expect(result.current.rewardMaterials).toMatchObject({ wood: 1, stone: 4 });
});
