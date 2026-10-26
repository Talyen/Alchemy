import { expectUnfocused } from "../focus-input";
import { controllerInput } from "../controller-input";
import { expect, test } from "../../fixtures/e2e";
import type { Locator } from "@playwright/test";
import {
  assertNoOverflow,
  assertStageFitsViewport,
  makeCard,
  startAtDestination,
  startBattleWithDeck,
  waitForLayoutSettled,
} from "../../browser-helpers";
import { MenuPage } from "../../pages/menu-page";
import { slow } from "../../playwright-tags";
import { getVirtualResolutionLayout } from "../../../src/features/alchemy/shared/ui/use-virtual-resolution";
import { CONTENT_REFERENCE_VIEWPORT } from "../../../src/lib/game-constants/ui-layout";

// Representative CSS viewports cover narrow, standard, ultrawide, and 4K layouts.
const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 3440, height: 1440 },
  { width: 3840, height: 2160 },
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
    test.setTimeout(90000);
    const menu = new MenuPage(page);
    await menu.goto();
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await menu.expectMainMenuAfterColdStart();
      await assertStageFitsViewport(page);
      await assertNoOverflow(page, `Menu ${viewport.width}`);
      await menu.openCollection();
      await assertNoOverflow(page, `Collection ${viewport.width}`);
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await menu.openOptions();
      await page.getByRole("button", { name: "Display", exact: true }).click();
      await expect(page.getByRole("slider", { name: "Game Size", exact: true })).toHaveValue("100");
      await assertNoOverflow(page, `Options ${viewport.width}`);
      await expect(page.getByRole("slider", { name: "Background Particles", exact: true })).toBeInViewport();
      const scroll = page.locator(".game-page-scroll");
      await expect
        .poll(() => scroll.evaluate((element) => element.scrollHeight - element.clientHeight))
        .toBeLessThanOrEqual(1);
      const header = page.getByRole("heading", { name: "Options", exact: true });
      const headerTop = (await header.boundingBox())!.y;
      for (const tab of ["Sound", "Gameplay", "Other", "Display"]) {
        await page.getByRole("button", { name: tab, exact: true }).click();
        await expect.poll(async () => (await header.boundingBox())!.y).toBeCloseTo(headerTop, 0);
        await expect
          .poll(() => scroll.evaluate((element) => element.scrollHeight - element.clientHeight))
          .toBeLessThanOrEqual(1);
      }
      await page.getByRole("button", { name: "Back", exact: true }).click();
    }
  });

  test("Talents header and controls stay fixed when entering and leaving trees", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta({ talentXP: { block: 200 }, unlockedTalents: {} });
    await menu.openTalents();
    for (const viewport of [CONTENT_REFERENCE_VIEWPORT, VIEWPORTS[0]!]) {
      await page.setViewportSize(viewport);
      const heading = page.getByRole("heading", { name: "Talents", exact: true });
      await waitForLayoutSettled(page, heading);
      const headerTop = (await heading.boundingBox())!.y;
      const reset = page.getByRole("button", { name: "Reset talents", exact: true });
      const resetBounds = await reset.boundingBox();
      for (const keyword of ["Block", "Physical"]) {
        await page.getByRole("button", { name: `Select ${keyword} Talents`, exact: true }).click();
        await expect(page.locator(".talent-node").first()).toBeVisible();
        await expect
          .poll(async () => (await page.getByRole("heading", { name: keyword, exact: true }).boundingBox())!.y)
          .toBeCloseTo(headerTop, 0);
        await expect.poll(() => reset.boundingBox()).toEqual(resetBounds);
        await page.getByRole("button", { name: "Back", exact: true }).click();
        await expect(page.getByRole("button", { name: `Select ${keyword} Talents`, exact: true })).toBeVisible();
        await expect.poll(async () => (await heading.boundingBox())!.y).toBeCloseTo(headerTop, 0);
        await expect.poll(() => reset.boundingBox()).toEqual(resetBounds);
      }
    }
  });

  test("independent size controls remain usable and survive reload", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.openOptions();
    await page.getByRole("button", { name: "Display", exact: true }).click();
    await setSlider(page.getByRole("slider", { name: "Game Size", exact: true }), 80);
    await setSlider(page.getByRole("slider", { name: "Tooltip Size", exact: true }), 125);
    await expect(page.getByRole("slider", { name: "Game Size", exact: true })).toHaveValue("80");
    await expect(page.getByRole("slider", { name: "Tooltip Size", exact: true })).toHaveValue("125");
    await assertStageFitsViewport(page);
    await assertNoOverflow(page, "Options after resizing");
    await page.reload();
    await menu.openOptions();
    await page.getByRole("button", { name: "Display", exact: true }).click();
    await expect(page.getByRole("slider", { name: "Game Size", exact: true })).toHaveValue("80");
    await expect(page.getByRole("slider", { name: "Tooltip Size", exact: true })).toHaveValue("125");
    await page.getByRole("button", { name: "Other", exact: true }).click();
    await page.getByRole("button", { name: "Reset to Default", exact: true }).click();
    await page.getByRole("button", { name: "Display", exact: true }).click();
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
      await waitForLayoutSettled(page, cards.first());
      await expect(cards.first()).toBeVisible();
      await controllerInput(page).reach(cards.first());
      const tip = page.locator("#tooltip-root .hover-popup-panel[data-visible]").first();
      await expect(tip).toBeVisible();
      await expectTooltipFitsViewport(tip, viewport);
      await assertNoOverflow(page, `Battle ${viewport.width} at ${gameSizePercent}`);
    }
  });

  test("enemy Traits remain readable and contained at maximum sizing", async ({ page, fastBattle }) => {
    void fastBattle;
    const viewport = { width: 1280, height: 720 };
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem(
        "alchemy-device-display-v1",
        JSON.stringify({ version: 1, gameSizePercent: 120, tooltipSizePercent: 125 }),
      );
    });
    await new MenuPage(page).gotoCollection({ encounteredEnemyIds: ["bandit"] });
    await page.getByRole("button", { name: "Bestiary", exact: true }).click();
    const tooltip = page.locator("#tooltip-root .hover-popup-panel[data-visible]");
    for (const screen of ["Collection", "Battle"]) {
      if (screen === "Battle") {
        await startBattleWithDeck(
          page,
          Array.from({ length: 6 }, () => makeCard()),
        );
        await page.getByTestId("battle-enemy-art-panel").hover();
      } else {
        await page.getByRole("button", { name: "Inspect Bandit", exact: true }).hover();
      }
      const trait = tooltip.locator("[data-trait]").first();
      await expect(trait).toBeVisible();
      await expect(trait.locator("h3")).not.toBeEmpty();
      await expect(trait.locator("p")).not.toBeEmpty();
      await expectTooltipFitsViewport(tooltip, viewport, 0);
      await expect
        .poll(() => trait.locator("p").evaluate((element) => element.scrollWidth - element.clientWidth))
        .toBeLessThanOrEqual(1);
    }
  });

  test("collection keeps page capacity and position across proportional resizes and tab changes", async ({ page }) => {
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
    await expect(cards).toHaveCount(8, { timeout: 15_000 });
    await expect
      .poll(() => cards.locator("img").evaluateAll((images) => images.map((img) => img.getAttribute("src"))))
      .toContain(first);
    for (const tab of ["Trinkets", "Bestiary"]) {
      const previousArt = await cards.first().locator("img").first().getAttribute("src");
      await page.getByRole("button", { name: tab, exact: true }).click();
      await expect.poll(() => cards.first().locator("img").first().getAttribute("src")).not.toBe(previousArt);
      await page.getByRole("button", { name: "Cards", exact: true }).click();
      await expect(cards).toHaveCount(8, { timeout: 15_000 });
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

test("keyboard Options and confirmation fit at 1280×720", async ({ page }) => {
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
  const renderedText = await page.getByText("Music Volume", { exact: true }).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const scale = rect.height / (element as HTMLElement).offsetHeight;
    return parseFloat(getComputedStyle(element).fontSize) * scale;
  });
  const expectedScale = getVirtualResolutionLayout(1280, height).contentScale;
  expect(renderedText).toBeCloseTo(20 * expectedScale, 1);
  await input.activate(page.getByRole("button", { name: "Other", exact: true }));
  await input.activate(page.getByRole("button", { name: "Clear Save Data", exact: true }));
  const dialog = page.getByRole("dialog");
  await expectTooltipFitsViewport(dialog, { width: 1280, height });
  const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
  await expect(cancel).toBeFocused();
  await expect(cancel).toBeInViewport();
  await expect(cancel).toBeVisible();
  await input.press("back");
  await expect(dialog).toHaveCount(0);
});

test("compact Options controls remain reachable at large size in a narrow window", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem(
      "alchemy-device-display-v1",
      JSON.stringify({ version: 1, gameSizePercent: 120, tooltipSizePercent: 100 }),
    );
  });
  const menu = new MenuPage(page);
  await menu.goto();
  await menu.openOptions();
  for (const tab of ["Display", "Sound", "Gameplay", "Other"]) {
    const button = page.getByRole("button", { name: tab, exact: true });
    await expectTooltipFitsViewport(button, { width: 480, height: 720 });
    await button.click();
  }
  await page.getByRole("button", { name: "Clear Save Data", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Display", exact: true }).click();
  const lastSlider = page.getByRole("slider", { name: "Background Particles", exact: true });
  await lastSlider.scrollIntoViewIfNeeded();
  await expect(lastSlider).toBeInViewport();
  await page.getByRole("button", { name: "Sound", exact: true }).click();
  const input = controllerInput(page);
  await input.reach(page.getByRole("switch", { name: "Mute in Background" }));
  await expect(page.getByRole("slider", { name: "Brightness", exact: true })).toHaveCount(0);
});

