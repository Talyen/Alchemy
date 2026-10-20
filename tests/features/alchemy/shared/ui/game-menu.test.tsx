import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameMenu } from "@/features/alchemy/shared/ui/game-menu";
import { useState, type ComponentProps } from "react";
import { useAppKeyboardShortcuts } from "@/app/use-app-keyboard-shortcuts";
import { resetEscapeStackForTests } from "@/app/escape-stack";

const noop = () => {};
const menuProps = {
  isOpen: true,
  onClose: noop,
  onMainMenu: noop,
  onCollection: noop,
  onTalents: noop,
  onHomestead: noop,
  onArmory: noop,
  onOptions: noop,
  currentScreen: "collection",
  anchorRect: null,
} satisfies ComponentProps<typeof GameMenu>;

function renderMenu(props: Partial<ComponentProps<typeof GameMenu>> = {}) {
  return render(<GameMenu {...menuProps} {...props} />);
}

async function waitForMenuReady() {
  await waitFor(() => expect(screen.getByTestId("game-menu").closest("[inert]")).toBeNull());
}

function isAnchored(): boolean {
  return Boolean(screen.getByTestId("game-menu").parentElement?.style.top);
}

describe("GameMenu", () => {
  beforeEach(() => {
    // JSDOM has no layout boxes; dialog focus still requires visible controls.
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
      new DOMRect(0, 0, 100, 30),
    ] as unknown as DOMRectList);
  });
  afterEach(() => {
    cleanup();
    resetEscapeStackForTests();
    vi.restoreAllMocks();
  });

  it.each([false, true])("preserves focus through repeated Escape menu cycles with an opener: %s", async (focused) => {
    const user = userEvent.setup();
    function BattleWithMenu() {
      const [open, setOpen] = useState(false);
      useAppKeyboardShortcuts({
        renderedScreen: "battle",
        screenInteractive: true,
        gameMenuOpen: open,
        toggleGameMenu: () => setOpen((value) => !value),
      });
      return (
        <>
          <div data-screen-content="battle">
            <button>Inspect enemy</button>
            <button>End Turn</button>
          </div>
          <GameMenu {...menuProps} currentScreen="battle" isOpen={open} onClose={() => setOpen(false)} />
        </>
      );
    }
    render(<BattleWithMenu />);
    const opener = screen.getByRole("button", { name: "End Turn" });
    opener.scrollIntoView = vi.fn();
    if (focused) opener.focus();
    for (let cycle = 0; cycle < 2; cycle++) {
      await user.keyboard("{Escape}");
      const menu = screen.getByRole("dialog", { name: "Game menu" });
      await waitFor(() => expect(menu.contains(document.activeElement)).toBe(true));
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Game menu" })).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(focused ? opener : document.body));
    }
  });

  it("keeps the hamburger panel anchored while fading out after close clears the rect", () => {
    const anchorRect = new DOMRect(900, 16, 40, 40);
    const { rerender } = renderMenu({ isOpen: true, anchorRect });

    expect(isAnchored()).toBe(true);

    rerender(<GameMenu {...menuProps} isOpen={false} />);

    expect(screen.getByTestId("game-menu")).toBeTruthy();
    expect(isAnchored()).toBe(true);
    expect(screen.getByTestId("game-menu").closest("[inert]")).toBeTruthy();
  });

  it("shows available actions in order, hides the current screen, and runs an action before closing", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const props = {
      onReturnToRun: () => calls.push("return"),
      returnToRunLabel: "Return to Battle" as const,
      onEndRun: () => calls.push("end"),
      onClose: () => calls.push("close"),
    };
    const { rerender } = renderMenu(props);
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Return to Battle",
      "Main Menu",
      "Talents",
      "Homestead",
      "Armory",
      "Options",
      "End Run",
    ]);
    await waitForMenuReady();
    await user.click(screen.getByRole("button", { name: "Return to Battle" }));
    await waitForMenuReady();
    await user.click(screen.getByRole("button", { name: "End Run" }));
    expect(calls).toEqual(["return", "close", "end", "close"]);

    rerender(<GameMenu {...menuProps} currentScreen="menu" />);
    expect(within(screen.getByTestId("game-menu")).queryByRole("button", { name: /Return to|End Run/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Main Menu" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Collection" })).toBeTruthy();
  });

  it.each(["Talents", "Homestead"] as const)(
    "blocks locked %s without closing, and allows it after unlock",
    async (label) => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onClose = vi.fn();
      const props = { onClose, onTalents: onSelect, onHomestead: onSelect };
      const { rerender } = renderMenu({ ...props, isTalentsLocked: true, isHomesteadLocked: true });
      const button = screen.getByRole("button", { name: label });
      expect(button.getAttribute("aria-disabled")).toBe("true");
      await user.click(button);
      expect(onSelect).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();

      rerender(<GameMenu {...menuProps} {...props} />);
      await waitForMenuReady();
      await user.click(screen.getByRole("button", { name: label }));
      expect(onSelect).toHaveBeenCalledOnce();
      expect(onClose).toHaveBeenCalledOnce();
    },
  );

  it("does not navigate from a focused action during exit", async () => {
    const user = userEvent.setup();
    const onMainMenu = vi.fn();
    const props = {
      onClose: noop,
      onMainMenu,
      onCollection: noop,
      onTalents: noop,
      onHomestead: noop,
      onArmory: noop,
      onOptions: noop,
    };
    const { rerender } = render(<GameMenu {...props} isOpen />);
    screen.getByRole("button", { name: "Main Menu" }).focus();
    rerender(<GameMenu {...props} isOpen={false} />);
    await user.keyboard("{Enter} ");
    expect(onMainMenu).not.toHaveBeenCalled();
  });
});
