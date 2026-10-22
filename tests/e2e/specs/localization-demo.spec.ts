import { savedActivityData } from "../../fixtures/run-activity";
import { expect, test } from "../../fixtures/e2e";
import { injectBossState, readSavedGame, failOnRuntimeErrors } from "../../browser-helpers";
import { DEVICE_DISPLAY_RANGES } from "../../../src/lib/settings-values";
import { controllerInput } from "../controller-input";
import {
  acceptanceLocales,
  layoutReview,
  localizedCheckpoint,
  mechanics,
  reviewLayout,
  translatedLabel,
} from "../localization";

// Production-only boundary: a fresh localized demo, real starter-card play,
// separately booted checkpoint, and the actual Act 1 settlement/marketing route.
test.use({ viewport: layoutReview ? { width: 1280, height: 720 } : { width: 1920, height: 1080 } });

test.beforeEach(() => {
  // oxlint-disable-next-line playwright/no-skipped-test -- This suite qualifies the explicitly built demo edition.
  test.skip(process.env.ALCHEMY_EDITION !== "demo", "Requires demo renderer");
});

for (const locale of acceptanceLocales.filter((entry) => entry !== "en-XA")) {
  test(`${locale} production demo resumes starter play and completes its localized ending`, async ({
    page,
    fastBattle,
  }) => {
    void fastBattle;
    test.setTimeout(90_000);
    const label = (english: string) => translatedLabel(locale, english);
    await page.addInitScript(
      ({ locale, ranges, review }) => {
        localStorage.setItem("alchemy-skip-loading-screen", "true");
        localStorage.setItem("alchemy-language-v1", locale);
        if (review)
          localStorage.setItem(
            "alchemy-device-display-v1",
            JSON.stringify({
              version: 1,
              gameSizePercent: ranges.gameSizePercent.max,
              tooltipSizePercent: ranges.tooltipSizePercent.max,
            }),
          );
      },
      { locale, ranges: DEVICE_DISPLAY_RANGES, review: layoutReview },
    );
    await page.goto("/");
    await page.getByRole("button", { name: label("Play"), exact: true }).click();
    await page.getByRole("button", { name: label("The Campaign"), exact: true }).click();
    await page
      .getByRole("button", {
        name: label("Select {{value0}}").replace("{{value0}}", label("Knight")),
        exact: true,
      })
      .click();
    const hand = page.locator('[data-hand-card="true"] button');
    await expect(hand.first()).toBeVisible();
    await expect.poll(async () => (await readSavedGame(page)).activeRun?.runDeck.length).toBe(7);
    const count = await hand.count();
    await hand.first().click();
    await expect(hand).toHaveCount(count - 1);
    await expect
      .poll(async () => savedActivityData((await readSavedGame(page)).activeRun, "battle")?.battleState?.hand?.length)
      .toBe(count - 1);
    const checkpoint = (await readSavedGame(page)).activeRun;
    await localizedCheckpoint(page, locale, async (resumed) => {
      await expect(resumed.getByRole("button", { name: label("End Turn"), exact: true })).toBeVisible();
      expect(mechanics((await readSavedGame(resumed)).activeRun)).toEqual(mechanics(checkpoint));
      await reviewLayout(resumed, `${locale} demo starter resume`);
    });

    // Deterministic final-room checkpoint avoids repeatedly testing seven rooms
    // of combat arithmetic; rewards and the ending are reached through real UI.
    const boss = await page.context().newPage();
    const errors = failOnRuntimeErrors(boss);
    try {
      await injectBossState(boss, 1, { selectedDifficulty: "difficulty-1", finishedRunCharacters: [] });
      await boss.goto("/");
      await localizedCheckpoint(boss, locale, async (resumed) => {
        await resumed
          .getByRole("button", { name: label("Boss - Act {{act}}").replace("{{act}}", "I"), exact: true })
          .click();
        const rewards = resumed.locator(".reward-choice button");
        const hand = resumed.locator('[data-hand-card="true"] button');
        // The real Forge Golem starts with four Block charges; one large hit
        // cannot skip those charges. Play through its actual combat rules.
        for (let turn = 0; turn < 3 && !(await rewards.first().isVisible()); turn += 1) {
          while ((await hand.count()) > 0) {
            const count = await hand.count();
            await hand.first().click();
            await expect.poll(() => hand.count()).toBeLessThan(count);
          }
          await expect(resumed.locator("[data-battle-end-turn]:not([disabled])").or(rewards.first())).toBeVisible();
          if (await rewards.first().isVisible()) break;
          await resumed.getByRole("button", { name: label("End Turn"), exact: true }).click();
          await expect(resumed.locator("[data-battle-end-turn]:not([disabled])").or(rewards.first())).toBeVisible();
        }
        await rewards.first().click();
        await expect(resumed.getByRole("heading", { name: label("Victory"), exact: true })).toBeVisible();
        await expect.poll(async () => (await readSavedGame(resumed)).activeRun).toBeNull();
        const settled = await readSavedGame(resumed);
        expect(settled.completedDifficulties.knight).toEqual([]);
        expect(settled.finishedRunCharacters).toContain("knight");
        await reviewLayout(resumed, `${locale} demo victory`);
        await resumed.getByRole("button", { name: label("Continue"), exact: true }).click();
        await expect(resumed.getByRole("heading", { name: label("Hero Unlocked"), exact: true })).toBeVisible();
        await expect(resumed.getByRole("heading", { name: label("Rogue"), exact: true })).toBeVisible();
        await reviewLayout(resumed, `${locale} demo hero unlock`);
        await resumed.getByRole("button", { name: label("Continue"), exact: true }).click();
        await expect(resumed.getByRole("heading", { name: label("The Journey Continues"), exact: true })).toBeVisible();
        await expect(resumed.getByTestId("demo-marketing-image")).toHaveAttribute(
          "alt",
          label(
            "More Bosses; Wildwood Draft; The Labyrinth; More Heroes; 200+ Talents; Trinkets & Uniques; Build a Homestead",
          ),
        );
        const artwork = resumed.getByTestId("demo-marketing-image");
        await expect(artwork).toHaveAttribute("src", new RegExp(`demo-feature-showcase-${locale.toLowerCase()}[.-]`));
        await expect
          .poll(() => artwork.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 1000))
          .toBe(true);
        const ratio = await artwork.evaluate((image: HTMLImageElement) => image.naturalWidth / image.naturalHeight);
        expect(ratio).toBeCloseTo(2752 / 1536, 2);
        await reviewLayout(resumed, `${locale} demo ending`);
        const mainMenu = resumed.getByRole("button", { name: label("Main Menu"), exact: true });
        await controllerInput(resumed).activate(mainMenu);
        await expect(resumed.getByRole("button", { name: label("Play"), exact: true })).toBeVisible();
        const after = await readSavedGame(resumed);
        expect(after.gold).toBe(settled.gold);
        expect(after.talentXP).toEqual(settled.talentXP);
        expect(after.materialInventory).toEqual(settled.materialInventory);
        await localizedCheckpoint(resumed, locale, async (reopened) => {
          await expect(reopened.getByRole("button", { name: label("Play"), exact: true })).toBeVisible();
          expect((await readSavedGame(reopened)).activeRun).toBeNull();
        });
      });
      expect(errors).toEqual([]);
    } finally {
      await boss.close();
    }
  });
}
