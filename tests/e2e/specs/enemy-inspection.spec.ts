import type { LabyrinthMap } from "@/lib/content-systems/types";
import { gridLabyrinthMapFixture } from "../../fixtures/labyrinth-map";
import { expect, test } from "../../fixtures/e2e";
import type { Locator } from "@playwright/test";
import { makeCard, seedRandom, startBattleWithDeck, assertNoOverflow, injectLabyrinthRun } from "../../browser-helpers";
import { MenuPage } from "../../pages/menu-page";
import { critical } from "../../playwright-tags";

test(
  "enemy inspection preserves battle and fades portrait hover before card inspection",
  critical,
  async ({ page }) => {
    test.setTimeout(60_000);

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
  },
);

test(
  "Bestiary uses the same trait and ability inspection without revealing undiscovered enemies",
  critical,
  async ({ page }) => {
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
  },
);

async function readTraitSizing(trait: Locator) {
  return trait.evaluate((element) => {
    const icon = element.querySelector("svg")!;
    const iconSize = icon.getBoundingClientRect().width;
    const scale = iconSize / parseFloat(getComputedStyle(icon).width);
    return [
      parseFloat(getComputedStyle(element.querySelector("h3")!).fontSize) * scale,
      parseFloat(getComputedStyle(element.querySelector("p")!).fontSize) * scale,
      iconSize,
    ];
  });
}

test("enemy Trait boxes stay unified and adapt to inspection width", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const map: LabyrinthMap = gridLabyrinthMapFixture();
  const node = map.nodes["labyrinth-floor-1-n0"]!;
  node.enemyId = "vampire";
  node.modifiers = ["caustic", "flesheater"];
  node.rewardModifiers = ["alchemist"];
  await injectLabyrinthRun(page, {
    labyrinthMap: map,
    deck: Array.from({ length: 6 }, () => makeCard()),
    runOverrides: { selectedAspectRatio: "auto" },
  });
  await page.locator(`[data-labyrinth-node="${node.id}"]`).click();
  const details = page.getByRole("complementary", { name: "Chamber details" });
  await expect(details.locator("[data-trait]")).toHaveCount(3);
  await expect(details).toHaveCSS("opacity", "1");
  const mapTrait = details.locator('[data-trait="caustic"]');
  const mapSizing = await readTraitSizing(mapTrait);
  await page.screenshot({ path: testInfo.outputPath("traits-map.png") });
  await page.getByRole("button", { name: "Fight", exact: true }).click();
  const enemy = page.getByTestId("battle-enemy-art-panel");
  await expect(page.getByRole("button", { name: /^View Deck/ })).toHaveAttribute("aria-disabled", "false", {
    timeout: 20_000,
  });
  await enemy.hover();
  const tooltip = page.locator(".hover-popup-panel[data-visible]");
  await expect(tooltip.locator("[data-trait]")).toHaveCount(4);
  await expect(tooltip).not.toContainText("Special Modifiers");
  await expect(tooltip).toHaveCSS("opacity", "1");
  const hoverSizing = await readTraitSizing(tooltip.locator('[data-trait="caustic"]'));
  for (const [index, size] of hoverSizing.entries()) expect(size).toBeCloseTo(mapSizing[index]!, 1);
  await page.screenshot({ path: testInfo.outputPath("traits-hover.png") });
  const tooltipBox = (await tooltip.boundingBox())!;
  expect(tooltipBox.width).toBeGreaterThan(280);
  expect(tooltipBox.width).toBeLessThanOrEqual(448);
  expect(tooltipBox.x).toBeGreaterThanOrEqual(0);
  expect(tooltipBox.y).toBeGreaterThanOrEqual(0);
  expect(tooltipBox.x + tooltipBox.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(tooltipBox.y + tooltipBox.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await enemy.click();
  const dialog = page.getByRole("dialog", { name: "Vampire" });
  const traits = dialog.locator("[data-trait]");
  await expect(traits).toHaveCount(4);
  await expect(dialog).not.toContainText("Special Modifiers");
  const inspectTrait = dialog.locator('[data-trait="caustic"]');
  const inspectSizing = await readTraitSizing(inspectTrait);
  for (const [index, size] of inspectSizing.entries()) expect(size).toBeCloseTo(mapSizing[index]!, 1);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect
    .poll(async () => (await traits.nth(1).boundingBox())!.y - (await traits.nth(0).boundingBox())!.y)
    .toBe(0);
  const first = (await traits.nth(0).boundingBox())!;
  const second = (await traits.nth(1).boundingBox())!;
  expect(second.y).toBeCloseTo(first.y, 0);
  expect(second.x).toBeGreaterThan(first.x + first.width);
  expect(second.height).toBeCloseTo(first.height, 0);
  await expect(tooltip).toHaveCount(0);
  await expect(page.getByTestId("enemy-inspection-overlay")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("traits-inspection-wide.png") });
  await page.setViewportSize({ width: 600, height: 900 });
  await expect
    .poll(async () => {
      const firstBox = (await traits.nth(0).boundingBox())!;
      const nextBox = (await traits.nth(1).boundingBox())!;
      return nextBox.y > firstBox.y + firstBox.height;
    })
    .toBe(true);
  await assertNoOverflow(page, "narrow enemy Traits");
  await page.screenshot({ path: testInfo.outputPath("traits-inspection-narrow.png") });
});
