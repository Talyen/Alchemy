import { expect, test } from "@playwright/test";
import { injectSaveState, navigateToDestination } from "./helpers";

test.describe("Steal Card", () => {
  test("steal card increases gold in battle", async ({ page }) => {
    const STEAL = { id: "steal", title: "Steal", descriptionLines: ["Steal 4 Gold"], art: "placeholder", cost: 1, effects: [{ kind: "gain-gold" as const, amount: 4 }] };
    await injectSaveState(page, {
      characterId: "rogue",
      runDeck: [STEAL, STEAL, STEAL, STEAL],
      runGold: 0,
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Resume Run" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const goldBefore = Number((await page.getByTestId("mana-panel").locator("span").first().textContent()) ?? 0);

    await page.locator('[aria-label="Play Steal"]').first().click();
    await page.waitForTimeout(300);

    const goldAfter = Number((await page.getByTestId("mana-panel").locator("span").first().textContent()) ?? 0);
    expect(goldAfter).toBeGreaterThan(goldBefore);
  });
});
