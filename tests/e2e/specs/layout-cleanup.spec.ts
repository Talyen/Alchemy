import { expect, test } from "../../fixtures/e2e";
import type { Locator } from "@playwright/test";
import {
  makeCard,
  readSavedGame,
  withSavedGame,
  startAtDestination,
  waitForLayoutSettled,
  assertNoOverflow,
} from "../../browser-helpers";
import { MenuPage } from "../../pages/menu-page";
import { ShopPage } from "../../pages/shop-page";
import { critical, slow } from "../../playwright-tags";

async function boxes(locator: Locator) {
  return locator.evaluateAll((elements) =>
    elements.map((element) => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
}

test("Corruption picker capacity is independent of resize history and preserves selection", slow, async ({ page }) => {
  await page.setViewportSize({ width: 1470, height: 956 });
  await startAtDestination(page, {}, { forceDestination: "Corruption" });
  await page.getByRole("button", { name: "Corruption", exact: true }).click();
  await page.getByRole("button", { name: "Corrupt a Card", exact: true }).click();
  const cards = page.getByRole("button", { name: /^Select / });
  await waitForLayoutSettled(page, cards);
  await cards.first().click();
  await page.mouse.move(0, 0);
  await waitForLayoutSettled(page, cards);
  const initial = await boxes(cards);
  await expect(page.getByRole("button", { name: "Corrupt", exact: true })).toBeEnabled();
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1470, height: 956 },
  ]) {
    await page.setViewportSize(viewport);
    await page.mouse.move(0, 0);
    await waitForLayoutSettled(page, cards);
  }
  await expect(cards).toHaveCount(initial.length);
  const final = await boxes(cards);
  for (const [index, rect] of final.entries()) {
    expect(Math.abs(rect.x - initial[index]!.x)).toBeLessThan(2);
    expect(Math.abs(rect.y - initial[index]!.y)).toBeLessThan(2);
  }
  await expect(page.getByRole("button", { name: "Corrupt", exact: true })).toBeEnabled();
});

test("Collection and Homestead keep reachable actions at maximum Game Size", slow, async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "alchemy-device-display-v1",
      JSON.stringify({ version: 1, gameSizePercent: 120, tooltipSizePercent: 125 }),
    );
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  const menu = new MenuPage(page);
  await menu.gotoCollection();
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  await waitForLayoutSettled(page, page.getByRole("button", { name: /^Inspect/ }));
  await assertNoOverflow(page, "Collection at maximum Game Size");
  await expect(page.getByRole("button", { name: "Next page", exact: true })).toBeInViewport();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await menu.openHomestead();
  await waitForLayoutSettled(page, page.getByRole("button", { name: /^Build / }));
  await assertNoOverflow(page, "Homestead at maximum Game Size");
  await expect(page.getByRole("button", { name: "Next page", exact: true })).toBeInViewport();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await menu.expectMainMenu();
});

test(
  "Card Shop removal preserves selection through resize, charges once, and survives resume",
  critical,
  async ({ page, fastBattle }) => {
    void fastBattle;
    await page.setViewportSize({ width: 1470, height: 956 });
    await startAtDestination(
      page,
      {
        runGold: 9999,
        runDeck: [
          makeCard({ id: "bash", uid: 201 }),
          ...Array.from({ length: 5 }, (_, index) => makeCard({ uid: 202 + index })),
        ],
      },
      { forceDestination: "Card Shop" },
    );
    await page.getByRole("button", { name: "Card Shop", exact: true }).click();
    await page.getByRole("button", { name: /^Remove Card/ }).click();
    const cards = page.getByRole("button", { name: /^Select / });
    await waitForLayoutSettled(page, cards);
    const cancel = page.getByRole("button", { name: "Cancel", exact: true });
    await expect(cards).toHaveCount(6);
    const heading = page.getByRole("heading", { name: "Remove Card", exact: true });
    await expect(heading).toBeInViewport();
    await expect(cancel).toBeInViewport();
    const shop = new ShopPage(page);
    const saved = await readSavedGame(page);
    const before = saved.activeRun!;
    const goldBefore = saved.gold;
    const selected = page.getByRole("button", { name: "Select Bash", exact: true });
    await selected.click();
    // Cancelling must leave the same deck and Gold available for a later removal.
    await cancel.click();
    await expect(shop.heading).toBeVisible();
    expect(await shop.gold()).toBe(goldBefore);
    expect((await readSavedGame(page)).activeRun?.runDeck).toEqual(before.runDeck);
    await shop.startCardRemoval();
    await selected.click();
    const remove = page.getByRole("button", { name: /^Remove Gold/ });
    await expect(remove).toBeEnabled();
    await page.setViewportSize({ width: 1280, height: 720 });
    await waitForLayoutSettled(page, cards);
    await expect(cancel).toBeInViewport();
    await expect(remove).toBeInViewport();
    await expect(remove).toBeEnabled();
    const price = Number((await remove.locator("span.tabular-nums").last().innerText()).replaceAll(",", ""));
    expect(price).toBeGreaterThan(0);
    await remove.click({ clickCount: 2, delay: 20 });
    await expect(shop.heading).toBeVisible();
    await expect.poll(() => shop.gold()).toBe(goldBefore - price);
    const expectedDeck = before.runDeck.filter((card) => card.id !== "bash");
    expect(expectedDeck).toHaveLength(5);
    await expect.poll(async () => (await readSavedGame(page)).activeRun?.runDeck).toEqual(expectedDeck);
    await withSavedGame(page, async (resumed) => {
      await expect(new ShopPage(resumed).heading).toBeVisible();
      expect(await new ShopPage(resumed).gold()).toBe(goldBefore - price);
      expect((await readSavedGame(resumed)).activeRun?.runDeck).toEqual(expectedDeck);
      await expect(resumed.getByRole("button", { name: "Remove Card - Sold Out", exact: true })).toBeDisabled();
      await resumed.getByRole("button", { name: "View Deck · 5 cards" }).click();
      await expect(resumed.getByRole("dialog").getByRole("img", { name: "Bash", exact: true })).toHaveCount(0);
      await expect(resumed.getByRole("dialog").getByRole("img", { name: "Slash", exact: true })).toHaveCount(5);
    });
  },
);
