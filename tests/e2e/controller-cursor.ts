import { expect, type Page } from "@playwright/test";
import { controllerInput } from "./controller-input";
import { injectLabyrinthRun, makeCard, waitForLayoutSettled } from "../browser-helpers";
import { gridLabyrinthMapFixture } from "../fixtures/labyrinth-map";
import { BattlePage } from "../pages/battle-page";

/** Overflowing inspector uses native wheel events, including after keyboard inspection. */
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
  node.modifiers = ["caustic", "flesheater", "tempered", "plated"];
  node.rewardModifiers = ["generous", "alchemist"];
  await injectLabyrinthRun(page, { labyrinthMap: map, deck: Array.from({ length: 6 }, () => makeCard()) });
  const input = controllerInput(page);
  async function clickNamed(name: string) {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toBeVisible();
    await expect.poll(() => button.evaluate((element) => !element.closest("[inert]"))).toBe(true);
    await input.point(button);
    await input.click();
  }
  const room = page.locator(`[data-labyrinth-node="${node.id}"] button`);
  await expect(room).toBeVisible();
  await input.point(room);
  await input.click();
  const details = page.getByRole("complementary", { name: "Chamber details" });
  const scroller = details.locator(".overflow-y-auto");
  await waitForLayoutSettled(page, details);
  await expect.poll(() => scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-focus-navigation", "false");
  expect(await details.evaluate((element) => element.contains(document.activeElement))).toBe(false);
  await input.press("previous");
  await input.reach(room);
  await expect(room).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-focus-navigation", "true");
  await input.point(scroller);
  await input.scroll(5000);
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(details.locator('[data-trait="alchemist"]')).toBeInViewport();
  await expect(page.locator("html")).toHaveAttribute("data-focus-navigation", "false");
  await expect(room).toBeFocused();
  await expect(room).toHaveCSS("outline-style", "none");
  await input.press("down");
  await expect(page.locator("html")).toHaveAttribute("data-focus-navigation", "true");
  await clickNamed("Fight");
  await new BattlePage(page).waitForOpeningHand();
  await expect(page.locator("html")).toHaveAttribute("data-focus-navigation", "false");
  expect(await page.getByTestId("battle-hand").evaluate((hand) => hand.contains(document.activeElement))).toBe(false);
  await input.point(page.getByTestId("battle-enemy-art-panel"));
  await expect(page.locator(".hover-popup-panel[data-visible]")).toContainText("Vampire");
}
