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

  it("unlocks talents and homestead independently from finished run characters", () => {
    const { rerender } = render(<MenuScreen {...defaultProps} finishedRunCharacters={[]} />);
    expect(screen.getByRole("button", { name: /talents/i }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: /homestead/i }).getAttribute("aria-disabled")).toBe("true");

    rerender(<MenuScreen {...defaultProps} finishedRunCharacters={["knight"]} />);
    expect(screen.getByRole("button", { name: /talents/i }).getAttribute("aria-disabled")).toBe("false");
    expect(screen.getByRole("button", { name: /homestead/i }).getAttribute("aria-disabled")).toBe("false");
  });

  it("shows the icon-colored plasma glow on hover even when the button is locked", async () => {
    render(<MenuScreen {...defaultProps} />);
    const homestead = screen.getByRole("button", { name: /homestead/i });
    expect(homestead.getAttribute("aria-disabled")).toBe("true");

    fireEvent.mouseEnter(homestead.closest(".menu-nav-button")!);
    await waitFor(() =>
      expect(useUiStore.getState().plasmaInteraction?.colorPair).toEqual({
        primary: "#34d399",
        secondary: "#064e3b",
      }),
    );

    fireEvent.mouseLeave(homestead.closest(".menu-nav-button")!);
    await waitFor(() => expect(useUiStore.getState().plasmaInteraction).toBeNull());
  });

  it("glows gold on Play focus and leaves Quit without plasma", async () => {
    render(<MenuScreen {...defaultProps} onQuit={vi.fn()} />);

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
});
