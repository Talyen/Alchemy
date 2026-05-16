import { expect, test } from "@playwright/test";
import { injectSaveState, navigateToDestination } from "./helpers";

test.describe("Free Card Mechanics", () => {
  test("playing a 0-cost card does not consume mana", async ({ page }) => {
    const FREE_CARD = {
      id: "boss-killer", title: "Boss Killer", descriptionLines: ["Deal massive damage"],
      art: "placeholder", cost: 0,
      effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 1 }],
    };
    await injectSaveState(page, {
      runDeck: [FREE_CARD, FREE_CARD, FREE_CARD, FREE_CARD],
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Resume Run" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const manaBefore = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));

    await page.locator('[aria-label="Play Boss Killer"]').first().click();
    await page.waitForTimeout(300);

    const manaAfter = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));
    expect(manaAfter).toBe(manaBefore);
  });

  test("mortar-and-pestle trinket makes first potion free", async ({ page }) => {
    const POTION = {
      id: "health-potion", title: "Health Potion",
      descriptionLines: ["Restore 8 Health", "Consume"],
      art: "placeholder", cost: 1, consume: true,
      effects: [{ kind: "heal" as const, amount: 8 }],
    };

    await injectSaveState(page, {
      runDeck: [POTION, POTION, POTION, POTION],
      runTrinkets: ["mortar-and-pestle"],
      runPlayerHealth: 15,
      runMaxHealth: 30,
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Resume Run" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const manaBefore = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));

    await page.locator('[aria-label="Play Health Potion"]').first().click();
    await page.waitForTimeout(300);

    const manaAfterFirst = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));
    expect(manaAfterFirst).toBe(manaBefore);

    await page.locator('[aria-label="Play Health Potion"]').first().click();
    await page.waitForTimeout(300);

    const manaAfterSecond = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));
    expect(manaAfterSecond).toBe(manaAfterFirst - 1);
  });
});
