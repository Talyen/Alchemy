import { describe, expect, it, beforeEach, vi } from "vitest";
import { isBattleInspectionOpen, useUiStore } from "@/features/alchemy/shared/stores/ui-store";

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

  it("clears a pending autoplay preview", () => {
    useUiStore.getState().setAutoplayPreviewCardId("hand-slash-1");
    useUiStore.getState().clearCardHover();
    expect(useUiStore.getState().autoplayPreviewCardId).toBeNull();
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
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1000);
    const store = useUiStore.getState();
    store.maybeTriggerShimmer("card-a");
    const first = useUiStore.getState().shimmerState;
    expect(first?.cardId).toBe("card-a");
    expect(first?.token).toBe(1);

    nowSpy.mockReturnValue(1005);
    store.maybeTriggerShimmer("card-a");
    expect(useUiStore.getState().shimmerState?.token).toBe(1);

    store.maybeTriggerShimmer("card-b");
    expect(useUiStore.getState().shimmerState?.cardId).toBe("card-b");
    expect(useUiStore.getState().shimmerState?.token).toBe(2);

    nowSpy.mockReturnValue(2000);
    store.maybeTriggerShimmer("card-a");
    expect(useUiStore.getState().shimmerState?.cardId).toBe("card-a");
    nowSpy.mockRestore();
  });
});

describe("inspection mutual exclusion", () => {
  it("keeps card and enemy inspection mutually exclusive", () => {
    const store = useUiStore.getState();
    store.setCardInspection("deck");
    expect(isBattleInspectionOpen(useUiStore.getState())).toBe(true);

    store.setEnemyInspectionOpen(true);
    expect(useUiStore.getState().cardInspection).toBeNull();
    expect(useUiStore.getState().enemyInspectionOpen).toBe(true);

    store.setCardInspection("draw");
    expect(useUiStore.getState().enemyInspectionOpen).toBe(false);
    expect(useUiStore.getState().cardInspection).toBe("draw");

    store.setCardInspection(null);
    expect(isBattleInspectionOpen(useUiStore.getState())).toBe(false);
  });
});
