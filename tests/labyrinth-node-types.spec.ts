import { expect, test } from "@playwright/test";
import { injectLabyrinthRun, makeHighDamageCard } from "./helpers";

test.describe("Labyrinth Node Types", () => {
  test("labyrinth map shows with combat and rest nodes available", async ({ page }) => {
    await injectLabyrinthRun(page, { deck: Array.from({ length: 6 }, () => makeHighDamageCard()), resume: true });

    await expect(page.getByRole("heading", { name: /Labyrinth|Map/ })).toBeVisible({ timeout: 5000 });

    const combatNodes = page.getByRole("button", { name: /Combat|Fight/ });
    await expect(combatNodes.first()).toBeVisible({ timeout: 5000 });
  });
});
