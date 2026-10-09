import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RewardsScreen } from "@/features/alchemy/run-loop/screens/rewards-screen";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { type BattleCard } from "@/lib/game-data";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { setRewardState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { resetRunSessionSlice } from "../../../../helpers/run-domain-store-test";
import { defaultGameSession } from "@/app/application-session";

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
  dispatchRunSessionCommand(
    (draft) =>
      acceptCommand(
        setRewardState(draft, {
          ...createEmptyRewardState(),
          rewardType: "card",
          choices: [testCard],
        }),
      ),
    undefined,
    defaultGameSession,
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
      <RewardsScreen
        rewardState={readRunSession(defaultGameSession).rewardFlow.state}
        onSkip={vi.fn()}
        onClaimReward={onClaimReward}
      />,
    );

    await user.click(screen.getByRole("button", { name: /select slash/i }));

    expect(onClaimReward).toHaveBeenCalledWith("slash");
    expect(readRunSession(defaultGameSession).rewardFlow.state.selectedId).toBeNull();
    expect(
      screen
        .getByRole("button", { name: /select slash/i })
        .closest("[data-reward-selected]")
        ?.classList.contains("reward-choice-selected"),
    ).toBe(true);
  });

  it("keeps locked rewards inspectable while blocking pointer and keyboard claims and Skip", async () => {
    const onClaimReward = vi.fn();
    const onSkip = vi.fn();
    const user = userEvent.setup();
    render(
      <RewardsScreen
        rewardState={readRunSession(defaultGameSession).rewardFlow.state}
        claimInFlight
        onSkip={onSkip}
        onClaimReward={onClaimReward}
      />,
    );

    const reward = screen.getByRole("button", { name: /select slash/i });
    expect(reward.getAttribute("aria-disabled")).toBe("true");
    await user.tab();
    expect(document.activeElement).toBe(reward);
    await user.keyboard("{Enter} ");
    await user.click(reward);
    expect(onClaimReward).not.toHaveBeenCalled();
    const skip = screen.getByRole("button", { name: /skip/i });
    expect(skip).toHaveProperty("disabled", true);
    await user.click(skip);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("swaps reward choices with their content after the outgoing fade", async () => {
    const { rerender } = render(
      <RewardsScreen
        rewardState={readRunSession(defaultGameSession).rewardFlow.state}
        onSkip={vi.fn()}
        onClaimReward={vi.fn()}
      />,
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
    render(
      <RewardsScreen
        rewardState={readRunSession(defaultGameSession).rewardFlow.state}
        onSkip={vi.fn()}
        onClaimReward={vi.fn()}
      />,
    );

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
