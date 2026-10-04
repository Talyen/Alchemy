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

  it("shows unspent points at the bottom of the allocation screen and hides at zero", async () => {
    const { rerender } = render(
      <TalentsScreen
        talentXP={{ physical: 200 }}
        unlockedTalents={{ physical: [] }}
        onUnlockTalent={vi.fn()}
        onResetTalents={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Talent Points? Remaining$/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Select Physical Talents" }));
    await waitFor(() => expect(screen.getByText("4 Talent Points Remaining")).toBeTruthy());
    expect(screen.getByText("4 Talent Points Remaining").getAttribute("aria-live")).toBe("polite");

    rerender(
      <TalentsScreen
        talentXP={{ physical: 200 }}
        unlockedTalents={{ physical: ["physical-a", "physical-b", "physical-c", "physical-d"] }}
        onUnlockTalent={vi.fn()}
        onResetTalents={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.queryByText(/Talent Points? Remaining$/)).toBeNull());
  });
});
