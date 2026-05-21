import { expect, test, type Page } from "@playwright/test";
import { selectGameMode } from "./helpers";

async function getRunDeckCardIds(page: Page, characterId: string): Promise<string[]> {
  for (let i = 0; i < 30; i++) {
    const saveStateJson = await page.evaluate(() => localStorage.getItem("alchemy-save-v1"));
    if (saveStateJson) {
      const save = JSON.parse(saveStateJson);
      if (save.activeRun?.characterId === characterId && Array.isArray(save.activeRun.runDeck)) {
        return save.activeRun.runDeck.map((c: { id: string }) => c.id);
      }
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Could not find active run for character ${characterId} in localStorage`);
}

test.describe("Character Starting Decks", () => {
  test("Knight starts with expected cards", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    const cardIds = await getRunDeckCardIds(page, "knight");
    expect(cardIds).toEqual([
      "anvil",
      "bash",
      "bread",
      "slash",
      "block",
      "plate-mail",
      "stoneskin-potion",
      "shield-bash",
    ]);
  });

  test("Rogue starts with expected cards", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Rogue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    const cardIds = await getRunDeckCardIds(page, "rogue");
    expect(cardIds).toEqual([
      "steal",
      "poison-dagger",
      "stab",
      "slash",
      "fangs",
      "apple",
      "luck-potion",
      "acid-potion",
      "blackjack",
    ]);
  });

  test("Wizard starts with expected cards", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Wizard" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    const cardIds = await getRunDeckCardIds(page, "wizard");
    expect(cardIds).toEqual([
      "fireball",
      "frostbolt",
      "mana-berries",
      "mana-crystals",
      "mana-potion",
      "meteor",
      "health-potion",
      "wishing-potion",
      "wish",
    ]);
  });

  test("Ranger starts with expected cards", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Ranger" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    const cardIds = await getRunDeckCardIds(page, "ranger");
    expect(cardIds).toEqual([
      "slash",
      "stab",
      "fangs",
      "heal",
      "wolf-companion",
      "apple",
      "mana-berries",
      "pack-tactics",
      "bloodthorn",
    ]);
  });
});
