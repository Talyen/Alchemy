import fs from "node:fs";
import path from "node:path";
import type { Page, Locator } from "@playwright/test";
import { expect, test } from "../../fixtures/e2e";
import {
  injectActiveBattle,
  makeCard,
  makeGoblinBattleState,
  readSavedGame,
  withSavedGame,
  startAtDestination,
} from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { DEVICE_DISPLAY_RANGES } from "../../../src/lib/settings-values";
import { assertNoOverflow, assertReachableControlsInViewport, waitForLayoutSettled } from "../layout-assertions";
import catalogs from "../../../src/lib/localization/locales/runtime.json" with { type: "json" };
import { pseudolocalize } from "../../../src/lib/localization/pseudolocalize";
import { critical } from "../../playwright-tags";

// Browser-specific coverage: real font loading, translated accessible names,
// live route switching, and a separately booted localized saved battle.
const layoutReview = process.env.ALCHEMY_LOCALIZATION_LAYOUT_REVIEW === "1";
test.use({ viewport: layoutReview ? { width: 1280, height: 720 } : { width: 1920, height: 1080 } });

test.beforeEach(async ({ page }) => {
  if (!layoutReview) return;
  await page.addInitScript((ranges) => {
    localStorage.setItem(
      "alchemy-device-display-v1",
      JSON.stringify({
        version: 1,
        gameSizePercent: ranges.gameSizePercent.max,
        tooltipSizePercent: ranges.tooltipSizePercent.max,
      }),
    );
  }, DEVICE_DISPLAY_RANGES);
});

function translatedLabel(locale: "de" | "en-XA", english: string): string {
  if (locale === "en-XA") return pseudolocalize(english);
  const id = Object.entries(catalogs.en).find(([, value]) => value === english)?.[0];
  if (!id) throw new Error(`Unregistered acceptance label: ${english}`);
  return (catalogs.de as Record<string, string>)[id]!;
}

async function reviewLayout(page: Page, name: string) {
  await assertNoOverflow(page, name);
  if (!layoutReview) return;
  await waitForLayoutSettled(page);
  const directory = path.resolve("reports/localization-layout");
  fs.mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, name.replace(/[^a-z0-9]+/gi, "-") + ".png") });
  await assertReachableControlsInViewport(page, name);
}

async function openOptions(page: Page, name: string | RegExp, ready: Locator) {
  // Development bootstrap can replace the first menu during an early click.
  await expect(async () => {
    if (!(await ready.isVisible())) await page.getByRole("button", { name, exact: true }).click({ timeout: 2000 });
    await expect(ready).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
}

function mechanics(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mechanics);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          ![
            "title",
            "baseTitle",
            "description",
            "descriptionLines",
            "message",
            "art",
            "corruptedValuePositions",
          ].includes(key),
      )
      .map(([key, item]) => [key, mechanics(item)]),
  );
}

