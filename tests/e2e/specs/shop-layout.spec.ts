import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { startAtDestination, makeCard } from "../../helpers";
import { ShopPage } from "../../pages/shop-page";
import { critical } from "../../playwright-tags";

for (const destination of ["Card Shop", "Alchemist's Shop", "Gear Shop", "Trinket Shop"] as const) {
  test(`${destination} keeps artwork and layout stable after purchases`, critical, async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    await startAtDestination(page, { runGold: 9999 }, { forceDestination: destination });
    await page.getByRole("button", { name: destination, exact: true }).click();
    await expect(page.getByRole("heading", { name: destination, exact: true })).toBeVisible();
    const shop = new ShopPage(page);
    const items = page.locator("button.surface");
    const leave = page.getByRole("button", { name: "Leave", exact: true });
    await expect(shop.buyBtn.first()).toBeVisible();
    await leave.hover();
    const geometry = () =>
      items.evaluateAll((elements) =>
        elements.map((element) => {
          const art = element.querySelector("img")!;
          const box = art.getBoundingClientRect();
          return { x: box.x, y: box.y, width: box.width, height: box.height };
        }),
      );
    await items.evaluateAll(async (elements) => {
      await Promise.all(elements.flatMap((element) => element.getAnimations()).map((animation) => animation.finished));
    });
    await expect(items.first()).toHaveCSS("border-top-width", "1px");
    const before = await geometry();
    const leaveBefore = await leave.boundingBox();
    while (await shop.buyBtn.count()) {
      await shop.buyCard();
      await shop.waitForPurchase();
      await leave.hover();
      await expect.poll(geometry).toEqual(before);
      await expect.poll(() => leave.boundingBox()).toEqual(leaveBefore);
    }
  });
}

test("Mixed Potion result shows the reward directly below the header", critical, async ({ page, runtimeErrors }) => {
  void runtimeErrors;
  await startAtDestination(
    page,
    {
      runGold: 9999,
      runDeck: [makeCard({ id: "health-potion" }), makeCard({ id: "mana-potion" })],
    },
    { forceDestination: "Alchemist's Shop" },
  );
  await page.getByRole("button", { name: "Alchemist's Shop", exact: true }).click();
  const shop = new ShopPage(page);
  await shop.mixPotions();
  await expect(page.getByText(/Added to Deck/i)).toHaveCount(0);
  await expect(shop.goldText).toHaveCount(0);
  const reward = page.getByRole("button", { name: "Mixed Potion", exact: true });
  await expect(reward).toBeVisible();
  const header = await page.getByRole("heading", { name: "Alchemist's Shop", exact: true }).boundingBox();
  const card = await reward.boundingBox();
  expect(card!.y - (header!.y + header!.height)).toBeLessThan(40);
});
