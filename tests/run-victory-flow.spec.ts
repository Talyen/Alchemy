import { expect, test } from "@playwright/test";
import { enableFastMode, injectBossState, resumeGameMode, seedRandom } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { DestinationPage } from "./pages/destination-page";
import { RewardPage } from "./pages/reward-page";
import { critical } from "./playwright-tags";

test.describe("Boss Fight Flow", critical, () => {
  test("beating Act I boss completes victory flow and displays Act II destination choices", async ({ page }) => {
    await enableFastMode(page);
    await injectBossState(page);
    await seedRandom(page, 42);
    await page.goto("/");
    await resumeGameMode(page, "campaign");

    await expect(page.getByRole("heading", { name: /The (Forge Golem|Frostwarden|Blight Treant|Iron Bear)/ })).toBeVisible({ timeout: 5000 });
    const bossBtn = page.getByRole("button", { name: "Boss Combat" });
    await expect(bossBtn).toBeVisible({ timeout: 3000 });

    await bossBtn.click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });

    await new BattlePage(page).winViaCombat();

    await new RewardPage(page).claimFirstReward();

    const destination = new DestinationPage(page);
    await destination.expectVisible();
    const destinationBtns = page.locator("button").filter({ hasText: /Combat|Campfire|Merchant|Alchemist|Mystery|Corruption/ });
    await expect(destinationBtns.first()).toBeVisible({ timeout: 3000 });
    expect(await destinationBtns.count()).toBeGreaterThanOrEqual(1);
  });

  test("defeating Act III boss shows run victory screen", async ({ page }) => {
    await enableFastMode(page);
    await injectBossState(page, 3);
    await seedRandom(page, 42);
    await page.goto("/");
    await resumeGameMode(page, "campaign");

    await expect(page.getByRole("button", { name: "Boss Combat" })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Boss Combat" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
    await new BattlePage(page).winViaCombat();

    const reward = new RewardPage(page);
    await reward.selectFirstReward();
    await reward.addRewardBtn.click();

    await expect(page.getByRole("heading", { name: /Victory|Triumph|Run Complete/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Main Menu/ })).toBeVisible({ timeout: 3000 });
  });
});
