// Playwright test fixture: fast battle mode + runtime error collection with auto-assert.
import { test as base, expect } from "@playwright/test";
import { enableFastMode, failOnRuntimeErrors } from "../helpers";

type E2EFixtures = {
  fastBattle: void;
  runtimeErrors: string[];
};

export const test = base.extend<E2EFixtures>({
  fastBattle: async ({ page }, run) => {
    await enableFastMode(page);
    await run();
  },
  runtimeErrors: async ({ page }, run) => {
    const errors = failOnRuntimeErrors(page);
    await run(errors);
    expect(errors).toEqual([]);
  },
});
