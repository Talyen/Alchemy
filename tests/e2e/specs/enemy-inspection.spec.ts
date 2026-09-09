import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors, makeCard, seedRandom, startBattleWithDeck, assertNoOverflow } from "../../helpers";
import { MenuPage } from "../../pages/menu-page";
import { critical } from "../../playwright-tags";

test(
  "enemy inspection preserves battle and fades portrait hover before card inspection",
  critical,
  async ({ page }) => {
    test.setTimeout(60_000);
    const errors = failOnRuntimeErrors(page);
    await seedRandom(page, 42);
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    await expect(page.getByRole("button", { name: /^View Deck/ })).toHaveAttribute("aria-disabled", "false", {
      timeout: 20_000,
    });
    const enemy = page.getByTestId("battle-enemy-art-panel");
    const health = await page.getByTestId("player-health").innerText();
    const enemyHealth = await page.getByTestId("enemy-health").innerText();
    await enemy.hover();
    const tooltip = page.locator(".hover-popup-panel[data-visible]");
    await expect(tooltip.locator("[data-enemy-trait]").first()).toBeVisible();
    await expect(tooltip.locator("svg").first()).toBeVisible();
    await expect(tooltip.locator("img")).toHaveCount(0);
    await enemy.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Traits", exact: true })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Abilities", exact: true })).toBeVisible();
    await expect(tooltip).toHaveCount(0);
    await expect(dialog.getByRole("img")).toHaveCount(3);
    await expect(dialog.locator("hr")).toHaveCount(0);
    const card = dialog.getByTestId("card-selection-grid").getByRole("button").first();
    const cardName = await card.getAttribute("aria-label");
    await card.hover();
    await expect(tooltip).toContainText(cardName!);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(enemy).toBeFocused();
    await expect(tooltip).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close enemy inspection" })).toBeFocused();
    await dialog.getByTestId("card-selection-grid").getByRole("button").first().focus();
    await expect(tooltip).toContainText(cardName!);
    await assertNoOverflow(page, "enemy inspection");
    await page.getByTestId("enemy-inspection-overlay").click({ position: { x: 4, y: 4 } });
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("player-health")).toHaveText(health);
    await expect(page.getByTestId("enemy-health")).toHaveText(enemyHealth);
    expect(errors).toEqual([]);
  },
);

test(
  "Bestiary uses the same trait and ability inspection without revealing undiscovered enemies",
  critical,
  async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await new MenuPage(page).gotoCollection({ encounteredEnemyIds: ["bandit"] });
    await page.getByRole("button", { name: "Bestiary", exact: true }).click();
    const bandit = page.getByRole("button", { name: "Inspect Bandit", exact: true });
    await bandit.hover();
    const tooltip = page.locator(".hover-popup-panel[data-visible]");
    await expect(tooltip).toContainText("Ambush");
    await expect(tooltip).not.toContainText("Slash");
    await bandit.click();
    const dialog = page.getByRole("dialog", { name: "Bandit" });
    await expect(dialog.getByRole("heading", { name: "Abilities" })).toBeVisible();
    await expect(tooltip).toHaveCount(0);
    for (const name of ["Slash", "Serrated Edge", "Block"])
      await expect(dialog.getByRole("img", { name, exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Serrated Edge", exact: true }).focus();
    await expect(tooltip).toContainText("Deal 1 Bleed damage");
    await expect(tooltip).toContainText("Deal 3 Physical damage");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(bandit).toBeFocused();
    await expect(tooltip).toHaveCount(0);
    const undiscovered = page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first();
    await undiscovered.hover();
    await expect(tooltip).toContainText("Undiscovered");
    await expect(tooltip.locator("[data-enemy-trait]")).toHaveCount(0);
    await undiscovered.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(errors).toEqual([]);
  },
);
