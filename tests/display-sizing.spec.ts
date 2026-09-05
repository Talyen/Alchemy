import { expect, test } from "./fixtures/e2e";
import {
  assertNoOverflow,
  assertStageFitsViewport,
  makeCard,
  startBattleWithDeck,
  injectActiveBattle,
  makeGoblinBattleState,
} from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { slow } from "./playwright-tags";

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1470, height: 956 },
  { width: 1512, height: 982 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
  { width: 3440, height: 1440 },
];

async function setSlider(slider: import("@playwright/test").Locator, value: number) {
  await slider.fill(String(value));
  await slider.dispatchEvent("input");
  await slider.dispatchEvent("change");
}

test.describe("Responsive display sizes", slow, () => {
  test("menu, collections, and options fit the viewport matrix", async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    test.setTimeout(60000);
    const menu = new MenuPage(page);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await menu.goto();
      await menu.expectMainMenuAfterColdStart();
      await assertStageFitsViewport(page);
      await assertNoOverflow(page, `Menu ${viewport.width}`);
      await menu.openCollection();
      await assertNoOverflow(page, `Collection ${viewport.width}`);
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await menu.openOptions();
      await page.getByRole("button", { name: "Interface", exact: true }).click();
      await expect(page.getByRole("slider", { name: "Game Size", exact: true })).toHaveValue("100");
      await assertNoOverflow(page, `Options ${viewport.width}`);
    }
  });

  test("independent size controls apply live and survive reload", async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    await page.setViewportSize({ width: 1920, height: 1080 });
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.openOptions();
    await page.getByRole("button", { name: "Interface", exact: true }).click();
    const initialContentScale = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--content-scale"),
    );
    await setSlider(page.getByRole("slider", { name: "Game Size", exact: true }), 80);
    const smallContentScale = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--content-scale"),
    );
    expect(Number(smallContentScale) / Number(initialContentScale)).toBeCloseTo(0.8, 1);
    const initialTooltipScale = await page
      .locator("#tooltip-root")
      .evaluate((el) => getComputedStyle(el).getPropertyValue("--content-scale"));
    await setSlider(page.getByRole("slider", { name: "Tooltip Size", exact: true }), 125);
    const largeTooltipScale = await page
      .locator("#tooltip-root")
      .evaluate((el) => getComputedStyle(el).getPropertyValue("--content-scale"));
    expect(Number(largeTooltipScale) / Number(initialTooltipScale)).toBeCloseTo(1.25);
    await page.reload();
    await menu.openOptions();
    await page.getByRole("button", { name: "Interface", exact: true }).click();
    await expect(page.getByRole("slider", { name: "Game Size", exact: true })).toHaveValue("80");
    await expect(page.getByRole("slider", { name: "Tooltip Size", exact: true })).toHaveValue("125");
    await page.getByRole("button", { name: "Other", exact: true }).click();
    await page.getByRole("button", { name: "Reset to Default", exact: true }).click();
    await page.getByRole("button", { name: "Interface", exact: true }).click();
    await expect(page.getByRole("slider", { name: "Game Size", exact: true })).toHaveValue("100");
    await expect(page.getByRole("slider", { name: "Tooltip Size", exact: true })).toHaveValue("100");
  });

  test("battle cards and tooltips fit at large and small game sizes", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    for (const gameSizePercent of [80, 120]) {
      await page.addInitScript(
        ({ gameSizePercent }) => {
          localStorage.setItem(
            "alchemy-device-display-v1",
            JSON.stringify({ version: 1, gameSizePercent, tooltipSizePercent: 125 }),
          );
        },
        { gameSizePercent },
      );
      await page.setViewportSize({ width: 1280, height: 720 });
      await startBattleWithDeck(
        page,
        Array.from({ length: 7 }, () => makeCard()),
      );
      await assertStageFitsViewport(page);
      const cards = page.locator('[aria-label^="Play "]');
      await expect(cards.first()).toBeVisible();
      for (const viewport of [
        { width: 1280, height: 720 },
        { width: 3840, height: 2160 },
      ]) {
        await page.setViewportSize(viewport);
        await cards.first().hover();
        const tip = page.locator("#tooltip-root .hover-popup-panel[data-visible]").first();
        await expect(tip).toBeVisible();
        const bounds = await tip.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(-1);
        expect(bounds!.y).toBeGreaterThanOrEqual(-1);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
        await assertNoOverflow(page, `Battle ${viewport.width} at ${gameSizePercent}`);
      }
    }
  });

  test("seven-card hands stay reachable at maximum game size", async ({
    page,
    fastBattle,
    runtimeErrors,
  }, testInfo) => {
    void fastBattle;
    void runtimeErrors;
    await page.addInitScript(() => {
      localStorage.setItem(
        "alchemy-device-display-v1",
        JSON.stringify({ version: 1, gameSizePercent: 120, tooltipSizePercent: 125 }),
      );
    });
    await page.setViewportSize({ width: 1280, height: 720 });
    const hand = Array.from({ length: 7 }, () => makeCard());
    await injectActiveBattle(page, makeGoblinBattleState({ hand }), { runDeck: hand });
    const cards = page.locator('[aria-label^="Play "]');
    await expect(cards).toHaveCount(7);
    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 3840, height: 2160 },
    ]) {
      await page.setViewportSize(viewport);
      for (const index of [0, 3, 6]) {
        await page.mouse.move(10, 10);
        const card = cards.nth(index);
        let position: { x: number; y: number } | null = null;
        await expect(async () => {
          position = await card.evaluate((el) => {
            const bounds = el.getBoundingClientRect();
            for (const y of [0.6, 0.4, 0.8]) {
              for (const x of [0.2, 0.4, 0.6, 0.8]) {
                const hit = document.elementFromPoint(bounds.x + bounds.width * x, bounds.y + bounds.height * y);
                if (hit && el.contains(hit)) return { x: bounds.width * x, y: bounds.height * y };
              }
            }
            return null;
          });
          expect(position).not.toBeNull();
        }).toPass();
        await card.hover({ position: position! });
        const bounds = await cards.nth(index).boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(-12);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 12);
      }
      await page.getByRole("button", { name: "End Turn", exact: true }).click({ trial: true });
      await expect.poll(() => cards.first().evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
      await expect
        .poll(() =>
          cards.evaluateAll((elements) => Math.max(...elements.map((el) => el.getBoundingClientRect().bottom))),
        )
        .toBeLessThanOrEqual(viewport.height + 12);
      await testInfo.attach(`seven-cards-${viewport.width}`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
    }
  });

  test("collection capacity increases and keeps the first visible item on resize", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await new MenuPage(page).gotoCollection();
    await page.getByRole("button", { name: "Cards", exact: true }).click();
    const cards = page.getByRole("button", { name: /Inspect/ });
    await expect(page.getByRole("button", { name: "Inspect Knight", exact: true })).toHaveCount(0);
    await expect(cards).toHaveCount(8);
    const before = await cards.first().locator("img").first().getAttribute("src");
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await expect.poll(() => cards.first().locator("img").first().getAttribute("src")).not.toBe(before);
    const first = await cards.first().locator("img").first().getAttribute("src");
    await page.setViewportSize({ width: 3840, height: 2160 });
    await expect(cards).toHaveCount(10);
    await expect
      .poll(() => cards.locator("img").evaluateAll((images) => images.map((img) => img.getAttribute("src"))))
      .toContain(first);
  });

  test("hero descriptions fit at maximum tooltip size on a small viewport", async ({
    page,
    runtimeErrors,
  }, testInfo) => {
    void runtimeErrors;
    await page.addInitScript(() => {
      localStorage.setItem(
        "alchemy-device-display-v1",
        JSON.stringify({ version: 1, gameSizePercent: 100, tooltipSizePercent: 125 }),
      );
    });
    await page.setViewportSize({ width: 1280, height: 720 });
    await new MenuPage(page).gotoCollection({
      finishedRunCharacters: ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid"],
    });
    const heroes = page.getByRole("button", { name: /Inspect/ });
    for (let index = 0; index < (await heroes.count()); index += 1) {
      await heroes.nth(index).hover();
      const tooltip = page.locator("#tooltip-root .hover-popup-panel[data-visible]").last();
      await expect(tooltip).toBeVisible();
      const bounds = await tooltip.boundingBox();
      expect(bounds!.y).toBeGreaterThanOrEqual(-1);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(721);
    }
    await expect
      .poll(() =>
        page
          .locator("#tooltip-root .hover-popup-panel[data-visible]")
          .last()
          .evaluate((el) => getComputedStyle(el).opacity),
      )
      .toBe("1");
    await testInfo.attach("hero-tooltip-125", { body: await page.screenshot(), contentType: "image/png" });
  });
});
