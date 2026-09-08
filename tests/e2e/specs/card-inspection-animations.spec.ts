import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors, makeCard, seedRandom, startBattleWithDeck } from "../../helpers";
import { BattlePage } from "../../pages/battle-page";
import { slow } from "../../playwright-tags";

test("waits for real card animations and preserves pile transfer anchors", slow, async ({ page }) => {
  test.setTimeout(60_000);
  const errors = failOnRuntimeErrors(page);
  await seedRandom(page, 42);
  await page.addInitScript(() => {
    const state = window as Window & { inspectionBlockedDuringDeal?: boolean };
    new MutationObserver(() => {
      const icon = document.querySelector('[aria-label^="View Deck"]');
      if (document.querySelector("[data-flying-card]") && icon?.getAttribute("aria-disabled") === "true") {
        state.inspectionBlockedDuringDeal = true;
      }
    }).observe(document, { childList: true, subtree: true, attributes: true });
  });
  await startBattleWithDeck(
    page,
    Array.from({ length: 8 }, () => makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] })),
  );
  const icon = page.getByRole("button", { name: /^View Deck/ });
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { inspectionBlockedDuringDeal?: boolean }).inspectionBlockedDuringDeal),
    )
    .toBe(true);
  await expect(icon).toHaveAttribute("aria-disabled", "false", { timeout: 20_000 });
  const drawPile = page.getByTestId("draw-pile");
  const before = await drawPile.boundingBox();
  const buttonBounds = await drawPile.getByRole("button").boundingBox();
  expect(buttonBounds).toEqual(before);
  await drawPile.getByRole("button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await drawPile.boundingBox()).toEqual(before);
  const battle = new BattlePage(page);
  await battle.playFirstCard();
  await expect(icon).toHaveAttribute("aria-disabled", "true");
  await expect(icon).toHaveAttribute("aria-disabled", "false", { timeout: 20_000 });
  await battle.endTurn();
  await expect(icon).toHaveAttribute("aria-disabled", "false", { timeout: 20_000 });
  await icon.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(errors).toEqual([]);
});
