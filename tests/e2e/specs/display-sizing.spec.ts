import { controllerInput } from "../controller-input";
import { expect, test } from "../../fixtures/e2e";
import type { Locator } from "@playwright/test";
import {
  assertNoOverflow,
  assertStageFitsViewport,
  failOnRuntimeErrors,
  makeCard,
  SAVE_KEY,
  startAtDestination,
  startBattleWithDeck,
  waitForLayoutSettled,
} from "../../browser-helpers";
import { openArmory } from "../armory";
import { MenuPage } from "../../pages/menu-page";
import { slow } from "../../playwright-tags";
import { CONTENT_REFERENCE_VIEWPORT, STAGE_HEIGHT } from "../../../src/lib/game-constants/ui-layout";

// The 1920x1080 baseline is the default Chromium viewport for every other
// spec, so this loop covers small and ultrawide extremes without re-running it.
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
      await page.getByRole("combobox", { name: "Aspect Ratio" }).click();
      await expectTooltipFitsViewport(page.getByRole("listbox"), viewport);
      await page.keyboard.press("Escape");
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
        const headingSize = await tooltip
          .locator("p")
          .first()
          .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        const traitSize = await tooltip
          .locator("[data-trait] h3")
          .first()
          .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        expect(traitSize / headingSize).toBeCloseTo(20 / 18, 2);
        await expectTooltipFitsViewport(tooltip, { width: 1280, height: 720 }, 0);
      }
      expect(errors).toEqual([]);
    } finally {
      await page.close();
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
  const expectedScale = Math.min(
    1280 / (STAGE_HEIGHT * (CONTENT_REFERENCE_VIEWPORT.width / CONTENT_REFERENCE_VIEWPORT.height)),
    height / STAGE_HEIGHT,
  );
  expect(renderedText).toBeCloseTo(20 * expectedScale, 1);
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

test("compact Options controls remain reachable without overlapping at large size in a narrow window", async ({
  page,
}) => {
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
  const aspect = page.getByRole("combobox", { name: "Aspect Ratio" });
  const label = page.getByText("Aspect Ratio", { exact: true });
  await expect
    .poll(async () => {
      const controlBox = await aspect.boundingBox();
      const labelBox = await label.boundingBox();
      return Boolean(
        controlBox &&
        labelBox &&
        (controlBox.y >= labelBox.y + labelBox.height - 1 || controlBox.x >= labelBox.x + labelBox.width - 1),
      );
    })
    .toBe(true);
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

test("Start a Run artwork and tooltips share proportional scaling through resizes", slow, async ({ page }) => {
  await page.setViewportSize(CONTENT_REFERENCE_VIEWPORT);
  await page.addInitScript(() => {
    localStorage.setItem(
      "alchemy-device-display-v1",
      JSON.stringify({ version: 1, gameSizePercent: 100, tooltipSizePercent: 100 }),
    );
  });
  const menu = new MenuPage(page);
  await menu.goto();
  await menu.openGameModeSelect();
  const campaign = page.getByRole("button", { name: "The Campaign", exact: true });
  const image = campaign.locator("img").first();
  await campaign.hover();
  const tooltip = page.locator("#tooltip-root .hover-popup-panel[data-visible]").last();
  await expect(tooltip).toBeVisible();
  await expect(campaign).toHaveCSS("scale", "1.035");
  const reference = {
    image: (await image.boundingBox())!,
    tooltipContentWidth: await tooltip.evaluate((el) => {
      const style = getComputedStyle(el);
      return el.getBoundingClientRect().width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
    }),
    font: await tooltip
      .locator("p")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  };
  expect(reference.font).toBeCloseTo(18, 2);

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    const factor = Math.min(
      viewport.width / CONTENT_REFERENCE_VIEWPORT.width,
      viewport.height / CONTENT_REFERENCE_VIEWPORT.height,
    );
    await campaign.hover();
    await expect(campaign).toHaveCSS("scale", "1.035");
    await expect.poll(async () => (await image.boundingBox())!.width / reference.image.width).toBeCloseTo(factor, 2);
    await expect(tooltip).toBeVisible();
    await expect
      .poll(() =>
        tooltip
          .locator("p")
          .first()
          .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      )
      .toBeCloseTo(reference.font * factor, 2);
    await assertStageFitsViewport(page);
    await assertNoOverflow(page, `Start a Run ${viewport.width} × ${viewport.height}`);
  }
});

test("uses CSS viewport dimensions without double-scaling for high DPR", slow, async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.addInitScript(
    ({ saveKey }) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      save.selectedAspectRatio = "auto";
      localStorage.setItem(saveKey, JSON.stringify(save));
    },
    { saveKey: SAVE_KEY },
  );
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

  expect(Number(await page.getByTestId("vr-stage").getAttribute("data-stage-pixel-ratio"))).toBe(1);
  await assertStageFitsViewport(page);
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

test("Armory currency artwork follows Game Size", slow, async ({ page }) => {
  await page.setViewportSize(CONTENT_REFERENCE_VIEWPORT);
  await page.goto("/");
  const widths: number[] = [];
  for (const gameSizePercent of [80, 120]) {
    await page.evaluate(
      (percent) =>
        localStorage.setItem(
          "alchemy-device-display-v1",
          JSON.stringify({ version: 1, gameSizePercent: percent, tooltipSizePercent: 100 }),
        ),
      gameSizePercent,
    );
    await openArmory(page);
    const currency = page.getByTestId("armory-crafting-currency").first();
    await waitForLayoutSettled(page, currency);
    const bounds = (await currency.boundingBox())!;
    expect(bounds.width).toBeCloseTo(bounds.height, 1);
    widths.push(bounds.width);
  }
  expect(widths[1]! / widths[0]!).toBeCloseTo(1.5, 2);
});
