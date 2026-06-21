import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { injectLabyrinthRun, makeHighDamageCard } from "./helpers";
import { critical } from "./playwright-tags";

test.describe("Labyrinth Full Flow", critical, () => {
  test("navigates to labyrinth map from an injected labyrin th run", async ({ page, fastBattle }) => {
    void fastBattle;
    await injectLabyrinthRun(page, {
      deck: Array.from({ length: 6 }, () => makeHighDamageCard()),
    });

    await expect(page.getByRole("heading", { name: /Labyrinth|Map/i })).toBeVisible({ timeout: 5000 });
  });
});
