import { describe, expect, it, beforeEach, vi } from "vitest";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";

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

describe("plasma registrations", () => {
  const red = { primary: "#ff0000", secondary: "#440000" };
  const blue = { primary: "#0000ff", secondary: "#000044" };

  it("only lets the current owner clear a source", () => {
    const store = useUiStore.getState();
    store.setPlasmaInteraction({ ownerId: "new", colorPair: blue });
    store.clearPlasmaInteraction("old");
    expect(useUiStore.getState().plasmaInteraction).toEqual({ ownerId: "new", colorPair: blue });
    store.clearPlasmaInteraction("new");
    expect(useUiStore.getState().plasmaInteraction).toBeNull();
  });

  it("keeps baseline and interaction sources independent", () => {
    const store = useUiStore.getState();
    store.setPlasmaBaseline({ ownerId: "screen", colorPair: red });
    store.setPlasmaInteraction({ ownerId: "tooltip", colorPair: blue });
    expect(useUiStore.getState().plasmaInteraction?.colorPair).toEqual(blue);
    store.clearPlasmaInteraction("tooltip");
    expect(useUiStore.getState().plasmaBaseline?.colorPair).toEqual(red);
  });
});

describe("maybeTriggerShimmer", () => {
  it("is per-card cooldown not global", () => {
    const nowSpy = vi.spyOn(performance, "now").mockReturnValue(1000);
    const store = useUiStore.getState();
    store.maybeTriggerShimmer("card-a");
    const tokenA = useUiStore.getState().shimmerState?.token;
    expect(tokenA).toBe(1000);

    nowSpy.mockReturnValue(1005);
    store.maybeTriggerShimmer("card-a");
    expect(useUiStore.getState().shimmerState?.token).toBe(tokenA);

    store.maybeTriggerShimmer("card-b");
    expect(useUiStore.getState().shimmerState?.cardId).toBe("card-b");

    nowSpy.mockReturnValue((tokenA ?? 0) + 10_000);
    store.maybeTriggerShimmer("card-a");
    expect(useUiStore.getState().shimmerState?.cardId).toBe("card-a");
    nowSpy.mockRestore();
  });
});
