import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TalentsScreen } from "@/features/alchemy/meta/screens/talents-screen";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

describe("TalentsScreen", () => {
  installDisabledAnimationsForTests();

  afterEach(() => {
    cleanup();
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
    onOpenMenu: vi.fn(),
    onUnlockTalent: vi.fn(),
    onResetTalents: vi.fn(),
  };

  it("renders the talent overview grid with keywords", () => {
    render(<TalentsScreen {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "Talents" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select Physical Talents" })).toBeTruthy();
  });

  it("navigates into keyword tree on selection and back to overview", async () => {
    render(<TalentsScreen {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Select Physical Talents" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select Physical Talents" })).toBeTruthy();
    });
  });

  it("opens reset confirmation dialog and dispatches reset", () => {
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

    expect(screen.getByText("Reset Talents?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset Talents" }));
    expect(onResetTalents).toHaveBeenCalledTimes(1);
  });
});
