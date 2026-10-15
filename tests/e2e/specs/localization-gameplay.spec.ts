import { expect, test } from "../../fixtures/e2e";
import type { BattleCard } from "../../../src/lib/game-data/types";
import type { Page } from "@playwright/test";
import {
  injectLabyrinthRun,
  readSavedGame,
  withSavedGame,
  startAtDestination,
  makeCard,
  enterPrimaryRewardScreen,
  openArmory,
  failOnRuntimeErrors,
} from "../../browser-helpers";
import { gridLabyrinthMapFixture } from "../../fixtures/labyrinth-map";
import { HomesteadPage } from "../../pages/homestead-page";
import { DEVICE_DISPLAY_RANGES } from "../../../src/lib/settings-values";
import {
  acceptanceLocales,
  type AcceptanceLocale,
  layoutReview,
  mechanics,
  reviewLayout,
  translatedLabel,
} from "../localization";

// Distinct renderer risks: generated/modified card presentation, movable keyword
// slots, localized transaction targets, and separately booted cross-language saves.
test.use({ viewport: layoutReview ? { width: 1280, height: 720 } : { width: 1920, height: 1080 } });

test.beforeEach(async ({ page }) => {
  if (layoutReview)
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

const extraSeedPages: Array<{ page: Page; errors: string[] }> = [];

test.afterEach(async () => {
  for (const { page, errors } of extraSeedPages.splice(0)) {
    await page.close();
    expect(errors).toEqual([]);
  }
});

async function nextSeedPage(previous: Page): Promise<Page> {
  const page = await previous.context().newPage();
  extraSeedPages.push({ page, errors: failOnRuntimeErrors(page) });
  await page.addInitScript(() => localStorage.setItem("alchemy-language-v1", "en"));
  return page;
}
async function localizedCheckpoint(page: Page, locale: AcceptanceLocale, verify: (fresh: Page) => Promise<void>) {
  await page.evaluate((value) => localStorage.setItem("alchemy-language-v1", value), locale);
  // Simulate exit before resume. The fixture page must not later autosave its seed over live progress.
  await page.close();
  await withSavedGame(page, async (fresh) => {
    await expect(fresh.locator("html")).toHaveAttribute("lang", locale === "en-XA" ? "en" : locale);
    await verify(fresh);
  });
}

async function crossLanguageResume(page: Page, locale: AcceptanceLocale, ready: string) {
  const before = await readSavedGame(page);
  const next = acceptanceLocales[(acceptanceLocales.indexOf(locale) + 1) % acceptanceLocales.length]!;
  await localizedCheckpoint(page, next, async (fresh) => {
    await expect(fresh.getByRole("heading", { name: translatedLabel(next, ready), exact: true })).toBeVisible();
    const after = await readSavedGame(fresh);
    expect(mechanics(after)).toEqual(mechanics(before));
    // Description provenance and marks must survive too, not only effect amounts.
    expect(after.activeRun?.runDeck).toEqual(before.activeRun?.runDeck);
  });
}

for (const locale of acceptanceLocales) {
  test.describe(locale, () => {
    test.beforeEach(() => {
      // oxlint-disable-next-line playwright/no-skipped-test -- Pseudotext is deliberately developer-only.
      test.skip(locale === "en-XA" && process.env.PLAYWRIGHT_VITE_MODE !== "dev", "QA locale");
    });

    const label = (english: string) => translatedLabel(locale, english);

    test("mixed and distilled Potions retain their modifications across languages", async ({ page }) => {
      let brewed: BattleCard | undefined;
      const potions = [
        makeCard({
          id: "health-potion",
          title: "Health Potion",
          consume: true,
          descriptionLines: ["Restore 9 Health", "Consume"],
          effects: [{ kind: "heal", amount: 9 }],
        }),
        makeCard({
          id: "mana-potion",
          title: "Mana Potion",
          consume: true,
          descriptionLines: ["Restore 3 Mana", "Consume"],
          effects: [{ kind: "restore-mana", amount: 3 }],
        }),
      ];
      await startAtDestination(page, { runDeck: potions }, { forceDestination: "Campfire" });
      await page.getByRole("button", { name: "Campfire", exact: true }).click();
      await expect.poll(async () => (await readSavedGame(page)).activeRun?.activity.kind).toBe("campfire");
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh.getByRole("button", { name: label("Brew Potion"), exact: true }).click();
        const choices = fresh.getByTestId("card-selection-grid").getByRole("button");
        await choices.nth(0).click();
        await choices.nth(1).click();
        await reviewLayout(fresh, `${locale} mix preview`);
        await fresh.getByRole("button", { name: label("Mix"), exact: true }).click();
        await expect.poll(async () => (await readSavedGame(fresh)).activeRun?.runDeck.length).toBe(1);
        const mixed = (await readSavedGame(fresh)).activeRun!.runDeck[0]!;
        brewed = mixed;
        expect(mixed.effects).toEqual([
          { kind: "heal", amount: 9 },
          { kind: "restore-mana", amount: 3 },
        ]);
        const result = fresh.getByTestId("card-selection-grid");
        await expect(result).toHaveCount(0);
        await reviewLayout(fresh, `${locale} mixed Potion`);
        await crossLanguageResume(fresh, locale, "Campfire");
      });
      expect(brewed).toBeDefined();
      page = await nextSeedPage(page);
      await startAtDestination(page, { runDeck: [brewed], runGold: 999 }, { forceDestination: "Alchemist's Shop" });
      await page.getByRole("button", { name: "Alchemist's Shop", exact: true }).click();
      await expect.poll(async () => (await readSavedGame(page)).activeRun?.activity.kind).toBe("alchemist");
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh
          .getByRole("button")
          .filter({ has: fresh.getByText(label("Distill"), { exact: true }) })
          .click();
        await fresh.getByTestId("card-selection-grid").getByRole("button").first().click();
        await reviewLayout(fresh, `${locale} distillation comparison`);
        await fresh
          .getByRole("button")
          .filter({ hasText: label("Distill") })
          .last()
          .click();
        await expect
          .poll(async () => (await readSavedGame(fresh)).activeRun?.runDeck[0]?.effects)
          .not.toEqual(brewed!.effects);
        const distilled = (await readSavedGame(fresh)).activeRun!.runDeck[0]!;
        expect(distilled.effects).toHaveLength(2);
        expect(
          distilled.effects.every(
            (effect, index) =>
              "amount" in effect &&
              typeof effect.amount === "number" &&
              effect.amount > (brewed!.effects[index] as { amount: number }).amount,
          ),
        ).toBe(true);
        await reviewLayout(fresh, `${locale} distilled Potion`);
        await crossLanguageResume(fresh, locale, "Alchemist's Shop");
      });
    });

    test("transmutation previews and saved generated names remain localized", async ({ page }) => {
      await startAtDestination(page, { runDeck: [makeCard()] }, { forceDestination: "Transmutation" });
      await page.getByRole("button", { name: "Transmutation", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Transmutation", exact: true })).toBeVisible();
      await expect.poll(async () => (await readSavedGame(page)).activeRun?.activity.kind).toBe("transmutation");
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh.getByTestId("card-selection-grid").getByRole("button").first().click();
        const alterations = fresh.getByRole("group", { name: label("Alterations"), exact: true });
        await alterations
          .getByRole("button")
          .and(fresh.locator(':not([aria-disabled="true"]):not([disabled])'))
          .first()
          .click();
        await expect(fresh.getByRole("button", { name: label("Transmute"), exact: true })).toBeEnabled();
        await reviewLayout(fresh, `${locale} transmutation preview`);
        await fresh.getByRole("button", { name: label("Transmute"), exact: true }).click();
        await expect.poll(async () => !!(await readSavedGame(fresh)).activeRun?.runDeck[0]?.transmuted).toBe(true);
        await expect(fresh.getByRole("button", { name: label("Continue"), exact: true })).toBeEnabled();
        await reviewLayout(fresh, `${locale} transmutation result`);
        await crossLanguageResume(fresh, locale, "Transmutation");
      });
    });

    test("corruption keeps its magnitude marks through cross-language resume", async ({ page }) => {
      await startAtDestination(page, { runDeck: [makeCard()] }, { forceDestination: "Corruption" });
      await page.getByRole("button", { name: "Corruption", exact: true }).click();
      await expect.poll(async () => (await readSavedGame(page)).activeRun?.activity.kind).toBe("corruption");
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh.getByRole("button", { name: label("Corrupt a Card"), exact: true }).click();
        await fresh.getByTestId("card-selection-grid").getByRole("button").first().click();
        await fresh.getByRole("button", { name: label("Corrupt"), exact: true }).click();
        await expect.poll(async () => (await readSavedGame(fresh)).activeRun?.runDeck[0]?.corrupted).toBe(true);
        await reviewLayout(fresh, `${locale} corruption result`);
        await crossLanguageResume(fresh, locale, "Altar of Corruption");
      });
    });

    test("Homestead and crafting spend once with localized targets", async ({ page }) => {
      await new HomesteadPage(page).goto({ materialInventory: { stone: 16, iron: 33 }, constructedBuildings: {} });
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh.getByRole("button", { name: label("Homestead"), exact: true }).click();
        const tile = fresh
          .getByRole("button")
          .filter({ has: fresh.getByRole("img", { name: label("Blacksmith"), exact: true }) });
        await tile.click();
        await expect.poll(async () => (await readSavedGame(fresh)).constructedBuildings["blacksmiths-forge"]).toBe(1);
        expect((await readSavedGame(fresh)).materialInventory).toMatchObject({ stone: 12, iron: 22 });
        await tile.hover();
        const expectedBenefit = label(
          "Physical damage is increased by 1\nBurn damage is increased by 10% of your Forge",
        ).split("\n")[0]!;
        await expect(
          fresh.getByRole("tooltip").filter({ has: fresh.getByText(label("Blacksmith"), { exact: true }) }),
        ).toContainText(expectedBenefit);
        await reviewLayout(fresh, `${locale} Homestead purchase`);
      });
      page = await nextSeedPage(page);
      await openArmory(page, { craftingCurrencies: { "sprig-of-growth": 2 } });
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh
          .getByRole("button", { name: locale === "en-XA" ? /ÁÁrmôôry\]$/ : label("Armory"), exact: true })
          .click();
        const currency = fresh.getByRole("button", {
          name: label("{{name}}, {{count}} available")
            .replace("{{name}}", label("Use {{value0}}").replace("{{value0}}", label("Sprig of Growth")))
            .replace("{{count}}", "2"),
          exact: true,
        });
        await currency.click();
        await fresh.getByTestId("armory-inventory-item").first().click();
        await expect(fresh.getByTestId("armory-crafting-result")).toBeVisible();
        await expect.poll(async () => (await readSavedGame(fresh)).craftingCurrencies?.["sprig-of-growth"]).toBe(1);
        const before = await readSavedGame(fresh);
        expect(
          Object.values(before.gearInventories)
            .flat()
            .some((item) => item.affixes.length === 1),
        ).toBe(true);
        await reviewLayout(fresh, `${locale} crafting result`);
        await localizedCheckpoint(fresh, locale === "ru" ? "zh-Hans" : "ru", async (resumed) => {
          await expect(
            resumed.getByRole("button", {
              name: translatedLabel(locale === "ru" ? "zh-Hans" : "ru", "Armory"),
              exact: true,
            }),
          ).toBeVisible();
          const after = await readSavedGame(resumed);
          expect(after.gearInventories).toEqual(before.gearInventories);
          expect(after.craftingCurrencies).toEqual(before.craftingCurrencies);
        });
      });
    });

    test("Labyrinth discovery and reward claims survive a different language", async ({ page }) => {
      const map = gridLabyrinthMapFixture();
      map.nodes["labyrinth-floor-1-n0"]!.type = "rest";
      delete map.nodes["labyrinth-floor-1-n0"]!.enemyId;
      await injectLabyrinthRun(page, { labyrinthMap: map });
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh.locator('[data-labyrinth-node="labyrinth-floor-1-n0"] button').click();
        await reviewLayout(fresh, `${locale} Labyrinth chamber`);
        await fresh.getByRole("button", { name: label("Enter"), exact: true }).click();
        await fresh.getByRole("button", { name: label("Rest"), exact: true }).click();
        await fresh.getByRole("button", { name: label("Continue"), exact: true }).click();
        await expect
          .poll(async () => (await readSavedGame(fresh)).activeRun?.labyrinthMap?.currentNodeId)
          .toBe("labyrinth-floor-1-n0");
        await crossLanguageResume(fresh, locale, "Labyrinth");
      });
      page = await nextSeedPage(page);
      await enterPrimaryRewardScreen(page, { rewardType: "card", choiceIds: ["slash", "bash"] });
      await expect(page.getByRole("button", { name: "Select Bash", exact: true })).toBeVisible();
      await localizedCheckpoint(page, locale, async (fresh) => {
        await reviewLayout(fresh, `${locale} reward choices`);
        const before = (await readSavedGame(fresh)).activeRun!.runDeck.length;
        await fresh
          .getByRole("button", { name: label("Select {{value0}}").replace("{{value0}}", label("Bash")), exact: true })
          .click();
        await expect.poll(async () => (await readSavedGame(fresh)).activeRun?.runDeck.length).toBe(before + 1);
        await crossLanguageResume(fresh, locale, "Choose Destination");
      });
    });
  });
}
