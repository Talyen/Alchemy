import { expect, test } from "@playwright/test";
import { injectSaveState, navigateToDestination, resumeGameMode } from "./helpers";

function potionCard(id: string, title: string, effects: Record<string, unknown>[]) {
  return { id, title, descriptionLines: ["Test potion", "Consume"], art: "placeholder", cost: 1, consume: true, effects };
}

test.describe("Potion Use", () => {
  test("playing a health potion restores HP in battle", async ({ page }) => {
    await injectSaveState(page, {
      characterId: "wizard",
      runDeck: [
        potionCard("health-potion", "Health Potion", [{ kind: "heal", amount: 99 }]),
        potionCard("health-potion", "Health Potion", [{ kind: "heal", amount: 99 }]),
        potionCard("health-potion", "Health Potion", [{ kind: "heal", amount: 99 }]),
        potionCard("health-potion", "Health Potion", [{ kind: "heal", amount: 99 }]),
      ],
      runPlayerHealth: 1,
      runMaxHealth: 30,
    });
    await page.goto("/");
    await resumeGameMode(page, "campaign");
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const hpText = await page.locator("text=/\\d+\\/30/").first().textContent();
    const hpBefore = Number(hpText?.split("/")[0]);
    expect(hpBefore).toBeLessThan(30);

    await page.locator('[aria-label="Play Health Potion"]').first().click();
    await page.waitForTimeout(300);

    const hpAfterText = await page.locator("text=/\\d+\\/30/").first().textContent();
    const hpAfter = Number(hpAfterText?.split("/")[0]);
    expect(hpAfter).toBeGreaterThan(hpBefore);
  });

  test("playing a mana potion restores mana in battle", async ({ page }) => {
    await injectSaveState(page, {
      characterId: "wizard",
      runDeck: [
        potionCard("mana-potion", "Mana Potion", [{ kind: "restore-mana", amount: 99 }]),
        potionCard("mana-potion", "Mana Potion", [{ kind: "restore-mana", amount: 99 }]),
        potionCard("mana-potion", "Mana Potion", [{ kind: "restore-mana", amount: 99 }]),
        potionCard("mana-potion", "Mana Potion", [{ kind: "restore-mana", amount: 99 }]),
      ],
    });
    await page.goto("/");
    await resumeGameMode(page, "campaign");
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const manaPanel = page.getByTestId("mana-panel");
    const manaBefore = Number(await manaPanel.getAttribute("data-mana"));

    await page.locator('[aria-label="Play Mana Potion"]').first().click();
    await page.waitForTimeout(300);

    const manaAfter = Number(await manaPanel.getAttribute("data-mana"));
    expect(manaAfter).toBeGreaterThan(manaBefore);
  });
});
