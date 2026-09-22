import { expect, test } from "../../fixtures/e2e";
import { controllerInput } from "../controller-input";
import { injectLabyrinthRun, makeCard } from "../../browser-helpers";
import { gridLabyrinthMapFixture } from "../../fixtures/labyrinth-map";
import { BattlePage } from "../../pages/battle-page";

// A real overflowing UI, seeded before navigation; no wheel/scroll DOM shortcuts.
test("mapped cursor clicks, hover inspection and wheel scrolling work together", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
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
  await expect(scroller).toBeVisible();
  expect(await scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await input.point(scroller);
  await input.scroll(5000);
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(details.locator('[data-trait="alchemist"]')).toBeInViewport();
  await clickNamed("Fight");
  await new BattlePage(page).waitForOpeningHand();
  await input.point(page.getByTestId("battle-enemy-art-panel"));
  await expect(page.locator(".hover-popup-panel[data-visible]")).toContainText("Vampire");
});
