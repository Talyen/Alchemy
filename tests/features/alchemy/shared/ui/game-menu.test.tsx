// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GameMenu } from "@/features/alchemy/shared/ui/game-menu";

const noop = () => {};

function renderMenu(props: { isOpen: boolean; anchorRect: DOMRect | null }) {
  return render(
    <GameMenu
      isOpen={props.isOpen}
      onClose={noop}
      onMainMenu={noop}
      onCollection={noop}
      onTalents={noop}
      onHomestead={noop}
      onArmory={noop}
      onOptions={noop}
      currentScreen="collection"
      anchorRect={props.anchorRect}
    />,
  );
}

function isAnchored(): boolean {
  return screen.getByTestId("game-menu").parentElement?.className.includes("fixed") === true;
}

describe("GameMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the hamburger panel anchored while fading out after close clears the rect", () => {
    const anchorRect = new DOMRect(900, 16, 40, 40);
    const { rerender } = renderMenu({ isOpen: true, anchorRect });

    expect(isAnchored()).toBe(true);

    rerender(
      <GameMenu
        isOpen={false}
        onClose={noop}
        onMainMenu={noop}
        onCollection={noop}
        onTalents={noop}
        onHomestead={noop}
        onArmory={noop}
        onOptions={noop}
        currentScreen="collection"
        anchorRect={null}
      />,
    );

    expect(screen.getByTestId("game-menu")).toBeTruthy();
    expect(isAnchored()).toBe(true);
    expect(screen.getByTestId("game-menu").parentElement?.parentElement?.className).toContain("pointer-events-none");
  });

  it("centers the panel when opened without an anchor", () => {
    renderMenu({ isOpen: true, anchorRect: null });

    expect(isAnchored()).toBe(false);
    expect(screen.getByTestId("game-menu").parentElement?.className).toContain("items-center");
  });
});
