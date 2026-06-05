import { beforeEach, describe, expect, it } from "vitest";
import { useNavigationStore } from "@/features/alchemy/shared/stores/navigation-store";

beforeEach(() => {
  useNavigationStore.setState(useNavigationStore.getInitialState(), true);
});

describe("navigation-store", () => {
  it("defaults to menu screen", () => {
    expect(useNavigationStore.getState().screen).toBe("menu");
  });

  it("setScreen accepts a direct value", () => {
    useNavigationStore.getState().setScreen("battle");
    expect(useNavigationStore.getState().screen).toBe("battle");
  });

  it("setScreen accepts an updater function", () => {
    useNavigationStore.getState().setScreen("shop");
    useNavigationStore.getState().setScreen((prev) => (prev === "shop" ? "battle" : prev));
    expect(useNavigationStore.getState().screen).toBe("battle");
  });

  it("reset returns to menu", () => {
    useNavigationStore.getState().setScreen("rewards");
    useNavigationStore.getState().reset();
    expect(useNavigationStore.getState().screen).toBe("menu");
  });
});
