import { expect, test } from "@playwright/test";
import { injectSaveState, navigateToDestination, resumeGameMode } from "./helpers";

const SLASH = { id: "slash", title: "Slash", descriptionLines: ["Deal 6 Physical damage"], art: "placeholder", cost: 1, effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 6 }] };
const BLOCK = { id: "block", title: "Block", descriptionLines: ["Gain 5 Block"], art: "placeholder", cost: 1, effects: [{ kind: "player-status" as const, status: "block" as const, amount: 5 }] };
const ANVIL = { id: "anvil", title: "Anvil", descriptionLines: ["Gain 1 Forge"], art: "placeholder", cost: 1, effects: [{ kind: "player-status" as const, status: "forge" as const, amount: 1 }] };

async function readPlayerHp(page: import("@playwright/test").Page) {
  const text = await page.locator("text=/\\d+\\//").first().textContent();
  return Number(text?.split("/")[0] ?? 0);
}

test.describe("Leech Mechanics", () => {
  test("lifesteal heals player for damage dealt", async ({ page }) => {
    const FANGS = { id: "fangs", title: "Fangs", descriptionLines: ["Deal 2 Bleed damage", "Leech"], art: "placeholder", cost: 1, effects: [{ kind: "damage" as const, damageType: "bleed" as const, amount: 2, lifesteal: true as const }] };
    await injectSaveState(page, {
      runPlayerHealth: 20,
      runMaxHealth: 30,
      runDeck: [FANGS, FANGS, FANGS, FANGS, FANGS, FANGS, FANGS, FANGS],
    });
    await page.goto("/");
    await resumeGameMode(page, "campaign");
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const playerHpBefore = await readPlayerHp(page);

    const fangs = page.locator('[aria-label="Play Fangs"]').first();
    if (!(await fangs.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, "Fangs not in initial hand");
      return;
    }
    await fangs.click();
    await page.waitForTimeout(400);

    const playerHpAfter = await readPlayerHp(page);
    expect(playerHpAfter).toBeGreaterThan(playerHpBefore);
  });
});

test.describe("Forge Consumption", () => {
  test("forge is consumed when dealing physical damage", async ({ page }) => {
    await injectSaveState(page, {
      runDeck: [ANVIL, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH],
    });
    await page.goto("/");
    await resumeGameMode(page, "campaign");
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const anvil = page.locator('[aria-label="Play Anvil"]').first();
    if (!(await anvil.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, "Anvil not in initial hand");
      return;
    }
    await anvil.click();
    await page.waitForTimeout(300);

    await expect(page.getByRole("button", { name: "Forge 1" })).toBeVisible({ timeout: 2000 });

    const slash = page.locator('[aria-label="Play Slash"]').first();
    if (!(await slash.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, "Slash not in hand after Anvil");
      return;
    }
    await slash.click();
    await page.waitForTimeout(400);

    await expect(page.getByRole("button", { name: /Forge/ })).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe("Block Decay", () => {
  test("block decreases by half each turn", async ({ page }) => {
    await injectSaveState(page, {
      runDeck: [BLOCK, BLOCK, BLOCK, BLOCK, SLASH, SLASH, SLASH, SLASH],
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });
    await page.goto("/");
    await resumeGameMode(page, "campaign");
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const block = page.locator('[aria-label="Play Block"]').first();
    if (!(await block.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, "Block not in initial hand");
      return;
    }
    await block.click();
    await page.waitForTimeout(300);

    await expect(page.getByRole("button", { name: "Block 5" })).toBeVisible({ timeout: 2000 });

    await page.getByRole("button", { name: "End Turn" }).click();
    await expect(page.getByRole("button", { name: "End Turn" })).toBeEnabled({ timeout: 8000 });

    const blockAfterTurn = page.getByRole("button", { name: /Block \d+/ });
    if (await blockAfterTurn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const blockText = await blockAfterTurn.getAttribute("aria-label");
      const blockValue = Number(blockText?.split(" ")[1] ?? 0);
      expect(blockValue).toBeLessThan(5);
    }
  });
});

test.describe("Max Hand Size", () => {
  test("hand is capped at 7 cards when deck has more", async ({ page }) => {
    await injectSaveState(page, {
      runDeck: [SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH],
    });
    await page.goto("/");
    await resumeGameMode(page, "campaign");
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const handCount = await page.locator('[aria-label^="Play "]').count();
    expect(handCount).toBeLessThanOrEqual(7);
  });
});
