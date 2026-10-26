import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { ShopPage } from "../../pages/shop-page";
import { RewardPage } from "../../pages/reward-page";
import { DestinationPage } from "../../pages/destination-page";
import { enterPrimaryRewardScreen, readSavedGame, withSavedGame, startAtDestination } from "../../browser-helpers";
import type { ParsedSaveData } from "@/lib/validation";
import { critical } from "../../playwright-tags";

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
  const title = (await buy.getByRole("img").first().getAttribute("alt"))!;
  const price = Number((await buy.getAttribute("aria-label"))?.match(/ for ([\d,]+) Gold$/)?.[1]?.replaceAll(",", ""));
  expect(price).toBeGreaterThan(0);
  const gold = await shop.gold();
  await expect.poll(async () => (await readSavedGame(page)).activeRun?.activity.kind).toBe("shop");
  const before = (await readSavedGame(page)).activeRun!;
  if (before.activity.kind !== "shop") throw new Error("Expected a saved Card Shop visit");
  const offeredId = before.activity.data.cards[0]!.id;
  const expectedIds = [...before.runDeck.map((card) => card.id), offeredId].sort();
  const deckSize = before.runDeck.length;
  await buy.click({ clickCount: 2, delay: 20 });
  await shop.waitForPurchase();
  await expect.poll(() => shop.gold()).toBe(gold - price);
  await expect
    .poll(async () => (await readSavedGame(page)).activeRun?.runDeck.map((card) => card.id).sort())
    .toEqual(expectedIds);
  await withSavedGame(page, async (resumed) => {
    await expect(resumed.getByRole("heading", { name: "Card Shop", exact: true })).toBeVisible();
    await expect(resumed.getByRole("button", { name: `${title}. Purchased`, exact: true })).toBeDisabled();
    expect(await new ShopPage(resumed).gold()).toBe(gold - price);
    await resumed.getByRole("button", { name: `View Deck · ${deckSize + 1} cards` }).click();
    await expect(resumed.getByRole("dialog").getByRole("img", { name: title, exact: true }).first()).toBeVisible();
    expect((await readSavedGame(resumed)).activeRun?.runDeck.map((card) => card.id).sort()).toEqual(expectedIds);
  });
});

test.describe("Reward Flow", () => {
  test("Skip ignores a resumed card reward selection", async ({ page, fastBattle }) => {
    void fastBattle;
    await enterPrimaryRewardScreen(page, { rewardType: "card", choiceIds: ["slash", "bash"], selectedId: "bash" });
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await new DestinationPage(page).expectVisible();
    await expect.poll(async () => (await readSavedGame(page)).activeRun?.activity.kind).toBe("destination");
    await withSavedGame(page, async (resumed) => {
      await new DestinationPage(resumed).expectVisible();
      const deck = (await readSavedGame(resumed)).activeRun!.runDeck;
      expect(deck).toHaveLength(6);
      expect(deck.some((card) => card.id === "bash")).toBe(false);
    });
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
