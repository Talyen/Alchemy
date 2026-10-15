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
import { assertNoOverflow } from "../layout-assertions";
import { acceptanceLocales, layoutReview, mechanics, reviewLayout, translatedLabel } from "../localization";
import { critical } from "../../playwright-tags";
import languages from "../../../src/lib/localization/locales/languages.json" with { type: "json" };

// Browser-specific coverage: real font loading, translated accessible names,
// live route switching, and a separately booted localized saved battle.
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

async function openOptions(page: Page, name: string | RegExp, ready: Locator) {
  // Development bootstrap can replace the first menu during an early click.
  await expect(async () => {
    if (!(await ready.isVisible())) await page.getByRole("button", { name, exact: true }).click({ timeout: 2000 });
    await expect(ready).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
}

for (const locale of acceptanceLocales) {
  test(`${locale} switching preserves a live battle and its fresh-page resume`, critical, async ({ page }) => {
    // oxlint-disable-next-line playwright/no-skipped-test -- QA locales are deliberately absent from production builds.
    test.skip(locale === "en-XA" && process.env.PLAYWRIGHT_VITE_MODE !== "dev", "Expanded English is a QA locale");
    // This journey includes a cold module load and an independently booted resume.
    test.setTimeout(60_000);
    const label = (english: string) => translatedLabel(locale, english);
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
      .getByRole("option", {
        name: locale === "en-XA" ? "Expanded English (test)" : languages[locale].name,
        exact: true,
      })
      .click();
    await expect(page.locator("html")).toHaveAttribute("lang", locale === "en-XA" ? "en" : locale);
    await expect(page.getByRole("heading", { name: label("Options"), exact: true })).toBeVisible();
    await page.getByRole("button", { name: label("Back"), exact: true }).click();
    await page.getByRole("button", { name: label("Continue"), exact: true }).click();
    await expect(page.getByRole("button", { name: label("End Turn"), exact: true })).toBeVisible();
    expect(mechanics((await readSavedGame(page)).activeRun)).toEqual(before);
    await withSavedGame(page, async (resumed) => {
      await expect(resumed.getByRole("button", { name: label("End Turn"), exact: true })).toBeVisible();
      expect(mechanics((await readSavedGame(resumed)).activeRun)).toEqual(before);
      await resumed.locator('[data-hand-card="true"]').first().hover();
      const descriptionPattern = label("Deal 4 Physical damage")
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace("4", "\\d+");
      await expect(resumed.locator('[role="tooltip"]:visible').last()).toContainText(new RegExp(descriptionPattern));
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

for (const locale of acceptanceLocales) {
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

for (const [locale, family, phrase] of [
  ["zh-Hans", "Alchemy Chinese", "造成伤害，获得格挡。简体中文"],
  ["ru", "Alchemy Cyrillic", "Здоровье, броня, оглушение"],
] as const) {
  test(`${locale} uses a bundled font for its script`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("alchemy-language-v1", value), locale);
    await page.goto("/");
    await openOptions(
      page,
      translatedLabel(locale, "Options"),
      page.getByRole("heading", { name: translatedLabel(locale, "Options"), exact: true }),
    );
    const loaded = await page.evaluate(
      async ({ family, phrase }) => {
        const faces = await document.fonts.load(`16px "${family}"`, phrase);
        return faces.length > 0 && faces.every((face) => face.status === "loaded");
      },
      { family, phrase },
    );
    expect(loaded).toBe(true);
    await assertNoOverflow(page, `${locale} font coverage`);
  });
}

for (const locale of acceptanceLocales) {
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
