import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DestinationScreen } from "@/features/alchemy/run-loop/screens/destination-screen";
import { DESTINATIONS } from "@/lib/routing";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { playBattleEvent } from "@/lib/audio";
import { installReadyArtworkForTests, waitForArtwork } from "../../../../helpers/artwork-test";

vi.mock("@/lib/audio", () => ({
  playBattleEvent: vi.fn(),
  playUISound: vi.fn(),
}));

describe("DestinationScreen", () => {
  installReadyArtworkForTests();

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

    render(<DestinationScreen currentAct={1} rewardState={rewardState} onChoose={onChoose} onPrepare={onPrepare} />);

    expect(screen.getByRole("heading", { name: "Choose Destination" })).toBeTruthy();

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
  ] as const)("shows the boss and act %s before entering combat", (currentAct, actLabel) => {
    const rewardState = {
      ...createEmptyRewardState(),
      destinations: [DESTINATIONS.BOSS_COMBAT],
      selectedBossId: "forge-golem",
    };

    render(<DestinationScreen currentAct={currentAct} rewardState={rewardState} onChoose={vi.fn()} />);

    expect(screen.getByRole("button", { name: `Boss - Act ${actLabel}` })).toBeTruthy();
    expect(screen.getByText(`Boss - Act ${actLabel}`)).toBeTruthy();
    expect(playBattleEvent).toHaveBeenCalledWith("deathsDoor");
    expect(screen.getByText("The Forge Golem")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Choose Destination" })).toBeNull();
  });
});