test(
  "card selection grid removal actions stay visible and stable across pages at maximum game size",
  slow,
  async ({ page }) => {
    await page.addInitScript((gameSizePercent) => {
      localStorage.setItem(
        "alchemy-device-display-v1",
        JSON.stringify({ version: 1, gameSizePercent, tooltipSizePercent: 125 }),
      );
    }, 120);
    await page.setViewportSize({ width: 1366, height: 768 });
    await startAtDestination(
      page,
      { runGold: 9999, runDeck: Array.from({ length: 13 }, () => makeCard()) },
      { forceDestination: "Card Shop" },
    );
    await page.getByRole("button", { name: "Card Shop", exact: true }).click();
    await page.getByRole("button", { name: /Remove Card/ }).click();
    const heading = page.getByRole("heading", { name: "Remove Card", exact: true });
    const remove = page.getByRole("button", { name: /^Remove Gold/ });
    const cancel = page.getByRole("button", { name: "Cancel", exact: true });
    const next = page.getByRole("button", { name: "Next page" });
    await expect(heading).toBeVisible();
    await expect(remove).toBeInViewport({ ratio: 0.999 });
    await expect(cancel).toBeInViewport({ ratio: 0.999 });
    const cards = page.getByRole("button", { name: "Select Slash", exact: true });
    const grid = page.getByTestId("card-selection-grid");
    const fullPageSize = 3;
    await expect(cards).toHaveCount(fullPageSize);
    for (const card of await cards.all()) {
      await expect(card).toBeInViewport({ ratio: 0.999 });
    }
    const before = { heading: await heading.boundingBox(), remove: await remove.boundingBox() };
    while (await next.isEnabled()) {
      await next.click();
    }
    await expect(cards).toHaveCount(1);
    await expect(grid).toHaveCSS("opacity", "1");
    await expect
      .poll(async () => ({ heading: await heading.boundingBox(), remove: await remove.boundingBox() }))
      .toEqual(before);
    await expect(page.getByText("Select a card to remove from your deck")).toHaveCount(0);
    await page.getByRole("button", { name: "Previous page" }).click();
    await expect(cards).toHaveCount(fullPageSize);
    await expect(grid).toHaveCSS("opacity", "1");
    await expect
      .poll(async () => ({ heading: await heading.boundingBox(), remove: await remove.boundingBox() }))
      .toEqual(before);
  },
);

