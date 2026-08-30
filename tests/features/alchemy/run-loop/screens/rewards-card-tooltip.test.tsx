import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";

import { RewardsScreen } from "@/features/alchemy/run-loop/screens/rewards-screen";
import { createEmptyRewardState } from "@/lib/active-run-session";
import type { BattleCard } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";

const slashCard: BattleCard = {
  id: "slash",
  title: "Slash",
  descriptionLines: ["Deal 6 damage."],
  art: "",
  cost: 1,
  effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
} as unknown as BattleCard;

const bashCard: BattleCard = {
  id: "bash",
  title: "Bash",
  descriptionLines: ["Deal 8 damage.", "Gain 2 Block."],
  art: "",
  cost: 2,
  effects: [
    { kind: "damage", damageType: "physical", amount: 8 },
    { kind: "player-status", status: "block", amount: 2 },
  ],
} as unknown as BattleCard;

function renderRewards(choices: BattleCard[] = [slashCard]) {
  const state = {
    ...createEmptyRewardState(),
    rewardType: "card" as const,
    choices,
    selectedId: null,
    gold: 0,
    materials: emptyInventory(),
  };
  return render(
    <RewardsScreen
      rewardState={state}
      onAddReward={() => {}}
      onSkip={() => {}}
      onSelectReward={() => {}}
      onOpenMenu={() => {}}
    />,
  );
}

function rewardChoiceWrapper(title: string) {
  return screen.getByRole("button", { name: new RegExp(`Select ${title}`, "i") }).parentElement as HTMLElement;
}

function panelForTitle(title: string) {
  return Array.from(document.querySelectorAll(".hover-popup-panel")).find((panel) =>
    panel.textContent?.includes(title),
  );
}

function visiblePanelForTitle(title: string) {
  return Array.from(document.querySelectorAll(".hover-popup-panel[data-visible]")).find((panel) =>
    panel.textContent?.includes(title),
  );
}

describe("RewardsScreen card hover tooltip", () => {
  beforeEach(() => {
    useUiStore.setState({ hoveredCardId: null, shimmerState: null });
  });
  afterEach(cleanup);

  it("shows card effect description on mouse hover of a reward choice", async () => {
    renderRewards([slashCard]);

    fireEvent.mouseEnter(rewardChoiceWrapper("Slash"));

    await waitFor(() => {
      expect(screen.getByText(/Deal/)).toBeTruthy();
      expect(visiblePanelForTitle("Slash")?.textContent).toMatch(/6/);
    });
  });

  it("shows tooltip for each card in a multi-choice reward", async () => {
    renderRewards([slashCard, bashCard]);

    for (const card of [slashCard, bashCard]) {
      const wrapper = rewardChoiceWrapper(card.title);
      fireEvent.mouseEnter(wrapper);
      await waitFor(() => {
        expect(visiblePanelForTitle(card.title)?.textContent).toMatch(/Deal/);
      });
      fireEvent.mouseLeave(wrapper);
      await waitFor(() => {
        const panel = panelForTitle(card.title);
        expect(panel?.textContent?.includes("Deal") ?? false).toBe(false);
      });
    }
  });

  it("shows tooltip on keyboard focus", async () => {
    renderRewards([slashCard]);

    const button = screen.getByRole("button", { name: /Select Slash/i });
    await act(async () => {
      button.focus();
    });
    fireEvent.focus(button);

    await waitFor(() => {
      expect(visiblePanelForTitle("Slash")?.textContent).toMatch(/Deal/);
    });

    fireEvent.blur(button);

    await waitFor(() => {
      const panel = panelForTitle("Slash");
      expect(panel?.textContent?.includes("Deal") ?? false).toBe(false);
    });
  });
});
