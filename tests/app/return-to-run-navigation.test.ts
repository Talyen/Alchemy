import { describe, expect, it } from "vitest";
import { rememberNonOptionsScreen, resolveOptionsBackTarget, resolveReturnToRunTarget } from "@/app/use-app-navigation";

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

  it("returns to battle from Options only while combat is still active", () => {
    expect(resolveOptionsBackTarget("battle", true)).toEqual({ kind: "returnToBattle" });
    expect(resolveOptionsBackTarget("battle", false)).toEqual({ kind: "goToScreen", screen: "destination" });
    expect(resolveOptionsBackTarget("shop", false)).toEqual({ kind: "goToScreen", screen: "shop" });
  });
});
