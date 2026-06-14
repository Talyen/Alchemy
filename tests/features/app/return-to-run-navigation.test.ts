import { describe, expect, it } from "vitest";
import {
  resolveReturnToRunLabel,
  resolveReturnToRunTarget,
  shouldClearReturnToRunOnMainMenu,
} from "@/app/return-to-run-navigation";

describe("return-to-run navigation", () => {
  it("prefers an explicit return screen when set", () => {
    expect(resolveReturnToRunTarget("shop", false)).toBe("shop");
    expect(resolveReturnToRunTarget("battle", false)).toBe("battle");
  });

  it("falls back to battle when combat is paused and no meta return screen is set", () => {
    expect(resolveReturnToRunTarget(null, true)).toBe("battle");
  });

  it("returns null when there is no return target", () => {
    expect(resolveReturnToRunTarget(null, false)).toBeNull();
  });

  it("labels battle returns distinctly from other run screens", () => {
    expect(resolveReturnToRunLabel("battle")).toBe("Return to Battle");
    expect(resolveReturnToRunLabel("shop")).toBe("Return to Run");
  });

  it("keeps return state when main menu is opened during paused combat", () => {
    expect(shouldClearReturnToRunOnMainMenu(true)).toBe(false);
    expect(shouldClearReturnToRunOnMainMenu(false)).toBe(true);
  });
});
