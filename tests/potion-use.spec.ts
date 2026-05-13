import { expect, test } from "@playwright/test";
import { injectSaveState, navigateToDestination } from "./helpers";

function potionCard(id: string, title: string, effects: Record<string, unknown>[]) {
  return { id, title, descriptionLines: ["Test potion", "Consume"], art: "placeholder", cost: 1, template: "alchemy", consume: true, effects };
}

test.describe("Potion Use", () => {
  test("playing a health potion restores HP in battle", async ({ page }) => {
    await injectSaveState(page, {
      characterId: "wizard",
      runDeck: [
        potionCard("health-potion", "Health Potion", [{ kind: "heal", amount: 99 }]),
        potionCard("health-potion", "Health Potion", [{ kind: "heal", amount: 99 }]),
        potionCard("mana-potion", "Mana Potion", [{ kind: "restore-mana", amount: 99 }]),
        potionCard("mana-potion", "Mana Potion", [{ kind: "restore-mana", amount: 99 }]),
      ],
      runPlayerHealth: 1,
      runMaxHealth: 30,
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Resume Run" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const healPotion = page.getByRole("button", { name: /Play Health Potion/ });
    if (!(await healPotion.isVisible({ timeout: 1000 }).catch(() => false))) {
      test.skip(true, "No Health Potion in initial hand");
      return;
    }

    const hpText = await page.locator("text=/\\d+\\/30/").first().textContent();
    const hpBefore = Number(hpText?.split("/")[0]);
    expect(hpBefore).toBeLessThan(30);

    await healPotion.click();
    await page.waitForTimeout(300);

    const hpAfterText = await page.locator("text=/\\d+\\/30/").first().textContent();
    const hpAfter = Number(hpAfterText?.split("/")[0]);
    expect(hpAfter).toBeGreaterThan(hpBefore);
  });

  test("playing a mana potion restores mana in battle", async ({ page }) => {
    await injectSaveState(page, {
      characterId: "wizard",
      runDeck: [
        potionCard("health-potion", "Health Potion", [{ kind: "heal", amount: 1 }]),
        potionCard("health-potion", "Health Potion", [{ kind: "heal", amount: 1 }]),
        potionCard("mana-potion", "Mana Potion", [{ kind: "restore-mana", amount: 99 }]),
        potionCard("mana-potion", "Mana Potion", [{ kind: "restore-mana", amount: 99 }]),
      ],
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Resume Run" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const manaPanel = page.getByTestId("mana-panel");
    const manaBefore = Number(await manaPanel.getAttribute("data-mana"));

    const manaPotion = page.getByRole("button", { name: /Play Mana Potion/ });
    if (!(await manaPotion.isVisible({ timeout: 1000 }).catch(() => false))) {
      test.skip(true, "No Mana Potion in initial hand");
      return;
    }

    await manaPotion.click();
    await page.waitForTimeout(300);

    const manaAfter = Number(await manaPanel.getAttribute("data-mana"));
    expect(manaAfter).toBeGreaterThan(manaBefore);
  });
});
