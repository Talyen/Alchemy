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
    onUnlockTalent: vi.fn(),
    onResetTalents: vi.fn(),
  };

  it("shows the Dodge portrait and all ten real talents", async () => {
    render(<TalentsScreen {...defaultProps} talentXP={{ dodge: 550 }} />);
    const portrait = screen.getByRole("button", { name: "Select Dodge Talents" });
    expect(portrait.querySelector("img")?.getAttribute("alt")).toBe("Dodge");
    fireEvent.click(portrait);
    await waitFor(() => expect(screen.getByText("Lightfoot")).toBeTruthy());
    expect(screen.getByText("Perfect Timing")).toBeTruthy();
    expect(screen.queryByText("Coming Soon")).toBeNull();
    const lightfoot = screen.getByRole("button", { name: /Lightfoot/ });
    expect(lightfoot.tagName).toBe("BUTTON");
    fireEvent.click(lightfoot);
    await waitFor(() => expect(defaultProps.onUnlockTalent).toHaveBeenCalledWith("dodge", "dodge-lightfoot"));
  });

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
    expect(resetButton.className).toContain("h-11");
    expect(resetButton.className).toContain("w-11");
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

  it("updates the points footer in real time and uses the singular label", async () => {
    const { rerender } = render(
      <TalentsScreen
        talentXP={{ physical: 200 }}
        unlockedTalents={{ physical: [] }}
        onUnlockTalent={vi.fn()}
        onResetTalents={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select Physical Talents" }));
    await waitFor(() => expect(screen.getByText("4 Talent Points Remaining")).toBeTruthy());

    rerender(
      <TalentsScreen
        talentXP={{ physical: 200 }}
        unlockedTalents={{ physical: ["physical-a"] }}
        onUnlockTalent={vi.fn()}
        onResetTalents={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText("3 Talent Points Remaining")).toBeTruthy());

    rerender(
      <TalentsScreen
        talentXP={{ physical: 20 }}
        unlockedTalents={{ physical: [] }}
        onUnlockTalent={vi.fn()}
        onResetTalents={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText("1 Talent Point Remaining")).toBeTruthy());
  });
});
