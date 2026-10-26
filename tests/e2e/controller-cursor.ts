import { expect, type Page } from "@playwright/test";
import { controllerInput } from "./controller-input";
import { injectLabyrinthRun, makeCard } from "../browser-helpers";
import { gridLabyrinthMapFixture } from "../fixtures/labyrinth-map";
import { BattlePage } from "../pages/battle-page";

/** Pointer and keyboard inspect the same room before a single activation enters combat. */
export async function exerciseControllerCursor(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "alchemy-device-display-v1",
      JSON.stringify({ version: 1, gameSizePercent: 120, tooltipSizePercent: 100 }),
    );
  });
  const map = gridLabyrinthMapFixture();
  const node = map.nodes["labyrinth-floor-1-n0"]!;
  node.enemyId = "vampire";
  node.modifiers = ["caustic", "flesheater", "tempered", "plated", "jealous", "rooted"];
  node.rewardModifiers = ["generous", "scavenger", "companion", "alchemist"];
  await injectLabyrinthRun(page, { labyrinthMap: map, deck: Array.from({ length: 6 }, () => makeCard()) });
  const input = controllerInput(page);
  const room = page.locator(`[data-labyrinth-node="${node.id}"] button`);
  await expect(room).toBeVisible();
  await input.point(room);
  const details = page.locator('[role="tooltip"][data-visible]');
  await expect(details).toContainText("Vampire");
  await expect(page.locator("html")).toHaveAttribute("data-focus-navigation", "false");
  await input.press("previous");
  await input.reach(room);
  await expect(room).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-focus-navigation", "true");
  await expect(details).toContainText("Alchemist");
  await input.scroll(5000);
  await expect(details).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-focus-navigation", "false");
  await expect(room).toBeFocused();
  await expect(room).toHaveCSS("outline-style", "none");
  await input.press("down");
  await expect(page.locator("html")).toHaveAttribute("data-focus-navigation", "true");
  await input.point(room);
  await input.click();
  await new BattlePage(page).waitForOpeningHand();
  await expect(page.locator("html")).toHaveAttribute("data-focus-navigation", "false");
  expect(await page.getByTestId("battle-hand").evaluate((hand) => hand.contains(document.activeElement))).toBe(false);
  await input.point(page.getByTestId("battle-enemy-art-panel"));
  await expect(page.locator(".hover-popup-panel[data-visible]")).toContainText("Vampire");
}