for (const deviceScaleFactor of [1.25, 2]) {
  test.describe(`DPR ${deviceScaleFactor}`, () => {
    test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor });

    test("1280x800 pointer targets and keyboard inspection agree", slow, async ({ page }) => {
      await startBattleWithDeck(
        page,
        Array.from({ length: 6 }, () => makeCard({ cost: 0 })),
        { autoEndTurn: false },
      );
      // The first dealt card appears before opening playback admits input.
      await expect(page.getByRole("button", { name: "End Turn", exact: true })).toBeEnabled();
      const cards = page.locator('[aria-label^="Play "]');
      await waitForLayoutSettled(page, cards.first());
      await expect(cards.first()).toHaveAttribute("aria-disabled", "false");
      await controllerInput(page).reach(cards.first());
      await expectTooltipFitsViewport(page.locator("#tooltip-root .hover-popup-panel[data-visible]").first(), {
        width: 1280,
        height: 800,
      });
      // The artwork moves on hover. Target the stable hand slot, which also owns
      // geometry-based hit testing, rather than a moving card's bounding-box center.
      const slot = page.locator("[data-hand-slot]").first();
      const bounds = await slot.boundingBox();
      if (!bounds) throw new Error("Playable card has no pointer target");
      const count = await cards.count();
      await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await expect(cards).toHaveCount(count - 1);
      const inspect = page.getByTestId("draw-pile").getByRole("button");
      await controllerInput(page).activate(inspect);
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expectUnfocused(page);
      await assertStageFitsViewport(page);
    });
  });
}
