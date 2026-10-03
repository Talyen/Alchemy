import { describe, expect, it } from "vitest";
import {
  emptyShopState,
  isActiveRunActivity,
  readActivityData,
  runActivityScreen,
  transitionRunActivity,
  type RunActivity,
} from "@/lib/active-run-session";

const idle: RunActivity = { kind: "idle" };

describe("run activity ownership", () => {
  it("preserves live visit progress on same-screen and meta navigation", () => {
    const shop = { ...emptyShopState(), refreshesLeft: 1, purchasedIds: ["slash-0"] };
    const activity: RunActivity = { kind: "shop", data: shop };
    expect(readActivityData(activity, "shop")).toBe(shop);
    expect(transitionRunActivity(activity, "shop")).toBe(activity);
    expect(transitionRunActivity(activity, "options")).toBe(activity);
    expect(runActivityScreen(activity)).toBe("shop");
    expect(isActiveRunActivity(activity)).toBe(true);
  });

  it("initializes every visit with fresh mutable state matching its immutable read fallback", () => {
    for (const kind of [
      "campfire",
      "transmutation",
      "shop",
      "alchemist",
      "trinket-shop",
      "equipment-shop",
      "mystery",
      "corruption",
    ] as const) {
      const first = transitionRunActivity(idle, kind);
      const second = transitionRunActivity(idle, kind);
      const fallback = readActivityData(idle, kind);
      expect(first, kind).toEqual({ kind, data: fallback });
      if (fallback === null) continue;
      const data = readActivityData(first, kind);
      expect(data, kind).not.toBe(readActivityData(second, kind));
      expect(data, kind).not.toBe(fallback);
      expect(Object.isFrozen(data), kind).toBe(false);
      expect(Object.isFrozen(fallback), kind).toBe(true);
      for (const value of Object.values(fallback)) {
        if (value && typeof value === "object") expect(Object.isFrozen(value), kind).toBe(true);
      }
    }
    const fallback = readActivityData(idle, "shop");
    expect(() => {
      fallback.cards.push(null as never);
    }).toThrow();
    expect(() => {
      fallback.refreshesLeft = 99;
    }).toThrow();
    const fresh = transitionRunActivity(idle, "shop");
    expect(readActivityData(fresh, "shop")).toEqual(emptyShopState());
  });

  it("keeps progress screens resumable while inactive and idle remain unrouted", () => {
    for (const kind of [
      "battle",
      "rewards",
      "destination",
      "labyrinth-map",
      "wildwood-removal",
      "draft-deck",
      "difficulty-select",
    ] as const) {
      const activity = transitionRunActivity(idle, kind);
      expect(activity).toEqual({ kind });
      expect(runActivityScreen(activity)).toBe(kind);
    }
    expect(runActivityScreen(idle)).toBeNull();
    expect(runActivityScreen({ kind: "inactive" })).toBeNull();
    expect(isActiveRunActivity({ kind: "inactive" })).toBe(false);
    expect(isActiveRunActivity(idle)).toBe(true);
  });
});
