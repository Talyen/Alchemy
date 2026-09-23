import { describe, expect, it, vi } from "vitest";
import {
  rememberNonOptionsScreen,
  resolveOptionsBackTarget,
  resolveReturnToRunTarget,
  resolveScreenBackHandler,
} from "@/app/use-app-navigation";
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

  it("steps back to character-select from difficulty-select", () => {
    const { handler, goToScreen } = setup({ renderedScreen: "difficulty-select" });
    expect(handler).toBeDefined();
    handler?.();
    expect(goToScreen).toHaveBeenCalledWith("character-select");
  });

  it.each(["menu", "battle", "shop", "destination", "draft-deck"] as const)("has no back handler on %s", (screen) => {
    const { handler } = setup({ renderedScreen: screen, returnToRunTarget: "battle" });
    expect(handler).toBeUndefined();
  });
});

describe("return-to-run navigation", () => {
  it("prefers an explicit return screen when set", () => {
    expect(resolveReturnToRunTarget("shop", false)).toBe("shop");
    expect(resolveReturnToRunTarget("battle", false)).toBe("battle");
  });

  it("falls back to battle when combat is paused and no meta return screen is set", () => {
    expect(resolveReturnToRunTarget(null, true)).toBe("battle");
  });

  it("returns null when there is no return target", () => {
    expect(resolveReturnToRunTarget(null, false, true)).toBe("destination");
  });

  it("keeps the prior screen while Options is showing so Back can leave Options", () => {
    expect(rememberNonOptionsScreen("battle", "menu")).toBe("battle");
    expect(rememberNonOptionsScreen("options", "battle")).toBe("battle");
    expect(rememberNonOptionsScreen("destination", "battle")).toBe("destination");
  });

  it("returns from Options through the saved run location", () => {
    expect(resolveOptionsBackTarget("battle", true, true)).toEqual({ kind: "returnToRun" });
    expect(resolveOptionsBackTarget("battle", false, true)).toEqual({ kind: "returnToRun" });
    expect(resolveOptionsBackTarget("shop", false, true)).toEqual({ kind: "returnToRun" });
  });

  it("returns to a valid setup or meta screen without a run", () => {
    expect(resolveOptionsBackTarget("battle", false, false)).toEqual({ kind: "goToScreen", screen: "menu" });
    expect(resolveOptionsBackTarget("shop", false, false)).toEqual({ kind: "goToScreen", screen: "menu" });
    expect(resolveOptionsBackTarget("difficulty-select", false, false)).toEqual({
      kind: "goToScreen",
      screen: "difficulty-select",
    });
    expect(resolveOptionsBackTarget("collection", false, false)).toEqual({ kind: "goToScreen", screen: "collection" });
  });
});
