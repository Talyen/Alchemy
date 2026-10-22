import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MenuScreen } from "@/features/alchemy/meta/screens/menu-screen";
import { useUiStore } from "@/features/alchemy/shared/stores/react/ui-store";
import { installFocusInputForTests } from "../../../../helpers/focus-input-test";

installFocusInputForTests(true);

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

describe("MenuScreen actions", () => {
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

  it("prevents locked progression actions and enables them after a completed run", async () => {
    const user = userEvent.setup();
    const onTalents = vi.fn();
    const onHomestead = vi.fn();
    const props = { ...defaultProps, hasActiveRun: false, onTalents, onHomestead };
    const { rerender } = render(<MenuScreen {...props} finishedRunCharacters={[]} />);
    for (const name of ["Talents", "Homestead"]) {
      const button = screen.getByRole("button", { name });
      expect(button.getAttribute("aria-disabled")).toBe("true");
      await user.click(button);
      button.focus();
      await user.keyboard("{Enter} ");
    }
    expect(onTalents).not.toHaveBeenCalled();
    expect(onHomestead).not.toHaveBeenCalled();

    rerender(<MenuScreen {...props} finishedRunCharacters={["knight"]} />);
    for (const name of ["Talents", "Homestead"]) {
      const button = screen.getByRole("button", { name });
      expect(button.getAttribute("aria-disabled")).toBe("false");
      button.focus();
      await user.keyboard("{Enter}");
    }
    expect(onTalents).toHaveBeenCalledOnce();
    expect(onHomestead).toHaveBeenCalledOnce();
  });

  it("offers Armory before any hero has finished a run", () => {
    const onArmory = vi.fn();
    render(<MenuScreen {...defaultProps} hasActiveRun={false} onArmory={onArmory} />);
    const armory = screen.getByRole("button", { name: /^Armory$/ });
    expect(armory.hasAttribute("disabled")).toBe(false);
    expect(armory.getAttribute("aria-disabled")).not.toBe("true");
    fireEvent.click(armory);
    expect(onArmory).toHaveBeenCalledOnce();
  });

  it("pairs desktop Quit before Options and keeps browser Options without Quit", () => {
    const onQuit = vi.fn();
    const { rerender } = render(<MenuScreen hasActiveRun={false} {...defaultProps} onQuit={onQuit} />);
    const quit = screen.getByRole("button", { name: "Quit" });
    const options = screen.getByRole("button", { name: "Options" });
    expect(quit.compareDocumentPosition(options) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(quit);
    expect(onQuit).toHaveBeenCalledOnce();
    rerender(<MenuScreen hasActiveRun={false} {...defaultProps} />);
    expect(screen.queryByRole("button", { name: "Quit" })).toBeNull();
    expect(screen.getByRole("button", { name: "Options" })).toBeTruthy();
  });
});
