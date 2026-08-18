import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { critical } from "./playwright-tags";
import { injectLabyrinthRun, makeHighDamageCard } from "./helpers";

test.describe("Labyrinth Mode", () => {
  test.beforeEach(async ({ runtimeErrors }) => {
    void runtimeErrors;
  });

  test("labyrinth map shows with combat and rest nodes available", critical, async ({ page }) => {
    await injectLabyrinthRun(page, { deck: Array.from({ length: 6 }, () => makeHighDamageCard()), resume: true });

    await expect(page.getByRole("heading", { name: /Labyrinth|Map/ })).toBeVisible({ timeout: 5000 });

    const combatNodes = page.getByRole("button", { name: /Combat|Fight/ });
    await expect(combatNodes.first()).toBeVisible({ timeout: 5000 });
  });
});
