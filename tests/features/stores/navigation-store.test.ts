import { beforeEach, describe, expect, it } from "vitest";
import {
  getNavigationStoreView,
  resetRunNavigationSlice,
} from "../../helpers/run-domain-store-test";

beforeEach(() => {
  resetRunNavigationSlice();
});

describe("navigation-store", () => {
  it("defaults to menu screen", () => {
    expect(getNavigationStoreView().screen).toBe("menu");
  });

  it("setScreen accepts a direct value", () => {
    getNavigationStoreView().setScreen("battle");
    expect(getNavigationStoreView().screen).toBe("battle");
  });

  it("setScreen accepts an updater function", () => {
    getNavigationStoreView().setScreen("shop");
    getNavigationStoreView().setScreen((prev) => (prev === "shop" ? "battle" : prev));
    expect(getNavigationStoreView().screen).toBe("battle");
  });

  it("reset returns to menu", () => {
    getNavigationStoreView().setScreen("rewards");
    getNavigationStoreView().reset();
    expect(getNavigationStoreView().screen).toBe("menu");
  });
});
