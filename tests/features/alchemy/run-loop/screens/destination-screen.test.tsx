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
}));

describe("DestinationScreen", () => {
  installReadyArtworkForTests();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("calls onPrepare on mount", () => {
    const onPrepare = vi.fn();
    const rewardState = {
      ...createEmptyRewardState(),
      destinations: [DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.CAMPFIRE],
    };

    render(<DestinationScreen rewardState={rewardState} onChoose={vi.fn()} onPrepare={onPrepare} />);

    expect(onPrepare).toHaveBeenCalledOnce();
  });

  it("renders multiple destinations and routes selection to onChoose", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const rewardState = {
      ...createEmptyRewardState(),
      destinations: [DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.CAMPFIRE],
    };

    render(<DestinationScreen rewardState={rewardState} onChoose={onChoose} />);

    expect(screen.getByRole("heading", { name: "Choose Destination" })).toBeTruthy();

    await waitForArtwork();
    const combatBtn = screen.getByRole("button", { name: /combat/i });
    await user.click(combatBtn);

    expect(onChoose).toHaveBeenCalledWith(DESTINATIONS.NORMAL_COMBAT);
  });

  it("triggers deathsDoor sound and renders boss name for boss-only destination", () => {
    const rewardState = {
      ...createEmptyRewardState(),
      destinations: [DESTINATIONS.BOSS_COMBAT],
      selectedBossId: "forge-golem",
    };

    render(<DestinationScreen rewardState={rewardState} onChoose={vi.fn()} />);

    expect(playBattleEvent).toHaveBeenCalledWith("deathsDoor");
    expect(screen.getByText("The Forge Golem")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Choose Destination" })).toBeNull();
  });
});
