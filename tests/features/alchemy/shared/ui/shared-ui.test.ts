import { describe, expect, it } from "vitest";
import { fadePhaseClass } from "@/features/alchemy/shared/ui/fade-presence";

describe("fadePhaseClass", () => {
  it("maps enter and exit to screen fade classes", () => {
    expect(fadePhaseClass("enter")).toBe("screen-fade-in");
    expect(fadePhaseClass("exit")).toBe("screen-fade-out");
    expect(fadePhaseClass("idle")).toBeUndefined();
  });
});
