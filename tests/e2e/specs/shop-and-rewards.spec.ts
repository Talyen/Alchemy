import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { ShopPage } from "../../pages/shop-page";
import { expectRunPhase } from "../../pages/game-stage";
import { RewardPage } from "../../pages/reward-page";
import { DestinationPage } from "../../pages/destination-page";
import { enterPrimaryRewardScreen, SAVE_KEY, startAtDestination } from "../../browser-helpers";
import { critical, slow } from "../../playwright-tags";

async function enterShop(page: import("@playwright/test").Page, gold: number, destination: "Card Shop" | "Gear Shop") {
  await startAtDestination(page, { runGold: gold }, { forceDestination: destination });
  await page.getByRole("button", { name: destination }).click();
  await expect(page.getByRole("heading", { name: destination })).toBeVisible();
}

test.describe("Card Shop", critical, () => {
  test.describe("with sufficient gold", () => {
    test.beforeEach(async ({ page }) => {
      await enterShop(page, 9999, "Card Shop");
    });

    test("buying a card deducts gold and marks as purchased", async ({ page }) => {
      const shop = new ShopPage(page);
      await expectRunPhase(page, "runLoop");
      const goldBefore = await shop.gold();

      await shop.buyCard();
      await shop.waitForPurchase();

      expect(await shop.gold()).toBeLessThan(goldBefore);
    });
  });
});

test.describe("Shop fade-out", () => {
  for (const destination of ["Card Shop", "Gear Shop"] as const) {
    const gate = destination === "Card Shop" ? critical : slow;

    test(`keeps ${destination} offerings mounted through route fade-out`, gate, async ({ page }) => {
      const shop = new ShopPage(page);
      await enterShop(page, 9999, destination);
      const offeringCount = await shop.buyBtn.count();
      expect(offeringCount).toBeGreaterThan(0);

      await page.getByRole("button", { name: "Leave", exact: true }).click({ noWaitAfter: true });

      await expect.poll(() => shop.buyBtn.count(), { timeout: 10000 }).toBe(offeringCount);
      await new DestinationPage(page).expectVisible();
    });
  }
});

test.describe("Reward Flow", critical, () => {
  test("card reward: clicking a card claims it immediately", critical, async ({ page, fastBattle }) => {
    void fastBattle;
    await enterPrimaryRewardScreen(page, { rewardType: "card", choiceIds: ["slash", "bash"] });

    const reward = new RewardPage(page);
    await reward.claimFirstReward();
    await new DestinationPage(page).expectVisible();
  });

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

  test("boon, trinket, and gear rewards persist correctly", async ({ page, fastBattle }) => {
    void fastBattle;

    await enterPrimaryRewardScreen(page, {
      rewardType: "boon",
      choiceIds: ["tattered-pages", "companions-collar"],
    });
    await new RewardPage(page).claimFirstReward();
    await new DestinationPage(page).expectVisible();
    await expect
      .poll(() =>
        page.evaluate(
          (saveKey) => JSON.parse(localStorage.getItem(saveKey) || "{}").activeRun?.runBoons ?? [],
          SAVE_KEY,
        ),
      )
      .toContain("tattered-pages");

    await enterPrimaryRewardScreen(page, {
      rewardType: "trinket",
      choiceIds: ["tattered-pages", "companions-collar"],
    });
    await new RewardPage(page).claimFirstReward();
    await new DestinationPage(page).expectVisible();
    await expect
      .poll(() =>
        page.evaluate((saveKey) => JSON.parse(localStorage.getItem(saveKey) || "{}").ownedTrinketIds ?? [], SAVE_KEY),
      )
      .toContain("tattered-pages");
    const saved = await page.evaluate((saveKey) => JSON.parse(localStorage.getItem(saveKey) || "{}"), SAVE_KEY);
    expect(saved.ownedTrinketIds).toContain("tattered-pages");
    expect(saved.activeRun?.runBoons ?? []).not.toContain("tattered-pages");

    await enterPrimaryRewardScreen(page, {
      rewardType: "gear",
      gearChoices: [{ instanceId: "reward-gear", definitionId: "leather-armor-basic", affixes: [] }],
    });
    await new RewardPage(page).claimFirstReward();
    await new DestinationPage(page).expectVisible();
    await expect
      .poll(() =>
        page.evaluate((saveKey) => {
          const inventories = JSON.parse(localStorage.getItem(saveKey) || "{}").gearInventories || {};
          return (Object.values(inventories).flat() as Array<{ instanceId: string }>).some(
            (gear) => gear.instanceId === "reward-gear",
          );
        }, SAVE_KEY),
      )
      .toBe(true);
  });

  test("unclaimed rewards survive reload and can be claimed immediately", async ({ page, fastBattle }) => {
    void fastBattle;
    await enterPrimaryRewardScreen(page, {
      rewardType: "trinket",
      choiceIds: ["tattered-pages", "companions-collar"],
    });
    await expect
      .poll(async () =>
        page.evaluate(
          (saveKey) => JSON.parse(localStorage.getItem(saveKey) || "{}").activeRun?.interruptedFlow?.kind,
          SAVE_KEY,
        ),
      )
      .toBe("primary-reward");
    await page.reload();
    await new RewardPage(page).claimFirstReward();
    await new DestinationPage(page).expectVisible();
    await expect
      .poll(() =>
        page.evaluate((saveKey) => JSON.parse(localStorage.getItem(saveKey) || "{}").ownedTrinketIds ?? [], SAVE_KEY),
      )
      .toContain("tattered-pages");
    const saved = await page.evaluate((saveKey) => JSON.parse(localStorage.getItem(saveKey) || "{}"), SAVE_KEY);
    expect(saved.ownedTrinketIds).toContain("tattered-pages");
  });
});
