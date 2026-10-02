import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RewardsScreen } from "@/features/alchemy/run-loop/screens/rewards-screen";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { type BattleCard } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { setRewardState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { resetRunSessionSlice } from "../../../../helpers/run-domain-store-test";

const testCard: BattleCard = {
  id: "slash",
  title: "Slash",
  descriptionLines: ["Deal 6 damage."],
  art: "",
  cost: 1,
  effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
};

beforeEach(() => {
  useUiStore.setState({ hoveredCardId: null, shimmerState: null, plasmaInteraction: null });
  resetRunSessionSlice();
  dispatchRunSessionCommand((draft) =>
    setRewardState(draft, {
      ...createEmptyRewardState(),
      rewardType: "card",
      choices: [testCard],
    }),
  );
});

afterEach(() => {
  cleanup();
});

describe("RewardsScreen", () => {
  it("routes reward selection through controller action instead of mutating the store directly", async () => {
    const user = userEvent.setup();
    const onClaimReward = vi.fn();

    render(
      <RewardsScreen rewardState={readRunSession().rewardFlow.state} onSkip={vi.fn()} onClaimReward={onClaimReward} />,
    );

    await user.click(screen.getByRole("button", { name: /select slash/i }));

    expect(onClaimReward).toHaveBeenCalledWith("slash");
    expect(readRunSession().rewardFlow.state.selectedId).toBeNull();
  });

  it("disables claim actions while a reward claim is in flight", () => {
    render(
      <RewardsScreen
        rewardState={{
          ...readRunSession().rewardFlow.state,
          selectedId: "slash",
        }}
        claimInFlight
        onSkip={vi.fn()}
        onClaimReward={vi.fn()}
      />,
    );

    const addButtons = screen.getAllByRole("button", { name: /select slash/i });
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
        onSkip={vi.fn()}
        onClaimReward={vi.fn()}
      />,
    );

    expect(screen.getByText("+13")).toBeTruthy();
  });

  it("swaps reward choices with their content after the outgoing fade", async () => {
    const { rerender } = render(
      <RewardsScreen rewardState={readRunSession().rewardFlow.state} onSkip={vi.fn()} onClaimReward={vi.fn()} />,
    );

    expect(screen.getByRole("heading", { name: "Choose a Reward" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /select slash/i })).toBeTruthy();

    rerender(
      <RewardsScreen
        rewardState={{
          ...createEmptyRewardState(),
          rewardType: "trinket",
          choices: [
            {
              id: "lucky-coin",
              title: "Lucky Coin",
              descriptionLines: ["Gain 5 gold."],
              art: "",
              effects: {},
            },
          ],
        }}
        onSkip={vi.fn()}
        onClaimReward={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /select slash/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /select lucky coin/i })).toBeNull();
    expect(await screen.findByRole("button", { name: /select lucky coin/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Choose a Reward" })).toBeTruthy();

    rerender(
      <RewardsScreen
        rewardState={{
          ...createEmptyRewardState(),
          rewardType: "gear",
          choices: [{ instanceId: "basic-sword", definitionId: "longsword-basic", affixes: [] }],
        }}
        onSkip={vi.fn()}
        onClaimReward={vi.fn()}
      />,
    );
    expect(await screen.findByRole("button", { name: /select longsword/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Choose a Reward" })).toBeTruthy();
  });

  it("shows card effect description on hover and keyboard focus of a reward choice", async () => {
    render(<RewardsScreen rewardState={readRunSession().rewardFlow.state} onSkip={vi.fn()} onClaimReward={vi.fn()} />);

    const button = screen.getByRole("button", { name: /select slash/i });
    const wrapper = button.parentElement as HTMLElement;
    fireEvent.mouseEnter(wrapper);

    await waitFor(() => {
      const panel = document.querySelector(".hover-popup-panel[data-visible]");
      expect(panel?.textContent).toContain("Deal");
      expect(panel?.textContent).toContain("6");
    });

    fireEvent.mouseLeave(wrapper);
    await waitFor(() => {
      expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeNull();
    });

    button.focus();
    fireEvent.focus(button);
    await waitFor(() => {
      expect(document.querySelector(".hover-popup-panel[data-visible]")?.textContent).toContain("Deal");
    });
  });
});
