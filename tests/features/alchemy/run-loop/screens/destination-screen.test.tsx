import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DestinationScreen } from "@/features/alchemy/run-loop/screens/destination-screen";
import { DESTINATIONS } from "@/lib/routing";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { playBattleEvent } from "@/lib/audio";
import { installReadyArtworkForTests, waitForArtwork } from "../../../../helpers/artwork-test";
import { installFocusInputForTests } from "../../../../helpers/focus-input-test";

vi.mock("@/lib/audio", () => ({
  playBattleEvent: vi.fn(),
  playUISound: vi.fn(),
}));

describe("DestinationScreen", () => {
  installReadyArtworkForTests();
  installFocusInputForTests();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders multiple destinations and routes selection to onChoose", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const onPrepare = vi.fn();
    const rewardState = {
      ...createEmptyRewardState(),
      destinations: [DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.CAMPFIRE],
    };

    render(
      <DestinationScreen
        currentAct={1}
        destinationIndexInAct={3}
        completedDestinations={[DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.CAMPFIRE, DESTINATIONS.CARD_SHOP]}
        rewardState={rewardState}
        onChoose={onChoose}
        onPrepare={onPrepare}
      />,
    );

    expect(screen.getByRole("heading", { name: "Choose Destination" })).toBeTruthy();
    const showRooms = screen.getByRole("button", { name: "Act I: Show rooms" });
    expect(showRooms.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("list", { name: "Room progress" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Act III: Show rooms" }));
    const progress = screen.getByRole("list", { name: "Room progress" });
    expect(progress.children).toHaveLength(8);
    expect(progress.querySelector('[aria-current="step"]')?.textContent).toContain("Room 4: You are here");
    expect(progress.textContent).toContain("Room 1: Combat (completed)");
    expect(progress.textContent).toContain("Room 5: Unknown");
    expect(progress.textContent).toContain("Room 8: Boss");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("list", { name: "Room progress" })).toBeNull();
    expect(document.activeElement).toBe(document.body);
    expect(onChoose).not.toHaveBeenCalled();
    await user.tab();
    expect(document.activeElement?.getAttribute("aria-controls")).toBe(progress.id);
    await user.keyboard("{Enter}");
    expect(screen.getByRole("list", { name: "Room progress" })).toBeTruthy();

    await waitForArtwork();
    const combatBtn = screen.getByRole("button", { name: /combat/i });
    await user.click(combatBtn);

    expect(onChoose).toHaveBeenCalledWith(DESTINATIONS.NORMAL_COMBAT);
    expect(onPrepare).toHaveBeenCalledOnce();
  });

  it.each([
    [1, "I"],
    [2, "II"],
    [3, "III"],
  ] as const)("shows the boss and act %s before entering combat", async (currentAct, actLabel) => {
    const user = userEvent.setup();
    const rewardState = {
      ...createEmptyRewardState(),
      destinations: [DESTINATIONS.BOSS_COMBAT],
      selectedBossId: "forge-golem",
    };

    render(
      <DestinationScreen
        currentAct={currentAct}
        destinationIndexInAct={7}
        completedDestinations={Array.from({ length: 7 }, () => DESTINATIONS.NORMAL_COMBAT)}
        rewardState={rewardState}
        onChoose={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: `Boss - Act ${actLabel}` })).toBeTruthy();
    expect(screen.getByText(`Boss - Act ${actLabel}`)).toBeTruthy();
    expect(playBattleEvent).toHaveBeenCalledWith("deathsDoor");
    expect(screen.getByText("The Forge Golem")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Choose Destination" })).toBeNull();
    await user.click(screen.getByRole("button", { name: `Act ${actLabel}: Show rooms` }));
    expect(
      screen.getByRole("list", { name: "Room progress" }).querySelector('[aria-current="step"]')?.textContent,
    ).toContain("Room 8: You are here");
  });
});
