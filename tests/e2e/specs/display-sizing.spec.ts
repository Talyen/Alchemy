import { controllerInput } from "../controller-input";
import { expect, test } from "../../fixtures/e2e";
import type { Locator } from "@playwright/test";
import {
  assertNoOverflow,
  assertStageFitsViewport,
  failOnRuntimeErrors,
  makeCard,
  startBattleWithDeck,
} from "../../browser-helpers";
import { MenuPage } from "../../pages/menu-page";
import { slow } from "../../playwright-tags";

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 3440, height: 1440 },
];

async function setSlider(slider: import("@playwright/test").Locator, value: number) {
  await slider.fill(String(value));
  await slider.dispatchEvent("input");
  await slider.dispatchEvent("change");
}

/**
 * Tooltips can detach between visibility and measurement under load, so
 * boundingBox() may briefly return null. Poll for a measurable box before
 * asserting containment instead of dereferencing a single read.
 */
async function expectTooltipFitsViewport(tip: Locator, viewport: { width: number; height: number }, slack = 1) {
  await expect(async () => {
    const bounds = await tip.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(-slack);
    expect(bounds!.y).toBeGreaterThanOrEqual(-slack);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + slack);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + slack);
  }).toPass({ timeout: 10_000 });
}

test.describe("Responsive display sizes", slow, () => {
  test("menu, collections, and options fit small and wide viewports", async ({ page }) => {
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

  test("independent size controls remain usable and survive reload", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.openOptions();
    await page.getByRole("button", { name: "Interface", exact: true }).click();
    await setSlider(page.getByRole("slider", { name: "Game Size", exact: true }), 80);
    await setSlider(page.getByRole("slider", { name: "Tooltip Size", exact: true }), 125);
    await expect(page.getByRole("slider", { name: "Game Size", exact: true })).toHaveValue("80");
    await expect(page.getByRole("slider", { name: "Tooltip Size", exact: true })).toHaveValue("125");
    await assertStageFitsViewport(page);
    await assertNoOverflow(page, "Options after resizing");
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

  test("battle cards and tooltips fit at large and small game sizes", async ({ page, fastBattle }) => {
    void fastBattle;
    for (const { gameSizePercent, viewport } of [
      { gameSizePercent: 120, viewport: { width: 1280, height: 720 } },
      { gameSizePercent: 80, viewport: { width: 3840, height: 2160 } },
    ]) {
      await page.addInitScript(
        ({ gameSizePercent }) => {
          localStorage.setItem(
            "alchemy-device-display-v1",
            JSON.stringify({ version: 1, gameSizePercent, tooltipSizePercent: 125 }),
          );
        },
        { gameSizePercent },
      );
      await page.setViewportSize(viewport);
      await startBattleWithDeck(
        page,
        Array.from({ length: 7 }, () => makeCard()),
      );
      await assertStageFitsViewport(page);
      const cards = page.locator('[aria-label^="Play "]');
      await expect(cards.first()).toBeVisible();
      await controllerInput(page).reach(cards.first());
      const tip = page.locator("#tooltip-root .hover-popup-panel[data-visible]").first();
      await expect(tip).toBeVisible();
      await expectTooltipFitsViewport(tip, viewport);
      await assertNoOverflow(page, `Battle ${viewport.width} at ${gameSizePercent}`);
      if (viewport.width === 1280)
        await page.screenshot({ path: `reports/controller-support/hand-${viewport.height}-${gameSizePercent}.png` });
    }
  });

  test("enemy Traits remain readable and inside the viewport in Collection and Battle", async ({ browser }) => {
    test.setTimeout(60_000);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = failOnRuntimeErrors(page);
    await page.addInitScript(
      (preferences) => localStorage.setItem("alchemy-device-display-v1", JSON.stringify(preferences)),
      { version: 1, gameSizePercent: 120, tooltipSizePercent: 125 },
    );
    try {
      await new MenuPage(page).gotoCollection({ encounteredEnemyIds: ["bandit"] });
      const tooltip = page.locator("#tooltip-root .hover-popup-panel[data-visible]");
      await page.getByRole("button", { name: "Bestiary", exact: true }).click();
      for (const screen of ["Collection", "Battle"]) {
        if (screen === "Battle") {
          await startBattleWithDeck(
            page,
            Array.from({ length: 6 }, () => makeCard()),
          );
          await expect(page.getByRole("button", { name: /^View Deck/ })).toHaveAttribute("aria-disabled", "false", {
            timeout: 20_000,
          });
          await page.getByTestId("battle-enemy-art-panel").hover();
        } else {
          await page.getByRole("button", { name: "Inspect Bandit", exact: true }).hover();
        }
        await expect(tooltip.locator("[data-trait]").first()).toBeVisible();
        await expectTooltipFitsViewport(tooltip, { width: 1280, height: 720 }, 0);
      }
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  test("collection retains its resized page across portrait and landscape tabs", async ({ page }) => {
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
    await expect(cards).toHaveCount(10, { timeout: 15_000 });
    await expect
      .poll(() => cards.locator("img").evaluateAll((images) => images.map((img) => img.getAttribute("src"))))
      .toContain(first);
    for (const tab of ["Trinkets", "Bestiary"]) {
      const previousArt = await cards.first().locator("img").first().getAttribute("src");
      await page.getByRole("button", { name: tab, exact: true }).click();
      await expect.poll(() => cards.first().locator("img").first().getAttribute("src")).not.toBe(previousArt);
      await page.getByRole("button", { name: "Cards", exact: true }).click();
      await expect(cards).toHaveCount(10, { timeout: 15_000 });
      await expect
        .poll(() => cards.locator("img").evaluateAll((images) => images.map((img) => img.getAttribute("src"))))
        .toContain(first);
    }
  });

  test("hero descriptions fit at maximum tooltip size on a small viewport", async ({ page }) => {
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
      await expect(async () => {
        const bounds = await tooltip.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.y).toBeGreaterThanOrEqual(-1);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(721);
      }).toPass({ timeout: 10_000 });
    }
    await expect
      .poll(() =>
        page
          .locator("#tooltip-root .hover-popup-panel[data-visible]")
          .last()
          .evaluate((el) => getComputedStyle(el).opacity),
      )
      .toBe("1");
  });
});

test("keyboard Options and confirmation fit at 1280×720", async ({ page }, testInfo) => {
  const height = 720;
  await page.setViewportSize({ width: 1280, height });
  await page.goto("/");
  const input = controllerInput(page);
  await input.activate(page.getByRole("button", { name: "Options", exact: true }));
  await input.activate(page.getByRole("button", { name: "Sound", exact: true }));
  const volume = page.getByRole("slider", { name: "Music Volume", exact: true });
  await input.reach(volume);
  await expect(volume).toBeInViewport();
  await expectTooltipFitsViewport(volume, { width: 1280, height });
  await page.screenshot({ path: `reports/controller-support/options-${height}.png` });
  const renderedText = await page.getByText("Music Volume", { exact: true }).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const scale = rect.height / (element as HTMLElement).offsetHeight;
    return parseFloat(getComputedStyle(element).fontSize) * scale;
  });
  await testInfo.attach("rendered-label-font-size", {
    body: `${renderedText.toFixed(1)} CSS pixels after scaling; not a physical glyph-height measurement`,
    contentType: "text/plain",
  });
  expect(renderedText).toBeGreaterThanOrEqual(12);
  await input.activate(page.getByRole("button", { name: "Other", exact: true }));
  await input.activate(page.getByRole("button", { name: "Clear Save Data", exact: true }));
  const dialog = page.getByRole("dialog");
  await expectTooltipFitsViewport(dialog, { width: 1280, height });
  const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
  await expect(cancel).toBeFocused();
  await expect(cancel).toBeInViewport();
  await expect(cancel).toBeVisible();
  await page.screenshot({ path: `reports/controller-support/confirmation-${height}.png` });
  await input.press("back");
  await expect(dialog).toHaveCount(0);
});
