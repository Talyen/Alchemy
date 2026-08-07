import { describe, expect, it } from "vitest";
import { resolveReturnToRunTarget } from "@/app/use-app-navigation";

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
});
