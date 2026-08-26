import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { critical } from "./playwright-tags";
import { injectLabyrinthRun, makeHighDamageCard } from "./helpers";

test.describe("Labyrinth Mode", critical, () => {
  test.beforeEach(async ({ runtimeErrors }) => {
    void runtimeErrors;
  });

  test("labyrinth map shows hex seals and a side inspector", critical, async ({ page }) => {
    await injectLabyrinthRun(page, { deck: Array.from({ length: 6 }, () => makeHighDamageCard()), resume: true });

    await expect(page.getByRole("heading", { name: /Labyrinth|Map/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("region", { name: "Labyrinth map" })).toBeVisible();
    await expect(page.getByText("Choose a reachable chamber")).toBeVisible();

    const combatNodes = page.getByRole("button", { name: /Combat chamber/ });
    await expect(combatNodes.first()).toBeVisible({ timeout: 5000 });
    await combatNodes.first().click();
    await expect(page.getByRole("button", { name: "Fight" }).first()).toBeVisible();
  });
});
