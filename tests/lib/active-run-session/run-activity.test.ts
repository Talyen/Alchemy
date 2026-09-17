import { describe, expect, it } from "vitest";
import {
  emptyShopState,
  isActiveRunActivity,
  readActivityData,
  runActivityScreen,
  transitionRunActivity,
  type RunActivity,
} from "@/lib/active-run-session";
import { SHOP_REFRESHES } from "@/lib/game-constants";

describe("run-activity", () => {
  describe("isActiveRunActivity", () => {
    it("returns false for inactive activity and true for any active activity", () => {
      expect(isActiveRunActivity({ kind: "inactive" })).toBe(false);
      expect(isActiveRunActivity({ kind: "idle" })).toBe(true);
      expect(isActiveRunActivity({ kind: "battle" })).toBe(true);
      expect(isActiveRunActivity({ kind: "shop", data: emptyShopState() })).toBe(true);
    });
  });

  describe("readActivityData", () => {
    it("reads matching activity data when present", () => {
      const shopState = { ...emptyShopState(), refreshesLeft: 9 };
      const activity: RunActivity = { kind: "shop", data: shopState };
      expect(readActivityData(activity, "shop")).toBe(shopState);
    });

    it("returns frozen fallback empty visit when kind does not match", () => {
      const activity: RunActivity = { kind: "idle" };
      const fallbackShop = readActivityData(activity, "shop");
      expect(fallbackShop.cards).toEqual([]);
      expect(fallbackShop.refreshesLeft).toBe(SHOP_REFRESHES);
      expect(Object.isFrozen(fallbackShop)).toBe(true);
      expect(Object.isFrozen(fallbackShop.cards)).toBe(true);

      // Attempting to mutate fallback in strict mode throws
      expect(() => {
        fallbackShop.refreshesLeft = 99;
      }).toThrow();
      expect(() => {
        fallbackShop.cards.push(null as never);
      }).toThrow();
    });
  });

  describe("runActivityScreen", () => {
    it("returns null for idle and inactive activities", () => {
      expect(runActivityScreen({ kind: "idle" })).toBeNull();
      expect(runActivityScreen({ kind: "inactive" })).toBeNull();
    });

    it("returns screen name for progress and visit activities", () => {
      expect(runActivityScreen({ kind: "battle" })).toBe("battle");
      expect(runActivityScreen({ kind: "campfire" })).toBe("campfire");
      expect(runActivityScreen({ kind: "shop", data: emptyShopState() })).toBe("shop");
    });
  });

  describe("transitionRunActivity", () => {
    it("preserves identical activity when target screen matches", () => {
      const current: RunActivity = { kind: "battle" };
      expect(transitionRunActivity(current, "battle")).toBe(current);
    });

    it("transitions to stateless progress screens", () => {
      expect(transitionRunActivity({ kind: "idle" }, "rewards")).toEqual({ kind: "rewards" });
      expect(transitionRunActivity({ kind: "idle" }, "campfire")).toEqual({ kind: "campfire" });
      expect(transitionRunActivity({ kind: "idle" }, "labyrinth-map")).toEqual({ kind: "labyrinth-map" });
    });

    it("transitions to visit screens with empty initialized state", () => {
      const shopActivity = transitionRunActivity({ kind: "idle" }, "shop");
      expect(shopActivity.kind).toBe("shop");
      if (shopActivity.kind === "shop") {
        expect(shopActivity.data.cards).toEqual([]);
        expect(shopActivity.data.refreshesLeft).toBe(SHOP_REFRESHES);
      }

      const mysteryActivity = transitionRunActivity({ kind: "idle" }, "mystery");
      expect(mysteryActivity.kind).toBe("mystery");
      if (mysteryActivity.kind === "mystery") {
        expect(mysteryActivity.data.mysteryEvent).toBeNull();
      }

      const corruptionActivity = transitionRunActivity({ kind: "idle" }, "corruption");
      expect(corruptionActivity).toEqual({ kind: "corruption", data: null });
    });

    it("preserves activity for unhandled screens", () => {
      const current: RunActivity = { kind: "battle" };
      // Options screen does not alter in-run activity
      expect(transitionRunActivity(current, "options")).toBe(current);
    });
  });
});