for (const locale of ["de", "en-XA"] as const) {
  test(`${locale} switching preserves a live battle and its fresh-page resume`, critical, async ({ page }) => {
    // oxlint-disable-next-line playwright/no-skipped-test -- QA locales are deliberately absent from production builds.
    test.skip(locale === "en-XA" && process.env.PLAYWRIGHT_VITE_MODE !== "dev", "Expanded English is a QA locale");
    // This journey includes a cold module load and an independently booted resume.
    test.setTimeout(60_000);
    const label = (english: string, german: string) => (locale === "de" ? german : pseudolocalize(english));
    const deck = Array.from({ length: 6 }, () =>
      makeCard({
        id: "slash",
        title: "Slash",
        cost: 0,
        descriptionLines: ["Deal 4 Physical damage"],
        effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
      }),
    );
    await injectActiveBattle(page, makeGoblinBattleState({ hand: deck.slice(0, 4), deck: deck.slice(4) }), {
      runDeck: deck,
    });
    const battle = new BattlePage(page);
    await expect(battle.endTurnBtn).toBeVisible();
    const before = mechanics((await readSavedGame(page)).activeRun);
    await battle.menuBtn.click();
    await page.getByRole("button", { name: "Options", exact: true }).click();
    await page.locator("#language").click();
    await page
      .getByRole("option", { name: locale === "de" ? "Deutsch" : "Expanded English (test)", exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute("lang", locale === "de" ? "de" : "en");
    await expect(page.getByRole("heading", { name: label("Options", "Optionen"), exact: true })).toBeVisible();
    await page.getByRole("button", { name: label("Back", "Zurück"), exact: true }).click();
    await page.getByRole("button", { name: label("Continue", "Weiter"), exact: true }).click();
    await expect(page.getByRole("button", { name: label("End Turn", "Zug beenden"), exact: true })).toBeVisible();
    expect(mechanics((await readSavedGame(page)).activeRun)).toEqual(before);
    await withSavedGame(page, async (resumed) => {
      await expect(resumed.getByRole("button", { name: label("End Turn", "Zug beenden"), exact: true })).toBeVisible();
      expect(mechanics((await readSavedGame(resumed)).activeRun)).toEqual(before);
      await resumed.locator('[data-hand-card="true"]').first().hover();
      await expect(resumed.locator('[role="tooltip"]:visible').last()).toContainText(
        locale === "de" ? "Schaden" : "dáámáágëë",
      );
      await reviewLayout(resumed, `${locale} battle`);
      if (layoutReview) {
        const lastCard = resumed.locator("[data-hand-slot] button").last();
        await lastCard.focus();
        await expect(lastCard).toBeFocused();
        await reviewLayout(resumed, `${locale} focused hand card`);
      }
    });
  });
}

for (const locale of ["de", "en-XA"] as const) {
  test(`${locale} Options tabs fit and keep translated controls usable`, async ({ page }) => {
    // oxlint-disable-next-line playwright/no-skipped-test -- QA locales are deliberately absent from production builds.
    test.skip(locale === "en-XA" && process.env.PLAYWRIGHT_VITE_MODE !== "dev", "Expanded English is a QA locale");
    const label = (english: string) => translatedLabel(locale, english);
    await page.addInitScript((value) => localStorage.setItem("alchemy-language-v1", value), locale);
    await page.goto("/");
    await openOptions(
      page,
      locale === "en-XA" ? /ÔÔptïïôôns\]$/ : label("Options"),
      page.getByRole("heading", { name: label("Options"), exact: true }),
    );
    await page.locator("#language").focus();
    await expect(page.locator("#language")).toBeFocused();
    for (const tab of ["Display", "Sound", "Gameplay", "Other"]) {
      await page.getByRole("button", { name: label(tab), exact: true }).click();
      await expect(page.getByRole("button", { name: label(tab), exact: true })).toHaveAttribute("aria-pressed", "true");
      await reviewLayout(page, `${locale} Options ${tab}`);
      if (layoutReview && tab === "Display") {
        await expect(page.getByRole("slider", { name: label("Game Size"), exact: true })).toHaveValue(
          String(DEVICE_DISPLAY_RANGES.gameSizePercent.max),
        );
        await expect(page.getByRole("slider", { name: label("Tooltip Size"), exact: true })).toHaveValue(
          String(DEVICE_DISPLAY_RANGES.tooltipSizePercent.max),
        );
        await page.locator("#language").click();
        await expect(page.getByRole("listbox")).toBeVisible();
        await reviewLayout(page, `${locale} language choices`);
        await page.keyboard.press("Escape");
        await expect(page.locator("#language")).toBeFocused();
      }
      const clipped = await page
        .locator(".options-settings-label:visible")
        .evaluateAll((labels) => labels.some((label) => label.scrollWidth > label.clientWidth + 1));
      expect(clipped).toBe(false);
    }
  });
}

test("Chinese sample uses its bundled glyph font and wraps without clipping", async ({ page }) => {
  // oxlint-disable-next-line playwright/no-skipped-test -- QA locales are deliberately absent from production builds.
  test.skip(
    process.env.PLAYWRIGHT_VITE_MODE !== "dev",
    "Chinese is a developer font sample, not a supported game language",
  );
  await page.addInitScript(() => localStorage.setItem("alchemy-language-v1", "zh-Hans"));
  await page.goto("/");
  const sample = page.locator("[data-chinese-font-sample]");
  await openOptions(page, "选项", sample);
  const loaded = await sample.evaluate(async (element) => {
    const faces = await document.fonts.load('16px "Alchemy Chinese Sample"', element.textContent ?? "");
    return {
      loaded: faces.length > 0 && faces.every((face) => face.status === "loaded"),
      family: getComputedStyle(element).fontFamily,
      clipped: element.scrollWidth > element.clientWidth + 1,
    };
  });
  expect(loaded.loaded).toBe(true);
  expect(loaded.family).toContain("Alchemy Chinese Sample");
  expect(loaded.clipped).toBe(false);
  const wrappedValues = await page
    .locator(".options-settings-control > p")
    .evaluateAll((values) =>
      values.some(
        (value) =>
          value.getBoundingClientRect().height > Number.parseFloat(getComputedStyle(value).lineHeight) + 1 ||
          value.scrollWidth > value.clientWidth + 1,
      ),
    );
  expect(wrappedValues).toBe(false);
  await assertNoOverflow(page, "Chinese sample");
});

for (const locale of ["de", "en-XA"] as const) {
  test(`${locale} shop, menus and confirmation dialog retain usable translated controls`, async ({ page }) => {
    // oxlint-disable-next-line playwright/no-skipped-test -- QA locales are deliberately absent from production builds.
    test.skip(locale === "en-XA" && process.env.PLAYWRIGHT_VITE_MODE !== "dev", "Expanded English is a QA locale");
    const label = (english: string) => translatedLabel(locale, english);
    await startAtDestination(page, { runGold: 9999 }, { forceDestination: "Card Shop" });
    await page.getByRole("button", { name: "Card Shop", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Card Shop", exact: true })).toBeVisible();
    await expect.poll(async () => (await readSavedGame(page)).activeRun?.activity.kind).toBe("shop");
    const before = mechanics((await readSavedGame(page)).activeRun);
    await page.evaluate((value) => localStorage.setItem("alchemy-language-v1", value), locale);
    await withSavedGame(page, async (localized) => {
      await expect(localized.getByRole("heading", { name: label("Card Shop"), exact: true })).toBeVisible();
      expect(mechanics((await readSavedGame(localized)).activeRun)).toEqual(before);
      const purchasePattern = label("Buy {{title}} for {{price}} Gold")
        .split(/({{(?:title|price)}})/)
        .map((part) =>
          part === "{{title}}" ? ".+" : part === "{{price}}" ? "\\d+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        )
        .join("");
      const buy = localized.getByRole("button", { name: new RegExp(`^${purchasePattern}$`) }).first();
      await expect(buy).toBeEnabled();
      await buy.focus();
      await expect(buy).toBeFocused();
      await buy.hover();
      await expect(localized.locator('[role="tooltip"]:visible').last()).toBeVisible();
      await reviewLayout(localized, `${locale} shop`);
      await localized.getByRole("button", { name: label("Open game menu"), exact: true }).click();
      await expect(localized.getByTestId("game-menu")).toBeVisible();
      await reviewLayout(localized, `${locale} game menu`);
      await localized
        .getByTestId("game-menu")
        .getByRole("button", { name: label("End Run"), exact: true })
        .click();
      const dialog = localized.getByRole("dialog", { name: label("End this run?"), exact: true });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: label("Cancel"), exact: true }).focus();
      await expect(dialog.getByRole("button", { name: label("Cancel"), exact: true })).toBeFocused();
      await reviewLayout(localized, `${locale} confirmation`);
      await dialog.getByRole("button", { name: label("Cancel"), exact: true }).click();
      await expect(dialog).toHaveCount(0);
      expect(mechanics((await readSavedGame(localized)).activeRun)).toEqual(before);
    });
  });
}
