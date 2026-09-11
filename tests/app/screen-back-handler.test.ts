import { describe, expect, it, vi } from "vitest";
import { resolveScreenBackHandler } from "@/app/use-app-navigation";
import type { Screen } from "@/lib/routing";

function setup(
  overrides: {
    renderedScreen: Screen;
    returnToRunTarget?: Screen | null;
  } = { renderedScreen: "menu" },
) {
  const returnToRun = vi.fn();
  const handleMainMenu = vi.fn();
  const backFromOptions = vi.fn();
  const goToScreen = vi.fn();
  const handler = resolveScreenBackHandler({
    renderedScreen: overrides.renderedScreen,
    returnToRunTarget: overrides.returnToRunTarget ?? null,
    returnToRun,
    handleMainMenu,
    backFromOptions,
    goToScreen,
  });
  return { handler, returnToRun, handleMainMenu, backFromOptions, goToScreen };
}

describe("resolveScreenBackHandler", () => {
  it("returns the options back handler on the options screen", () => {
    const { handler, backFromOptions } = setup({ renderedScreen: "options" });
    expect(handler).toBe(backFromOptions);
  });

  it.each(["collection", "homestead", "talents", "armory"] as const)(
    "returns to the run from %s when a return target exists",
    (screen) => {
      const { handler, returnToRun } = setup({ renderedScreen: screen, returnToRunTarget: "battle" });
      expect(handler).toBe(returnToRun);
    },
  );

  it.each(["collection", "homestead", "talents", "armory"] as const)(
    "falls back to the main menu from %s with no return target",
    (screen) => {
      const { handler, handleMainMenu } = setup({ renderedScreen: screen, returnToRunTarget: null });
      expect(handler).toBe(handleMainMenu);
    },
  );

  it("returns to the main menu from game-mode-select", () => {
    const { handler, handleMainMenu } = setup({ renderedScreen: "game-mode-select" });
    expect(handler).toBe(handleMainMenu);
  });

  it("steps back to game-mode-select from character-select", () => {
    const { handler, goToScreen } = setup({ renderedScreen: "character-select" });
    expect(handler).toBeDefined();
    handler?.();
    expect(goToScreen).toHaveBeenCalledWith("game-mode-select");
  });

  it.each(["menu", "battle", "shop", "destination", "draft-deck"] as const)("has no back handler on %s", (screen) => {
    const { handler } = setup({ renderedScreen: screen, returnToRunTarget: "battle" });
    expect(handler).toBeUndefined();
  });
});
