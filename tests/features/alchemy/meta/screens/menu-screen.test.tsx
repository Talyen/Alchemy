import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MenuScreen } from "@/features/alchemy/meta/screens/menu-screen";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";

const defaultProps = {
  onPlay: vi.fn(),
  onCollection: vi.fn(),
  onOptions: vi.fn(),
  onTalents: vi.fn(),
  onHomestead: vi.fn(),
  onArmory: vi.fn(),
  logoSrc: "logo-front.png",
  finishedRunCharacters: [],
};

describe("MenuScreen logo", () => {
  afterEach(() => {
    cleanup();
    useUiStore.setState({ plasmaInteraction: null });
    vi.unstubAllGlobals();
  });

  it("offers only Continue for an unfinished run and Play otherwise", () => {
    const { rerender } = render(<MenuScreen {...defaultProps} hasActiveRun />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(defaultProps.onPlay).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^(Play|New Run)$/ })).toBeNull();
    rerender(<MenuScreen {...defaultProps} hasActiveRun={false} />);
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  });

  it("unlocks talents and homestead independently from finished run characters", () => {
    const { rerender } = render(<MenuScreen hasActiveRun={false} {...defaultProps} finishedRunCharacters={[]} />);
    expect(screen.getByRole("button", { name: /talents/i }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: /homestead/i }).getAttribute("aria-disabled")).toBe("true");

    rerender(<MenuScreen hasActiveRun={false} {...defaultProps} finishedRunCharacters={["knight"]} />);
    expect(screen.getByRole("button", { name: /talents/i }).getAttribute("aria-disabled")).toBe("false");
    expect(screen.getByRole("button", { name: /homestead/i }).getAttribute("aria-disabled")).toBe("false");
  });

  it("glows gold on Play focus and leaves Quit without plasma", async () => {
    render(<MenuScreen hasActiveRun={false} {...defaultProps} onQuit={vi.fn()} />);

    const play = screen.getByRole("button", { name: /^play$/i });
    fireEvent.focus(play);
    await waitFor(() =>
      expect(useUiStore.getState().plasmaInteraction?.colorPair).toEqual({
        primary: "#cd9b51",
        secondary: "#251e18",
      }),
    );
    fireEvent.blur(play);
    await waitFor(() => expect(useUiStore.getState().plasmaInteraction).toBeNull());

    const quit = screen.getByRole("button", { name: /^quit$/i });
    fireEvent.mouseEnter(quit.closest(".menu-nav-button")!);
    expect(useUiStore.getState().plasmaInteraction).toBeNull();
  });

  it("shows thicker gold shine border when homestead unlocks or talents are available", () => {
    const { rerender } = render(
      <MenuScreen
        hasActiveRun={false}
        {...defaultProps}
        finishedRunCharacters={["knight"]}
        hasAffordableHomestead={false}
        hasUnspentTalents={false}
      />,
    );

    const homesteadBtn = screen.getByRole("button", { name: /homestead/i });
    const talentsBtn = screen.getByRole("button", { name: /talents/i });

    expect(homesteadBtn.closest(".menu-nav-button")!.querySelector(".shine-border")).toBeNull();
    expect(talentsBtn.closest(".menu-nav-button")!.querySelector(".shine-border")).toBeNull();

    rerender(
      <MenuScreen
        hasActiveRun={false}
        {...defaultProps}
        finishedRunCharacters={["knight"]}
        hasAffordableHomestead
        hasUnspentTalents
      />,
    );

    const homesteadShine = homesteadBtn.closest(".menu-nav-button")!.querySelector(".shine-border") as HTMLElement;
    const talentsShine = talentsBtn.closest(".menu-nav-button")!.querySelector(".shine-border") as HTMLElement;

    expect(homesteadShine).not.toBeNull();
    expect(homesteadShine.hasAttribute("data-glow")).toBe(false);
    expect(homesteadShine.style.getPropertyValue("--border-width")).toBe("2px");

    expect(talentsShine).not.toBeNull();
    expect(talentsShine.hasAttribute("data-glow")).toBe(false);
    expect(talentsShine.style.getPropertyValue("--border-width")).toBe("2px");
  });

  it("does not show shine borders when features are locked even if available flags are true", () => {
    render(
      <MenuScreen
        hasActiveRun={false}
        {...defaultProps}
        finishedRunCharacters={[]}
        hasAffordableHomestead
        hasUnspentTalents
      />,
    );

    const homesteadBtn = screen.getByRole("button", { name: /homestead/i });
    const talentsBtn = screen.getByRole("button", { name: /talents/i });

    expect(homesteadBtn.closest(".menu-nav-button")!.querySelector(".shine-border")).toBeNull();
    expect(talentsBtn.closest(".menu-nav-button")!.querySelector(".shine-border")).toBeNull();
  });
});
