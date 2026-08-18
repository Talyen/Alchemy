import { describe, expect, it } from "vitest";
import { wildwoodPhaseToScreen } from "@/features/alchemy/shared/run-flow/wildwood-screen-routing";

describe("wildwoodPhaseToScreen", () => {
  it("maps every live phase to the matching resume screen", () => {
    expect(wildwoodPhaseToScreen("draft")).toBe("draft-deck");
    expect(wildwoodPhaseToScreen("battle")).toBe("battle");
    expect(wildwoodPhaseToScreen("reward")).toBe("rewards");
    expect(wildwoodPhaseToScreen("removal")).toBe("wildwood-removal");
  });
});
