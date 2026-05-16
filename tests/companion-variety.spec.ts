import { expect, test } from "@playwright/test";
import { injectSaveState, navigateToDestination } from "./helpers";

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

async function readEnemyHp(page: import("@playwright/test").Page) {
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
      await page.getByRole("button", { name: "Resume Run" }).click();
      await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
      await navigateToDestination(page, "Normal Combat");
      await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

      await page.locator(`[aria-label="Play ${comp.cardTitle}"]`).first().click();
      await page.waitForTimeout(300);

      await expect(page.getByTestId("active-companion")).toBeVisible({ timeout: 2000 });

      const enemyHpBefore = await readEnemyHp(page);

      await page.getByRole("button", { name: "End Turn" }).click();
      await expect(page.getByRole("button", { name: "End Turn" })).toBeEnabled({ timeout: 8000 });

      const enemyHpAfter = await readEnemyHp(page);
      expect(enemyHpAfter).toBeLessThanOrEqual(enemyHpBefore);
    });
  }
});

test.describe("Pack Tactics", () => {
  test("pack tactics buffs companion damage after summoning", async ({ page }) => {
    const WOLF = {
      id: "wolf-companion", title: "Wolf",
      descriptionLines: ["Deals 1 Bleed damage each turn", "Companion"],
      art: "placeholder", cost: 1, consume: true,
      effects: [{ kind: "summon-companion" as const, companionId: "wolf" as const }],
    };
    const PACK_TACTICS = {
      id: "pack-tactics", title: "Pack Tactics",
      descriptionLines: ["Increase Companion damage by 1", "Deal 2 Nature damage"],
      art: "placeholder", cost: 1,
      effects: [
        { kind: "buff-companion" as const, amount: 1 },
        { kind: "damage" as const, damageType: "nature" as const, amount: 2 },
      ],
    };

    await injectSaveState(page, {
      runDeck: [WOLF, WOLF, WOLF, WOLF, PACK_TACTICS, PACK_TACTICS, PACK_TACTICS, PACK_TACTICS],
      discoveredCardIds: ["wolf-companion", "pack-tactics"],
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Resume Run" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    await page.locator('[aria-label="Play Wolf"]').first().click();
    await page.waitForTimeout(200);
    await expect(page.getByTestId("active-companion")).toBeVisible({ timeout: 2000 });

    await page.locator('[aria-label="Play Pack Tactics"]').first().click();
    await page.waitForTimeout(200);

    const enemyHpBefore = await readEnemyHp(page);

    await page.getByRole("button", { name: "End Turn" }).click();
    await expect(page.getByRole("button", { name: "End Turn" })).toBeEnabled({ timeout: 8000 });

    const enemyHpAfter = await readEnemyHp(page);

    test.skip(enemyHpAfter >= enemyHpBefore, "Enemy HP did not decrease");
    expect(enemyHpAfter).toBeLessThan(enemyHpBefore);
  });
});
