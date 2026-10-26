import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TalentsScreen } from "@/features/alchemy/meta/screens/talents-screen";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";
import { ESCAPE_PRIORITY, pushEscapeHandler, resetEscapeStackForTests } from "@/app/escape-stack";

describe("TalentsScreen", () => {
  installDisabledAnimationsForTests();

  afterEach(() => {
    cleanup();
    resetEscapeStackForTests();
  });

  const defaultProps = {
    talentXP: {
      physical: 100,
      bleed: 50,
    },
    unlockedTalents: {
      physical: [],
      bleed: [],
    },
    onUnlockTalent: vi.fn(),
    onResetTalents: vi.fn(),
  };

  it("navigates into keyword tree on selection and back to overview", async () => {
    render(<TalentsScreen {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Select Physical Talents" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    });

    const leaveScreen = vi.fn();
    pushEscapeHandler({ id: "test-screen-back", priority: ESCAPE_PRIORITY.SCREEN_OVERLAY, onEscape: leaveScreen });
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select Physical Talents" })).toBeTruthy();
    });
    expect(leaveScreen).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(leaveScreen).toHaveBeenCalledOnce();
  });

  it("opens reset confirmation dialog and dispatches reset", async () => {
    const onResetTalents = vi.fn();
    render(
      <TalentsScreen
        {...defaultProps}
        unlockedTalents={{ physical: ["physical-1"] }}
        onResetTalents={onResetTalents}
      />,
    );

    const resetButton = screen.getByRole("button", { name: "Reset talents" });
    fireEvent.click(resetButton);

    expect(screen.getByRole("heading", { name: "Reset Talents" })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: /^Reset$/ }).closest("[inert]")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /^Reset$/ }));
    expect(onResetTalents).toHaveBeenCalledTimes(1);
  });

  it("spending the last point clears both the live count and overview announcement", async () => {
    const onUnlockTalent = vi.fn();
    const props = {
      ...defaultProps,
      talentXP: { physical: 20 },
      unlockedTalents: { physical: [] as string[] },
      onUnlockTalent,
    };
    const { rerender } = render(<TalentsScreen {...props} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Select Physical Talents", description: "Unspent Talent Points" }),
    );
    const points = await screen.findByText("1 Talent Point Remaining");
    expect(points.getAttribute("aria-live")).toBe("polite");
    fireEvent.click(screen.getByRole("button", { name: /Available to unlock.*Expert Blacksmith/ }));
    expect(onUnlockTalent).toHaveBeenCalledExactlyOnceWith("physical", "physical-expert-blacksmith");
    rerender(<TalentsScreen {...props} unlockedTalents={{ physical: ["physical-expert-blacksmith"] }} />);
    await waitFor(() => expect(screen.queryByText(/Talent Points? Remaining$/)).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("button", { name: "Select Physical Talents", description: "" })).toBeTruthy();
  });
});
