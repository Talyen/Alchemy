import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { injectLabyrinthRun, makeHighDamageCard } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { critical } from "./playwright-tags";

function labyrinthNode(row: number, col: number, type: string, state: string) {
  return {
    type,
    modifiers: [],
    rewardModifiers: [],
    connections: [{ row: row + 1, col }],
    state,
  };
}

function makeLabyrinthGrid(rows: number, cols: number, nodeTypes: string[]) {
  const grid: (Record<string, unknown> | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null),
  );
  nodeTypes.forEach((type, r) => {
    const col = Math.floor(cols / 2);
    grid[r][col] = labyrinthNode(r, col, type, r === 0 ? "current" : "visible");
  });
  return { grid, rows, cols, currentNode: { row: 0, col: Math.floor(cols / 2) } };
}

test.describe("Labyrinth Full Flow", critical, () => {
  test("rest chamber restores health", async ({ page, fastBattle }) => {
    void fastBattle;
    const labyrinth = makeLabyrinthGrid(2, 9, ["rest", "boss"]);
    await injectLabyrinthRun(page, {
      deck: Array.from({ length: 6 }, () => makeHighDamageCard()),
      runOverrides: {
        runPlayerHealth: 10,
        runMaxHealth: 30,
        labyrinthMap: labyrinth,
      },
      resume: true,
    });

    await expect(page.getByRole("heading", { name: /Labyrinth|Map/ })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /Rest chamber/ }).click();
    await new MenuPage(page).stage.expectRunPhase("runLoop");
  });

  test("treasure chamber grants gold", async ({ page, fastBattle }) => {
    void fastBattle;
    const labyrinth = makeLabyrinthGrid(2, 9, ["treasure", "boss"]);
    await injectLabyrinthRun(page, {
      deck: Array.from({ length: 6 }, () => makeHighDamageCard()),
      runOverrides: {
        runGold: 10,
        labyrinthMap: labyrinth,
      },
      resume: true,
    });

    await expect(page.getByRole("heading", { name: /Labyrinth|Map/ })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /Treasure chamber/ }).click();
    await new MenuPage(page).stage.expectRunPhase("runLoop");
  });

  test("reaching the labyrinth boss starts a boss battle", async ({ page, fastBattle }) => {
    void fastBattle;
    const labyrinth = makeLabyrinthGrid(2, 9, ["boss", "boss"]);
    await injectLabyrinthRun(page, {
      deck: Array.from({ length: 6 }, () => makeHighDamageCard()),
      runOverrides: { labyrinthMap: labyrinth },
      resume: true,
    });

    await expect(page.getByRole("heading", { name: /Labyrinth|Map/ })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /Boss chamber/ }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
  });
});
