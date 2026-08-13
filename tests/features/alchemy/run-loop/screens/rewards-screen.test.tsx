// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RewardsScreen } from "@/features/alchemy/run-loop/screens/rewards-screen";
import { createEmptyRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import type { BattleCard } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { getRunSessionStoreView, resetRunSessionSlice } from "../../../../helpers/run-domain-store-test";

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

afterEach(() => {
  cleanup();
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
        onOpenMenu={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /select slash/i }));

    expect(onSelectReward).toHaveBeenCalledWith("slash");
    expect(getRunSessionStoreView().rewardState.selectedId).toBeNull();
  });

  it("disables claim actions while a reward claim is in flight", () => {
    render(
      <RewardsScreen
        rewardState={{
          ...getRunSessionStoreView().rewardState,
          selectedId: "slash",
        }}
        claimInFlight
        onAddReward={vi.fn()}
        onSkip={vi.fn()}
        onSelectReward={vi.fn()}
        onOpenMenu={vi.fn()}
      />,
    );

    const addButtons = screen.getAllByRole("button", { name: /add card/i });
    expect(addButtons.length).toBeGreaterThan(0);
    for (const button of addButtons) {
      expect(button).toHaveProperty("disabled", true);
    }
    const skipButtons = screen.getAllByRole("button", { name: /skip/i });
    expect(skipButtons.length).toBeGreaterThan(0);
    for (const button of skipButtons) {
      expect(button).toHaveProperty("disabled", true);
    }
  });

  it("shows Found resources with the reward choices", () => {
    render(
      <RewardsScreen
        rewardState={{
          ...createEmptyRewardState(),
          rewardType: "card",
          choices: [testCard, { ...testCard, id: "bash", title: "Bash" }],
          gold: 13,
          materials: { ...emptyInventory(), herbs: 1 },
        }}
        onAddReward={vi.fn()}
        onSkip={vi.fn()}
        onSelectReward={vi.fn()}
        onOpenMenu={vi.fn()}
      />,
    );

    expect(screen.getByText("Found")).toBeTruthy();
  });

  it("places the hamburger menu trigger in the screen header", () => {
    render(
      <RewardsScreen
        rewardState={getRunSessionStoreView().rewardState}
        onAddReward={vi.fn()}
        onSkip={vi.fn()}
        onSelectReward={vi.fn()}
        onOpenMenu={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Open rewards menu" })).toBeTruthy();
  });
});
