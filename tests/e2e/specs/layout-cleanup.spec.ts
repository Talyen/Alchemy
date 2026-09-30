import { expect, test } from "../../fixtures/e2e";
import type { Locator, Page } from "@playwright/test";
import {
  injectSaveState,
  makeStartingDeck,
  destinationInterruptedFlow,
  waitForLayoutSettled,
  assertNoOverflow,
} from "../../browser-helpers";
import { MenuPage } from "../../pages/menu-page";
import { slow } from "../../playwright-tags";

async function boxes(locator: Locator) {
  return locator.evaluateAll((elements) =>
    elements.map((element) => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
}

async function expectCenteredRows(locator: Locator, maxColumns: number, width: number) {
  const rects = await boxes(locator);
  expect(rects.length).toBeGreaterThan(0);
  const rows: Array<typeof rects> = [];
  for (const rect of rects) {
    const row = rows.find((items) => Math.abs(items[0]!.y - rect.y) < 4);
    if (row) row.push(rect);
    else rows.push([rect]);
  }
  for (const row of rows) {
    expect(row.length).toBeLessThanOrEqual(maxColumns);
    const left = Math.min(...row.map((r) => r.x));
    const right = Math.max(...row.map((r) => r.x + r.width));
    expect(Math.abs((left + right) / 2 - width / 2)).toBeLessThan(2);
  }
}

async function lastPage(page: Page, target: Locator) {
  const next = page.getByRole("button", { name: "Next page", exact: true });
  if ((await next.count()) === 0) return;
  for (let count = 0; count < 50 && (await next.isEnabled()); count += 1) {
    await next.click();
    await waitForLayoutSettled(page, target);
  }
  await expect(next).toBeDisabled();
}

async function expectNearbyPagination(page: Page, tiles: Locator) {
  const rects = await boxes(tiles);
  const pager = await page.getByRole("button", { name: "Next page", exact: true }).boundingBox();
  expect(pager).not.toBeNull();
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  const scale = await page.evaluate(() =>
    Number(getComputedStyle(document.documentElement).getPropertyValue("--content-scale")),
  );
  expect(pager!.y - bottom).toBeGreaterThanOrEqual(-1);
  expect(pager!.y - bottom).toBeLessThanOrEqual(24 * scale + 2);
}

test(
  "Collection keeps its column limits and centered rows on short, tall, and large displays",
  slow,
  async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1470, height: 738 });
    await new MenuPage(page).gotoCollection();
    const tiles = page.getByRole("button", { name: /^Inspect/ });
    for (const viewport of [
      { width: 1470, height: 738 },
      { width: 1470, height: 956 },
      { width: 3840, height: 2160 },
      { width: 3440, height: 1440 },
    ]) {
      await page.setViewportSize(viewport);
      for (const tab of ["Heroes", "Cards", "Bestiary", "Trinkets", "Uniques"]) {
        await page.getByRole("button", { name: tab, exact: true }).click();
        await page.mouse.move(0, 0);
        await waitForLayoutSettled(page, tiles);
        await expectCenteredRows(tiles, tab === "Bestiary" ? 3 : 4, viewport.width);
      }
    }
  },
);

test("short Collection and Homestead pages center their items and keep pagination nearby", slow, async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1470, height: 956 });
  const menu = new MenuPage(page);
  await menu.gotoCollection();
  await page.getByRole("button", { name: "Heroes", exact: true }).click();
  await waitForLayoutSettled(page, page.getByRole("button", { name: /^Inspect/ }));
  await expect(page.getByRole("button", { name: "Next page", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  const cards = page.getByRole("button", { name: /^Inspect/ });
  await waitForLayoutSettled(page, cards);
  await lastPage(page, cards);
  await expectCenteredRows(cards, 4, 1470);
  await expectNearbyPagination(page, cards);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await menu.openHomestead();
  const nodes = page.getByRole("button", { name: /^Build / });
  await waitForLayoutSettled(page, nodes);
  await lastPage(page, nodes);
  await expectCenteredRows(nodes, 3, 1470);
  await expectNearbyPagination(page, nodes);
});

test("Corruption picker capacity is independent of resize history and preserves selection", slow, async ({ page }) => {
  await page.setViewportSize({ width: 1470, height: 956 });
  await injectSaveState(page, {
    runDeck: makeStartingDeck(),
    currentScreen: "destination",
    interruptedFlow: destinationInterruptedFlow(["Corruption"]),
  });
  await page.goto("/");
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
  await expectCenteredRows(cards, 4, 1470);
});

test("loading caption retains its reference size and follows proportional growth", slow, async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("alchemy-skip-loading-screen"));
  for (const { viewport, factor } of [
    { viewport: { width: 1470, height: 738 }, factor: 1 },
    { viewport: { width: 2940, height: 1476 }, factor: 2 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const loading = page.getByRole("progressbar", { name: "Loading Alchemy" });
    await expect(loading).toBeVisible();
    await expect
      .poll(() => loading.locator("p").evaluate((el) => parseFloat(getComputedStyle(el).fontSize)))
      .toBeCloseTo(12 * factor, 1);
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 30_000 });
  }
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
  "Card Shop removal bounds its fitting area and preserves confirmation through resizing",
  slow,
  async ({ page }) => {
    await page.setViewportSize({ width: 1470, height: 956 });
    await injectSaveState(page, {
      gold: 9999,
      runDeck: makeStartingDeck(),
      currentScreen: "destination",
      interruptedFlow: destinationInterruptedFlow(["Card Shop"]),
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Card Shop", exact: true }).click();
    await page.getByRole("button", { name: /^Remove Card/ }).click();
    const cards = page.getByRole("button", { name: /^Select / });
    await waitForLayoutSettled(page, cards);
    const cancel = page.getByRole("button", { name: "Cancel", exact: true });
    await expect(cards).toHaveCount(6);
    const heading = page.getByRole("heading", { name: "Remove Card", exact: true });
    const top = (await heading.boundingBox())!.y;
    const bottom = (await cancel.boundingBox())!;
    expect(Math.abs((top + bottom.y + bottom.height) / 2 - 956 / 2)).toBeLessThan(3);
    expect(bottom.y - Math.max(...(await boxes(cards)).map((r) => r.y + r.height))).toBeLessThan(100);
    await cards.first().click();
    const remove = page.getByRole("button", { name: /^Remove Gold/ });
    await expect(remove).toBeEnabled();
    await page.setViewportSize({ width: 1280, height: 720 });
    await waitForLayoutSettled(page, cards);
    await expect(cancel).toBeInViewport();
    await expect(remove).toBeInViewport();
    await expect(remove).toBeEnabled();
    await remove.click();
    await expect(page.getByRole("heading", { name: "Card Shop", exact: true })).toBeVisible();
  },
);
