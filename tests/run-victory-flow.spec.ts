import { expect, test } from "@playwright/test";
import { enableFastMode, injectSaveState, makeHighDamageCard, playUntilVictory, resumeGameMode, seedRandomScript } from "./helpers";

function injectBossState(page: Parameters<typeof test>[0]["page"], act = 1) {
  const highDamageCard = makeHighDamageCard();
  return injectSaveState(page, {
    characterId: "knight",
    runDeck: Array.from({ length: 6 }, () => ({ ...highDamageCard })),
    roomsEncountered: 7,
    destinationIndexInAct: 7,
    currentAct: act,
    completedDestinations: Array.from({ length: 7 }, () => "Normal Combat"),
    runPlayerHealth: 30,
    runMaxHealth: 30,
  });
}

test.describe("Boss Fight Flow", () => {
  test("beating Act I boss completes victory flow and displays Act II destination choices", async ({ page }) => {
    await enableFastMode(page);
    await injectBossState(page);
    await page.addInitScript(seedRandomScript(42));
    await page.goto("/");
    await resumeGameMode(page, "campaign");

    await expect(page.getByRole("heading", { name: /The (Forge Golem|Frostwarden|Blight Treant|Iron Bear)/ })).toBeVisible({ timeout: 5000 });
    const bossBtn = page.getByRole("button", { name: "Boss Combat" });
    await expect(bossBtn).toBeVisible({ timeout: 3000 });

    await bossBtn.click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });

    await playUntilVictory(page);
    await expect(page.getByRole("heading", { name: /^Victory/ })).toBeVisible({ timeout: 5000 });

    await page.locator('[aria-label^="Select "]').first().click();
    await page.getByRole("button", { name: /^(Add Card|Take Trinket)$/ }).click();

    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });

    const destinationBtns = page.locator("button").filter({ hasText: /Combat|Campfire|Merchant|Alchemist|Mystery|Corruption/ });
    await expect(destinationBtns.first()).toBeVisible({ timeout: 3000 });
    const count = await destinationBtns.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("defeating Act III boss shows run victory screen", async ({ page }) => {
    await enableFastMode(page);
    await injectBossState(page, 3);
    await page.addInitScript(seedRandomScript(42));
    await page.goto("/");
    await resumeGameMode(page, "campaign");

    await expect(page.getByRole("button", { name: "Boss Combat" })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Boss Combat" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
    await playUntilVictory(page);

    await page.locator('[aria-label^="Select "]').first().click();
    await page.getByRole("button", { name: /Take Trinket/ }).click();

    await expect(page.getByRole("heading", { name: /Victory|Triumph|Run Complete/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Main Menu/ })).toBeVisible({ timeout: 3000 });
  });
});
