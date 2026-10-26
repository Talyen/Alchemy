import { describe, expect, it, vi } from "vitest";
import {
  resolveBrowsingHistory,
  resolveBrowsingBackTarget,
  resolveReturnToRunTarget,
  resolveScreenBackHandler,
} from "@/app/screen-navigation-policy";
import type { Screen } from "@/lib/routing";

function setup(
  overrides: {
    renderedScreen: Screen;
  } = { renderedScreen: "menu" },
) {
  const handleMainMenu = vi.fn();
  const backFromBrowsing = vi.fn();
  const goToScreen = vi.fn();
  const handler = resolveScreenBackHandler({
    renderedScreen: overrides.renderedScreen,
    handleMainMenu,
    backFromBrowsing,
    backFromDifficultySelect: vi.fn(),
    goToScreen,
  });
  return { handler, handleMainMenu, backFromBrowsing, goToScreen };
}

describe("resolveScreenBackHandler", () => {
  it("returns the options back handler on the options screen", () => {
    const { handler, backFromBrowsing } = setup({ renderedScreen: "options" });
    expect(handler).toBe(backFromBrowsing);
  });

  it.each(["collection", "homestead", "talents", "armory"] as const)(
    "uses browsing history for Back from %s",
    (screen) => {
      const { handler, backFromBrowsing } = setup({ renderedScreen: screen });
      expect(handler).toBe(backFromBrowsing);
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
    const { handler } = setup({ renderedScreen: screen });
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

  it("unwinds nested browsing and collapses shortcuts to ancestors without cycles", () => {
    let state: { prevScreen: Screen; history: readonly Screen[] } = { prevScreen: "menu", history: [] };
    for (const next of ["options", "collection", "armory"] as const) {
      state = { history: resolveBrowsingHistory(next, state), prevScreen: next };
    }
    expect(state.history).toEqual(["menu", "options", "collection"]);
    state = { history: resolveBrowsingHistory("options", state), prevScreen: "options" };
    expect(state.history).toEqual(["menu"]);
    expect(resolveBrowsingHistory("options", state)).toBe(state.history);
    expect(resolveBrowsingHistory("menu", state)).toEqual([]);
    expect(resolveBrowsingHistory("battle", state)).toEqual([]);
  });

  it("returns from Options through the saved run location", () => {
    expect(resolveBrowsingBackTarget("battle", true, true)).toEqual({ kind: "returnToRun" });
    expect(resolveBrowsingBackTarget("battle", false, true)).toEqual({ kind: "returnToRun" });
    expect(resolveBrowsingBackTarget("shop", false, true)).toEqual({ kind: "returnToRun" });
  });

  it("returns to a valid setup or meta screen without a run", () => {
    expect(resolveBrowsingBackTarget("battle", false, false)).toEqual({ kind: "goToScreen", screen: "menu" });
    expect(resolveBrowsingBackTarget("shop", false, false)).toEqual({ kind: "goToScreen", screen: "menu" });
    expect(resolveBrowsingBackTarget("difficulty-select", false, false)).toEqual({
      kind: "goToScreen",
      screen: "difficulty-select",
    });
    expect(resolveBrowsingBackTarget("collection", false, false)).toEqual({ kind: "goToScreen", screen: "collection" });
  });
});
