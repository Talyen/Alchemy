import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { ShopPage } from "../../pages/shop-page";
import { RewardPage } from "../../pages/reward-page";
import { DestinationPage } from "../../pages/destination-page";
import {
  enterPrimaryRewardScreen,
  readSavedGame,
  withSavedGame,
  SAVE_KEY,
  startAtDestination,
} from "../../browser-helpers";
import type { ParsedSaveData } from "@/lib/validation";
import { critical, slow } from "../../playwright-tags";

async function enterShop(page: import("@playwright/test").Page, gold: number, destination: "Card Shop" | "Gear Shop") {
  await startAtDestination(page, { runGold: gold }, { forceDestination: destination });
  await page.getByRole("button", { name: destination }).click();
  await expect(page.getByRole("heading", { name: destination })).toBeVisible();
}

test("buying a card charges its quote once and survives resume", critical, async ({ page, fastBattle }) => {
  void fastBattle;
  await enterShop(page, 9999, "Card Shop");
  const shop = new ShopPage(page);
  const buy = shop.buyBtn.first();
  const title = (await buy.getAttribute("aria-label"))!.replace(/^Buy /, "");
  const price = Number((await buy.locator("span.tabular-nums").last().innerText()).replaceAll(",", ""));
  expect(price).toBeGreaterThan(0);
  const gold = await shop.gold();
  const deckSize = (await readSavedGame(page)).activeRun!.runDeck.length;
  await buy.click({ clickCount: 2, delay: 20 });
  await shop.waitForPurchase();
  await expect.poll(() => shop.gold()).toBe(gold - price);
  await expect.poll(async () => (await readSavedGame(page)).activeRun?.runDeck.length).toBe(deckSize + 1);
  await withSavedGame(page, async (resumed) => {
    await expect(resumed.getByRole("heading", { name: "Card Shop", exact: true })).toBeVisible();
    await expect(resumed.getByRole("button", { name: title, exact: true })).toBeDisabled();
    expect(await new ShopPage(resumed).gold()).toBe(gold - price);
    await resumed.getByRole("button", { name: `View Deck · ${deckSize + 1} cards` }).click();
    await expect(resumed.getByRole("dialog").getByRole("img", { name: title, exact: true }).first()).toBeVisible();
    expect((await readSavedGame(resumed)).activeRun?.runDeck).toHaveLength(deckSize + 1);
  });
});

test.describe("Shop fade-out", () => {
  for (const destination of ["Card Shop", "Gear Shop"] as const) {
    test(`keeps ${destination} offerings mounted through route fade-out`, slow, async ({ page }) => {
      const shop = new ShopPage(page);
      await enterShop(page, 9999, destination);
      const offeringCount = await shop.buyBtn.count();
      expect(offeringCount).toBeGreaterThan(0);

      await page.getByRole("button", { name: "Leave", exact: true }).click({ noWaitAfter: true });

      const destinationPage = new DestinationPage(page);
      if (!(await page.getByRole("heading", { name: "Choose Destination" }).isVisible())) {
        await expect(shop.buyBtn).toHaveCount(offeringCount);
      }
      await destinationPage.expectVisible();
    });
  }
});

test.describe("Reward Flow", () => {
  test("Skip ignores a resumed card reward selection", async ({ page, fastBattle }) => {
    void fastBattle;
    await enterPrimaryRewardScreen(page, { rewardType: "card", choiceIds: ["slash", "bash"], selectedId: "bash" });
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await new DestinationPage(page).expectVisible();
    const deck = await page.evaluate(
      (saveKey) => JSON.parse(localStorage.getItem(saveKey) || "{}").activeRun?.runDeck as Array<{ id: string }>,
      SAVE_KEY,
    );
    expect(deck).toHaveLength(6);
    expect(deck.some((card) => card.id === "bash")).toBe(false);
  });

  for (const rewardType of ["boon", "trinket", "gear"] as const) {
    test(`${rewardType} is granted to its proper inventory once and survives resume`, async ({ page, fastBattle }) => {
      void fastBattle;
      await enterPrimaryRewardScreen(page, {
        rewardType,
        choiceIds: ["tattered-pages", "companions-collar"],
        gearChoices: [{ instanceId: "reward-gear", definitionId: "leather-armor-basic", affixes: [] }],
      });
      const hasReward = (save: ParsedSaveData) =>
        rewardType === "gear"
          ? Object.values(save.gearInventories ?? {})
              .flat()
              .filter((gear) => gear.instanceId === "reward-gear").length
          : (rewardType === "boon" ? (save.activeRun?.runBoons ?? []) : (save.ownedTrinketIds ?? [])).filter(
              (id) => id === "tattered-pages",
            ).length;
      expect(hasReward(await readSavedGame(page))).toBe(0);
      await new RewardPage(page).claimFirstReward();
      await new DestinationPage(page).expectVisible();
      await expect.poll(async () => hasReward(await readSavedGame(page))).toBe(1);
      await withSavedGame(page, async (resumed) => {
        await new DestinationPage(resumed).expectVisible();
        const save = await readSavedGame(resumed);
        expect(hasReward(save)).toBe(1);
        if (rewardType === "trinket") expect(save.activeRun?.runBoons).not.toContain("tattered-pages");
      });
    });
  }
});
