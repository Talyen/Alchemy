// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RewardsScreen } from "@/features/alchemy/run-loop/screens/rewards-screen";
import { createEmptyRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import type { BattleCard } from "@/lib/game-data";
import { getRunSessionStoreView, resetRunSessionSlice } from "../../helpers/run-domain-store-test";

const testCard: BattleCard = {
  id: "slash",
  title: "Slash",
  descriptionLines: ["Deal 6 damage."],
  art: "",
  cost: 1,
  effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
};

beforeEach(() => {
  resetRunSessionSlice();
  getRunSessionStoreView().setRewardState({
    ...createEmptyRewardState(),
    rewardType: "card",
    choices: [testCard],
  });
});

describe("RewardsScreen", () => {
  it("routes reward selection through controller action instead of mutating the store directly", async () => {
    const user = userEvent.setup();
    const onSelectReward = vi.fn();

    render(
      <RewardsScreen
        rewardState={getRunSessionStoreView().rewardState}
        onAddReward={vi.fn()}
        onSkip={vi.fn()}
        onSelectReward={onSelectReward}
      />,
    );

    await user.click(screen.getByRole("button", { name: /select slash/i }));

    expect(onSelectReward).toHaveBeenCalledWith("slash");
    expect(getRunSessionStoreView().rewardState.selectedId).toBeNull();
  });
});
