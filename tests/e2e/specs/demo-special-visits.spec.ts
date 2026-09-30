import { test, expect } from "../../fixtures/e2e";
import { startAtDestination, SAVE_KEY, failOnRuntimeErrors } from "../../browser-helpers";
import { DESTINATIONS } from "@/lib/routing/destinations";
import { ShopPage } from "../../pages/shop-page";
import { DestinationPage } from "../../pages/destination-page";

for (const destination of [DESTINATIONS.ALCHEMIST_SHOP, DESTINATIONS.TRINKET_SHOP, DESTINATIONS.CAMPFIRE]) {
  test(`demo ${destination} can resume and leave without duplicating its outcome`, async ({ page }) => {
    // eslint-disable-next-line playwright/no-skipped-test -- this journey validates the approved demo's special visits
    test.skip(process.env.ALCHEMY_EDITION !== "demo", "Demo edition required");
    await startAtDestination(page, { gold: 9999, runPlayerHealth: 10 }, { forceDestination: destination });
    await new DestinationPage(page).pick(destination);
    if (destination !== DESTINATIONS.CAMPFIRE) {
      const shop = new ShopPage(page);
      const before = await shop.gold();
      await shop.buyCard();
      if (destination !== DESTINATIONS.TRINKET_SHOP) await shop.waitForPurchase();
      await expect
        .poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").gold, SAVE_KEY))
        .toBeLessThan(before);
    } else {
      await expect(page.getByRole("button", { name: "Rest", exact: true })).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").activeRun?.currentScreen, SAVE_KEY),
        )
        .toBe("campfire");
    }
    const acknowledged = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
    const restored = await page.context().newPage();
    const errors = failOnRuntimeErrors(restored);
    try {
      await restored.goto("/");
      await expect(
        restored.getByRole("heading", {
          name: destination === DESTINATIONS.CAMPFIRE ? "Campfire" : destination,
          exact: true,
        }),
      ).toBeVisible();
      if (destination !== DESTINATIONS.CAMPFIRE) {
        if (destination !== DESTINATIONS.TRINKET_SHOP) await new ShopPage(restored).waitForPurchase();
        const owned = await restored.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? "{}").ownedTrinketIds,
          SAVE_KEY,
        );
        expect(owned).toEqual(acknowledged.ownedTrinketIds);
        expect(await new ShopPage(restored).gold()).toBe(acknowledged.gold);
      }
      if (destination === DESTINATIONS.CAMPFIRE) {
        await restored.getByRole("button", { name: "Rest", exact: true }).click();
      } else {
        await restored.getByRole("button", { name: "Leave", exact: true }).click();
      }
      await new DestinationPage(restored).expectVisible();
      expect(errors).toEqual([]);
    } finally {
      await restored.close();
    }
  });
}
