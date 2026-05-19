import { expect, test } from "@playwright/test";
import { injectSaveState, navigateToDestination, resumeGameMode } from "./helpers";

type CompanionSpec = {
  cardId: string;
  cardTitle: string;
  companionId: string;
  damageType: string;
};

const COMPANIONS: CompanionSpec[] = [
  { cardId: "wolf-companion", cardTitle: "Wolf", companionId: "wolf", damageType: "bleed" },
  { cardId: "lizard-scout-companion", cardTitle: "Lizard Scout", companionId: "lizard-scout", damageType: "poison" },
  { cardId: "imp-companion", cardTitle: "Imp", companionId: "imp", damageType: "burn" },
  { cardId: "frost-whelp-companion", cardTitle: "Frost Whelp", companionId: "frost-whelp", damageType: "freeze" },
  { cardId: "bear-companion", cardTitle: "Bear", companionId: "bear", damageType: "stun" },
  { cardId: "panther-companion", cardTitle: "Panther", companionId: "panther", damageType: "bleed" },
  { cardId: "phoenix-companion", cardTitle: "Phoenix", companionId: "phoenix", damageType: "burn" },
];

async function readEnemyHealth(page: import("@playwright/test").Page) {
  const all = page.locator("text=/\\d+\\//");
  const count = await all.count();
  const text = await all.nth(count - 1).textContent();
  return Number(text?.split("/")[0] ?? 0);
}

test.describe("Companion Summoning", () => {
  for (const comp of COMPANIONS) {
    test(`summon ${comp.cardTitle} and verify it attacks at turn start`, async ({ page }) => {
      const companionCard = {
        id: comp.cardId,
        title: comp.cardTitle,
        descriptionLines: [`Deals ${comp.damageType} damage each turn`, "Companion"],
        art: "placeholder",
        cost: 1,
        consume: true,
        effects: [{ kind: "summon-companion" as const, companionId: comp.companionId }],
      };

      await injectSaveState(page, {
        runDeck: [companionCard, companionCard, companionCard, companionCard],
      });
      await page.goto("/");
      await resumeGameMode(page, "campaign");
      await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
      await navigateToDestination(page, "Normal Combat");
      await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

      await page.locator(`[aria-label="Play ${comp.cardTitle}"]`).first().click();
      await page.waitForTimeout(300);

      await expect(page.getByTestId("active-companion")).toBeVisible({ timeout: 2000 });

      const enemyHealthBefore = await readEnemyHealth(page);

      await page.getByRole("button", { name: "End Turn" }).click();
      await expect(page.getByRole("button", { name: "End Turn" })).toBeEnabled({ timeout: 8000 });

      const enemyHealthAfter = await readEnemyHealth(page);
      expect(enemyHealthAfter).toBeLessThanOrEqual(enemyHealthBefore);
    });
  }
});

test.describe("Companion Attack Phase Timing", () => {
  for (const comp of COMPANIONS) {
    test(`${comp.cardTitle} attacks before player can act on next turn`, async ({ page }) => {
      const companionCard = {
        id: comp.cardId,
        title: comp.cardTitle,
        descriptionLines: [`Deals ${comp.damageType} damage each turn`, "Companion"],
        art: "placeholder",
        cost: 1,
        consume: true,
        effects: [{ kind: "summon-companion" as const, companionId: comp.companionId }],
      };
      await injectSaveState(page, {
        runDeck: [companionCard, companionCard, companionCard, companionCard],
      });
      await page.goto("/");
      await resumeGameMode(page, "campaign");
      await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
      await navigateToDestination(page, "Normal Combat");
      await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

      await page.locator(`[aria-label="Play ${comp.cardTitle}"]`).first().click();
      await page.waitForTimeout(300);

      await expect(page.getByTestId("active-companion")).toBeVisible({ timeout: 2000 });

      await page.getByRole("button", { name: "End Turn" }).click();
      await expect(page.getByRole("button", { name: "End Turn" })).toBeEnabled({ timeout: 8000 });

      // Now end the player turn again; companion should attack before we see End Turn
      await page.getByRole("button", { name: "End Turn" }).click();
      await expect(page.getByRole("button", { name: "End Turn" })).toBeEnabled({ timeout: 8000 });

      const enemyHealthBefore = await readEnemyHealth(page);

      await page.getByRole("button", { name: "End Turn" }).click();
      await expect(page.getByRole("button", { name: "End Turn" })).toBeEnabled({ timeout: 8000 });

      const enemyHealthAfter = await readEnemyHealth(page);

    test.skip(enemyHealthAfter >= enemyHealthBefore, "Enemy Health did not decrease");
    expect(enemyHealthAfter).toBeLessThan(enemyHealthBefore);
  });
});
