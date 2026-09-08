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
    expect(resetButton.className).toContain("h-11");
    expect(resetButton.className).toContain("w-11");
    fireEvent.click(resetButton);

    expect(screen.getByText("Reset Talents?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset Talents" }));
    expect(onResetTalents).toHaveBeenCalledTimes(1);
  });
});
