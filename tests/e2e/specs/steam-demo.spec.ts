import { test, expect } from "../../fixtures/e2e";
import {
  assertEndRunShowsRecap,
  failOnRuntimeErrors,
  injectBossState,
  injectHomestead,
  SAVE_KEY,
  startAtDestination,
  winBattleAndClaimReward,
} from "../../browser-helpers";
import { DESTINATIONS } from "@/lib/routing/destinations";
import { BattlePage } from "../../pages/battle-page";
import { DestinationPage } from "../../pages/destination-page";
import { MenuPage } from "../../pages/menu-page";
import { ShopPage } from "../../pages/shop-page";
import { controllerInput } from "../controller-input";

test.describe("Steam demo edition", () => {
  // eslint-disable-next-line playwright/no-skipped-test -- the full renderer cannot exercise demo-only restrictions
  test.skip(process.env.ALCHEMY_EDITION !== "demo", "Requires an explicit demo renderer");

  test("keeps full-game choices locked while earned heroes remain available", async ({ page }) => {
    await injectHomestead(page, { finishedRunCharacters: ["knight", "rogue", "ranger"] });
    const menu = new MenuPage(page);
    const fullGameRequirement = (title: string) =>
      page
        .locator(".hover-popup-panel[data-visible]")
        .filter({ has: page.getByText(title, { exact: true }) })
        .getByText("Requires Full Game", { exact: true });
    await menu.goto();
    await expect(page.getByText("Steam Demo · Campaign Act 1")).toHaveCount(0);
    await menu.openCollection();
    await page.getByRole("button", { name: "Heroes", exact: true }).click();
    await page.getByRole("button", { name: "Inspect Wizard", exact: true }).hover();
    await expect(fullGameRequirement("Wizard")).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await menu.openGameModeSelect();
    await expect(page.getByRole("button", { name: "The Labyrinth (Locked)", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "The Labyrinth (Locked)", exact: true }).hover();
    const requirement = fullGameRequirement("The Labyrinth");
    await expect(requirement).toBeVisible();
    await expect(requirement).toHaveClass(/font-bold/u);
    await expect(requirement).toHaveClass(/text-destructive/u);
    await expect(page.getByText("The Labyrinth (Full game)", { exact: true })).toHaveCount(0);
    const input = controllerInput(page);
    const campaign = page.getByRole("button", { name: "The Campaign", exact: true });
    await input.reach(campaign);
    await page.keyboard.press("F7");
    await expect(page.getByRole("button", { name: "Open game menu", exact: true })).toBeFocused();
    await input.activate(campaign);
    await expect(page.getByRole("button", { name: "Select Ranger" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Wizard (Locked)" })).toHaveAttribute("aria-disabled", "true");
    await page.getByRole("button", { name: "Wizard (Locked)", exact: true }).hover();
    await expect(fullGameRequirement("Wizard")).toBeVisible();
    await input.activate(page.getByRole("button", { name: "Select Knight" }));
    await expect(page.getByRole("button", { name: "End Turn", exact: true })).toBeVisible();
  });

  test("Act 1 boss settles once into a demo recap instead of Act 2", async ({ page, fastBattle }) => {
    void fastBattle;
    await injectBossState(page, 1, { selectedDifficulty: "difficulty-1" });
    await page.goto("/");
    const destination = new DestinationPage(page);
    await destination.expectVisible();
    await destination.enterCombat("Boss");
    await winBattleAndClaimReward(page);
    await expect(page.getByRole("heading", { name: "Victory", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Demo Complete", exact: true })).toHaveCount(0);
    const earnedProgress = () =>
      page.evaluate((key) => {
        const save = JSON.parse(localStorage.getItem(key) ?? "{}");
        return {
          gold: save.gold,
          talentXP: save.talentXP,
          materialInventory: save.materialInventory,
          craftingCurrencies: save.craftingCurrencies,
          finishedRunCharacters: save.finishedRunCharacters,
        };
      }, SAVE_KEY);
    const before = await earnedProgress();
    const input = controllerInput(page);
    await input.reach(page.getByRole("button", { name: "Continue", exact: true }));
    await page.keyboard.down("Enter");
    await expect(page.getByRole("heading", { name: "The Journey Continues", exact: true })).toBeVisible();
    const mainMenu = page.getByRole("button", { name: "Main Menu", exact: true });
    await expect(mainMenu).toBeFocused();
    const image = page.getByTestId("demo-marketing-image");
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(2560);
    await expect(image).toHaveAttribute("alt", /More Bosses.*Build a Homestead/u);
    for (const height of [720, 800]) {
      await page.setViewportSize({ width: 1280, height });
      await expect(mainMenu).toBeInViewport();
      await expect(async () => {
        const fit = await image.evaluate((element: HTMLImageElement) => {
          const art = element.getBoundingClientRect();
          const region = element.parentElement!.getBoundingClientRect();
          return {
            width: art.width,
            height: art.height,
            ratio: element.naturalWidth / element.naturalHeight,
            regionWidth: region.width,
            regionHeight: region.height,
          };
        });
        expect(fit.width / fit.height).toBeCloseTo(fit.ratio, 2);
        expect(fit.width).toBeLessThanOrEqual(fit.regionWidth + 1);
        expect(fit.height).toBeLessThanOrEqual(fit.regionHeight + 1);
        expect(Math.min(fit.regionWidth - fit.width, fit.regionHeight - fit.height)).toBeLessThan(2);
      }).toPass({ timeout: 5000 });
    }
    await page.keyboard.down("Enter");
    await expect(page.getByRole("heading", { name: "The Journey Continues", exact: true })).toBeVisible();
    await page.keyboard.up("Enter");
    expect(await earnedProgress()).toEqual(before);
    await input.press("back");
    await new MenuPage(page).expectMainMenuAfterColdStart();
    expect(await earnedProgress()).toEqual(before);
    await expect
      .poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").activeRun, SAVE_KEY))
      .toBeNull();
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
    expect(saved.completedDifficulties.knight).toEqual([]);
    expect(saved.finishedRunCharacters).toContain("knight");
    const menu = new MenuPage(page);
    await menu.openGameModeSelect();
    await page.getByRole("button", { name: "The Campaign", exact: true }).click();
    await expect(page.getByRole("button", { name: "Select Rogue" })).toBeVisible();
  });

  test("drops an Act 2 save while preserving permanent progression", async ({ page }) => {
    await injectBossState(page, 2, { selectedDifficulty: "difficulty-1" });
    await page.goto("/");
    await new MenuPage(page).expectMainMenuAfterColdStart();
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeHidden();
  });

  test("fresh demo profile plays real starter cards and earns the three-hero chain", async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    const menu = new MenuPage(page);
    await menu.expectMainMenuAfterColdStart(30_000);
    for (const hero of ["Knight", "Rogue", "Ranger"] as const) {
      await menu.openGameModeSelect();
      await page.getByRole("button", { name: "The Campaign", exact: true }).click();
      await page.getByRole("button", { name: `Select ${hero}`, exact: true }).click();
      const battle = new BattlePage(page);
      await battle.waitForOpeningHand();
      await expect
        .poll(async () =>
          page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").activeRun?.runDeck?.length, SAVE_KEY),
        )
        .toBe(7);
      await battle.playFirstCard();
      await assertEndRunShowsRecap(page);
      await expect
        .poll(async () =>
          page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").finishedRunCharacters, SAVE_KEY),
        )
        .toContain(hero.toLowerCase());
      await expect(menu.talentsBtn).toBeEnabled();
      await expect(menu.homesteadBtn).toBeEnabled();
    }
  });

  test("demo special visit can resume and leave without duplicating its outcome", async ({ page }) => {
    await startAtDestination(
      page,
      { gold: 9999, runPlayerHealth: 10 },
      { forceDestination: DESTINATIONS.ALCHEMIST_SHOP },
    );
    await new DestinationPage(page).pick(DESTINATIONS.ALCHEMIST_SHOP);
    const shop = new ShopPage(page);
    const before = await shop.gold();
    await shop.buyCard();
    await shop.waitForPurchase();
    await expect
      .poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").gold, SAVE_KEY))
      .toBeLessThan(before);

    const acknowledged = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
    const restored = await page.context().newPage();
    const errors = failOnRuntimeErrors(restored);
    try {
      await restored.goto("/");
      await expect(restored.getByRole("heading", { name: DESTINATIONS.ALCHEMIST_SHOP, exact: true })).toBeVisible();
      await new ShopPage(restored).waitForPurchase();
      const owned = await restored.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? "{}").ownedTrinketIds,
        SAVE_KEY,
      );
      expect(owned).toEqual(acknowledged.ownedTrinketIds);
      expect(await new ShopPage(restored).gold()).toBe(acknowledged.gold);
      await restored.getByRole("button", { name: "Leave", exact: true }).click();
      await new DestinationPage(restored).expectVisible();
      expect(errors).toEqual([]);
    } finally {
      await restored.close();
    }
  });
});
