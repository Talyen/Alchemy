import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameMenu } from "@/features/alchemy/shared/ui/game-menu";
import type { ComponentProps } from "react";

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

function isAnchored(): boolean {
  return Boolean(screen.getByTestId("game-menu").parentElement?.style.top);
}

describe("GameMenu", () => {
  afterEach(() => {
    cleanup();
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

  it("centers the panel when opened without an anchor", () => {
    renderMenu({ isOpen: true, anchorRect: null });

    expect(screen.getByTestId("game-menu")).toBeTruthy();
    expect(isAnchored()).toBe(false);
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
    await user.click(screen.getByRole("button", { name: "Return to Battle" }));
    await user.click(screen.getByRole("button", { name: "End Run" }));
    expect(calls).toEqual(["return", "close", "end", "close"]);

    rerender(<GameMenu {...menuProps} currentScreen="menu" />);
    expect(screen.queryByRole("button", { name: /Return to|End Run/ })).toBeNull();
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

  it("renders menu items with designated icon color classes", () => {
    renderMenu({ isOpen: true, anchorRect: null });

    const talentsButton = screen.getByRole("button", { name: /talents/i });
    const talentsIcon = talentsButton.querySelector("svg");
    expect(talentsIcon?.getAttribute("class")).toContain("text-violet-400");

    const homesteadButton = screen.getByRole("button", { name: /homestead/i });
    const homesteadIcon = homesteadButton.querySelector("svg");
    expect(homesteadIcon?.getAttribute("class")).toContain("text-emerald-400");

    const armoryButton = screen.getByRole("button", { name: /armory/i });
    const armoryIcon = armoryButton.querySelector("svg");
    expect(armoryIcon?.getAttribute("class")).toContain("text-sky-300");

    const optionsButton = screen.getByRole("button", { name: /options/i });
    const optionsIcon = optionsButton.querySelector("svg");
    expect(optionsIcon?.getAttribute("class")).toContain("text-zinc-400");
  });
});
