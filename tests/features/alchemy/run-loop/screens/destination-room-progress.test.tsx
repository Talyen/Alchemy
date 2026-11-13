import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DestinationRoomProgress } from "@/features/alchemy/run-loop/screens/destination-room-progress";
import { DESTINATIONS } from "@/lib/routing";
import { playUISound } from "@/lib/audio";

vi.mock("@/lib/audio", () => ({
  playUISound: vi.fn(),
}));

describe("DestinationRoomProgress", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders collapsed acts and expands rooms when act trigger is clicked", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DestinationRoomProgress
        currentAct={1}
        destinationIndexInAct={2}
        completedDestinations={[DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.CAMPFIRE]}
      />,
    );

    expect(screen.getByRole("list", { name: "Act progress" })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Room progress" })).toBeNull();

    const currentActItem = screen.getByLabelText("Act I");
    expect(currentActItem.getAttribute("aria-current")).toBe("step");

    // Click Act II trigger to expand rooms
    const act2Button = screen.getByRole("button", { name: "Act II: Show rooms" });
    await user.click(act2Button);

    expect(playUISound).toHaveBeenCalledWith("mapNode");
    const roomList = screen.getByRole("list", { name: "Room progress" });
    expect(roomList).toBeTruthy();
    expect(roomList.children).toHaveLength(8);

    // Check individual rooms
    expect(roomList.textContent).toContain("Room 1: Combat (completed)");
    expect(roomList.textContent).toContain("Room 2: Campfire (completed)");
    expect(roomList.textContent).toContain("Room 3: You are here");
    expect(roomList.textContent).toContain("Room 4: Unknown");
    expect(roomList.textContent).toContain("Room 8: Boss");

    // Click toggle button to collapse rooms
    const toggleButton = screen.getByRole("button", { name: "Act I: Show acts" });
    await user.click(toggleButton);

    expect(screen.queryByRole("list", { name: "Room progress" })).toBeNull();

    // Re-expanding then changing currentAct collapses automatically
    await user.click(screen.getByRole("button", { name: "Act I: Show rooms" }));
    expect(screen.getByRole("list", { name: "Room progress" })).toBeTruthy();

    rerender(<DestinationRoomProgress currentAct={2} destinationIndexInAct={0} completedDestinations={[]} />);
    expect(screen.queryByRole("list", { name: "Room progress" })).toBeNull();
  });

  it("renders correct room 8 boss when player is at boss room", async () => {
    const user = userEvent.setup();
    render(
      <DestinationRoomProgress
        currentAct={2}
        destinationIndexInAct={7}
        completedDestinations={Array.from({ length: 7 }, () => DESTINATIONS.NORMAL_COMBAT)}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Act II: Show rooms" });
    await user.click(toggle);

    const roomList = screen.getByRole("list", { name: "Room progress" });
    expect(roomList.querySelector('[aria-current="step"]')?.textContent).toContain("Room 8: You are here");
  });
});
