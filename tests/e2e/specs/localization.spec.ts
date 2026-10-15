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
import { assertNoOverflow } from "../layout-assertions";
import catalogs from "../../../src/lib/localization/locales/runtime.json";
import { pseudolocalize } from "../../../src/lib/localization/runtime";
import { critical } from "../../playwright-tags";

// Browser-specific coverage: real font loading, translated accessible names,
// live route switching, and a separately booted localized saved battle.
test.use({ viewport: { width: 1920, height: 1080 } });

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
    await expect(page.getByRole("button", { name: label("End Turn", "Zug beenden"), exact: true })).toBeVisible();
    expect(mechanics((await readSavedGame(page)).activeRun)).toEqual(before);
    await withSavedGame(page, async (resumed) => {
      await expect(resumed.getByRole("button", { name: label("End Turn", "Zug beenden"), exact: true })).toBeVisible();
      expect(mechanics((await readSavedGame(resumed)).activeRun)).toEqual(before);
      await resumed.locator('[data-hand-card="true"]').first().hover();
      await expect(resumed.locator('[role="tooltip"]:visible').last()).toContainText(
        locale === "de" ? "Schaden" : "dáámáágëë",
      );
      await assertNoOverflow(resumed, `${locale} battle`);
    });
  });
}

test("expanded English fits Options and keeps the selected control focusable", async ({ page }) => {
  // oxlint-disable-next-line playwright/no-skipped-test -- QA locales are deliberately absent from production builds.
  test.skip(process.env.PLAYWRIGHT_VITE_MODE !== "dev", "Expanded English is a developer-only QA locale");
  await page.addInitScript(() => localStorage.setItem("alchemy-language-v1", "en-XA"));
  await page.goto("/");
  await page.getByRole("button", { name: /pt.*ns/ }).click();
  await expect(page.getByRole("heading", { name: /pt.*ns/ })).toBeVisible();
  await page.locator("#language").focus();
  await expect(page.locator("#language")).toBeFocused();
  await assertNoOverflow(page, "Expanded Options");
  const clipped = await page
    .locator(".options-settings-label:visible")
    .evaluateAll((labels) => labels.some((label) => label.scrollWidth > label.clientWidth + 1));
  expect(clipped).toBe(false);
});

test("Chinese sample uses its bundled glyph font and wraps without clipping", async ({ page }) => {
  // oxlint-disable-next-line playwright/no-skipped-test -- QA locales are deliberately absent from production builds.
  test.skip(
    process.env.PLAYWRIGHT_VITE_MODE !== "dev",
    "Chinese is a developer font sample, not a supported game language",
  );
  await page.addInitScript(() => localStorage.setItem("alchemy-language-v1", "zh-Hans"));
  await page.goto("/");
  await page.getByRole("button", { name: "选项", exact: true }).click();
  const sample = page.locator("[data-chinese-font-sample]");
  await expect(sample).toBeVisible();
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
  await assertNoOverflow(page, "Chinese sample");
});

for (const locale of ["de", "en-XA"] as const) {
  test(`${locale} shop, menus and confirmation dialog retain usable translated controls`, async ({ page }) => {
    // oxlint-disable-next-line playwright/no-skipped-test -- QA locales are deliberately absent from production builds.
    test.skip(locale === "en-XA" && process.env.PLAYWRIGHT_VITE_MODE !== "dev", "Expanded English is a QA locale");
    const label = (english: string) => {
      if (locale === "en-XA") return pseudolocalize(english);
      const id = Object.entries(catalogs.en).find(([, value]) => value === english)?.[0];
      if (!id) throw new Error(`Unregistered acceptance label: ${english}`);
      return (catalogs.de as Record<string, string>)[id]!;
    };
    await startAtDestination(page, { runGold: 9999 }, { forceDestination: "Card Shop" });
    await page.getByRole("button", { name: "Card Shop", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Card Shop", exact: true })).toBeVisible();
    const before = mechanics((await readSavedGame(page)).activeRun);
    await page.evaluate((value) => localStorage.setItem("alchemy-language-v1", value), locale);
    await withSavedGame(page, async (localized) => {
      await expect(localized.getByRole("heading", { name: label("Card Shop"), exact: true })).toBeVisible();
      expect(mechanics((await readSavedGame(localized)).activeRun)).toEqual(before);
      const prefix = label("Buy {{title}} for {{price}} Gold").split("{{title}}")[0]!;
      const buy = localized
        .getByRole("button", { name: new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) })
        .first();
      await expect(buy).toBeEnabled();
      await buy.focus();
      await expect(buy).toBeFocused();
      await buy.hover();
      await expect(localized.locator('[role="tooltip"]:visible').last()).toBeVisible();
      await assertNoOverflow(localized, `${locale} shop`);
      await localized.getByRole("button", { name: label("Open game menu"), exact: true }).click();
      await expect(localized.getByTestId("game-menu")).toBeVisible();
      await assertNoOverflow(localized, `${locale} game menu`);
      await localized
        .getByTestId("game-menu")
        .getByRole("button", { name: label("End Run"), exact: true })
        .click();
      const dialog = localized.getByRole("dialog", { name: label("End this run?"), exact: true });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: label("Cancel"), exact: true }).focus();
      await expect(dialog.getByRole("button", { name: label("Cancel"), exact: true })).toBeFocused();
      await assertNoOverflow(localized, `${locale} confirmation`);
      await dialog.getByRole("button", { name: label("Cancel"), exact: true }).click();
      await expect(dialog).toHaveCount(0);
      expect(mechanics((await readSavedGame(localized)).activeRun)).toEqual(before);
    });
  });
}
