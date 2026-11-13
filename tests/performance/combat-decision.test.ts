import type { Locator, Page } from "@playwright/test";
import { expect, it, vi } from "vitest";
import { resolveWishPanels } from "../../performance/combat-decision";

it("resolves a second Wish that is mounted but hidden between offers", async () => {
  let state: "first" | "transition" | "second" | "absent" = "first";
  let transitionChecks = 0;
  const buttons = {} as Locator;
  const handle = {
    evaluate: vi.fn(async () => true),
    waitForElementState: vi.fn(async () => {
      state = state === "first" ? "transition" : "absent";
    }),
    dispose: vi.fn(async () => {}),
  };
  const panel = {
    isVisible: vi.fn(async () => {
      if (state === "transition" && transitionChecks++ > 0) state = "second";
      return state === "first" || state === "second";
    }),
    count: vi.fn(async () => (state === "absent" ? 0 : 1)),
    elementHandle: vi.fn(async () => handle),
    getByRole: vi.fn(() => buttons),
  };
  const page = { locator: vi.fn(() => panel) } as unknown as Page;
  const choose = vi.fn(async () => {});

  await resolveWishPanels(page, choose);

  expect(choose).toHaveBeenCalledTimes(2);
  expect(choose).toHaveBeenCalledWith(buttons);
  expect(transitionChecks).toBeGreaterThan(1);
  expect(state).toBe("absent");
});
