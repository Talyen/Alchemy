import { describe, expect, it, beforeEach } from "vitest";
import { useUiStore } from "@/features/alchemy/stores/ui-store";

beforeEach(() => {
  useUiStore.setState(useUiStore.getInitialState(), true);
});

describe("setHoveredCardId", () => {
  it("sets a direct value", () => {
    useUiStore.getState().setHoveredCardId("card-1");
    expect(useUiStore.getState().hoveredCardId).toBe("card-1");
  });

  it("accepts an updater function", () => {
    useUiStore.setState({ hoveredCardId: "card-1" });
    useUiStore.getState().setHoveredCardId((prev) => (prev === "card-1" ? null : prev));
    expect(useUiStore.getState().hoveredCardId).toBeNull();
  });
});

describe("clearCardHover", () => {
  it("clears hover id", () => {
    useUiStore.getState().setHoveredCardId("card-1");
    useUiStore.getState().clearCardHover();
    expect(useUiStore.getState().hoveredCardId).toBeNull();
  });
});
