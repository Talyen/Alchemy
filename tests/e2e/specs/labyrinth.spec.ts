import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { productionHexLabyrinthMapFixture } from "../../fixtures/labyrinth-hex-map";
import { critical } from "../../playwright-tags";
import { injectLabyrinthRun, makeHighDamageCard } from "../../helpers";
import { MenuPage } from "../../pages/menu-page";

test.describe("Labyrinth Mode", critical, () => {
  test.beforeEach(async ({ runtimeErrors }) => {
    void runtimeErrors;
  });

  test("a new Labyrinth run displays enterable chambers", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goToCharacterSelectUnlocked("labyrinth");
    await menu.selectCharacterAndContinue("Knight");

    await expect(page.getByRole("heading", { name: "Labyrinth", exact: true })).toBeVisible();
    const chamber = page.getByRole("button", { name: /chamber, reachable, enterable/ }).first();
    await expect(chamber).toBeVisible();
    await chamber.click();
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeVisible();
  });

  test("labyrinth map shows selected chamber details", async ({ page }) => {
    await injectLabyrinthRun(page, { deck: Array.from({ length: 6 }, () => makeHighDamageCard()), resume: true });

    await expect(page.getByRole("heading", { name: /Labyrinth|Map/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("region", { name: "Labyrinth map" })).toBeVisible();
    await expect(page.getByTestId("vr-stage")).toBeVisible();

    const combatNodes = page.getByRole("button", { name: /Combat chamber/ });
    await expect(combatNodes.first()).toBeVisible({ timeout: 8000 });
    await combatNodes.first().click();
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Fight", exact: true })).toBeVisible({ timeout: 5000 });
    const art = (await page.getByTestId("chamber-art").boundingBox())!;
    expect(art.width / art.height).toBeCloseTo(4 / 3, 2);

    await page.keyboard.press("Escape");
    const restNodes = page.getByRole("button", { name: /Campfire chamber/ });
    await expect(restNodes.first()).toBeVisible({ timeout: 5000 });
    await restNodes.first().click();
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Fight", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Rest", exact: true })).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeHidden({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Main Menu" })).toHaveCount(0);
  });

  test("switching floors dismisses the chamber inspector", async ({ page }) => {
    await injectLabyrinthRun(page, { labyrinthMap: productionHexLabyrinthMapFixture(), resume: true });

    await expect(page.getByRole("heading", { name: /Labyrinth|Map/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Floor 1" })).toBeVisible();
    const chamber = page.getByRole("button", { name: /chamber/i, disabled: false }).first();
    await chamber.click();
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeVisible();

    await page.getByRole("button", { name: "Floor 1" }).click();
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Main Menu" })).toBeVisible();
  });
});

test.describe("Labyrinth map presentation", () => {
  test("fits a complete floor and keeps its layout when inspecting", async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    await page.setViewportSize({ width: 1280, height: 720 });
    await injectLabyrinthRun(page, { labyrinthMap: productionHexLabyrinthMapFixture(), resume: true });
    const viewport = page.getByTestId("labyrinth-viewport");
    await expect(page.getByRole("button", { name: /Zoom in|Zoom out|Fit floor/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /chamber,/ })).toHaveCount(12);
    await expect
      .poll(() =>
        viewport.evaluate((element) =>
          Math.max(element.scrollHeight - element.clientHeight, element.scrollWidth - element.clientWidth),
        ),
      )
      .toBeLessThanOrEqual(1);
    const region = await viewport.boundingBox();
    for (const chamber of await page.getByRole("button", { name: /chamber,/ }).all()) {
      const box = await chamber.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(region!.x);
      expect(box!.y).toBeGreaterThanOrEqual(region!.y);
      expect(box!.x + box!.width).toBeLessThanOrEqual(region!.x + region!.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(region!.y + region!.height);
    }
    const node = page.getByRole("button", { name: /chamber, reachable/ }).first();
    const before = await node.boundingBox();
    await node.click();
    const inspector = page.getByRole("complementary", { name: "Chamber details" });
    await expect(inspector).toBeVisible();
    expect(await node.boundingBox()).toEqual(before);
    await expect(page.getByRole("button", { name: "Close chamber details" })).toHaveCount(0);
    const panel = (await inspector.boundingBox())!;
    expect(panel.x).toBeGreaterThanOrEqual(region!.x);
    expect(panel.y).toBeGreaterThanOrEqual(region!.y);
    expect(panel.x + panel.width).toBeLessThanOrEqual(region!.x + region!.width + 1);
    expect(panel.y + panel.height).toBeLessThanOrEqual(region!.y + region!.height + 1);
    await page.getByRole("heading", { name: "Labyrinth", exact: true }).click();
    await expect(inspector).toBeHidden();
    await page.getByRole("button", { name: "Floor 1", exact: true }).click();
    const completed = page.getByTestId("cleared-chamber");
    await expect(completed).toHaveCount(6);
    await expect(completed.first().locator("img")).toBeVisible();
    await expect(completed.first()).toHaveCSS("pointer-events", "none");
    await expect(completed.first()).toHaveCSS("opacity", "1");
    await expect(completed.first().locator("svg path")).toBeVisible();
    await expect(page.getByRole("button", { name: /chamber,/ })).toHaveCount(6);
    await page.screenshot({ path: test.info().outputPath("completed.png") });
  });

  test("pins every chamber inspector within the map and switches directly between visible nodes", async ({
    page,
    runtimeErrors,
  }) => {
    void runtimeErrors;
    await page.setViewportSize({ width: 1920, height: 1080 });
    await injectLabyrinthRun(page, { labyrinthMap: productionHexLabyrinthMapFixture(), resume: true });
    const viewport = page.getByTestId("labyrinth-viewport");
    const inspector = page.getByRole("complementary", { name: "Chamber details" });
    const nodes = page.getByRole("button", { name: /chamber,/ });
    const bounds = (await viewport.boundingBox())!;
    for (const node of await nodes.all()) {
      await node.click();
      await expect(inspector).toBeVisible();
      const box = (await inspector.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(bounds.x);
      expect(box.y).toBeGreaterThanOrEqual(bounds.y);
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
      await page.keyboard.press("Escape");
      await expect(node).toBeFocused();
    }
    await nodes.first().click();
    const nextId = await nodes.evaluateAll((elements) => {
      for (const element of elements) {
        if (element.getAttribute("aria-pressed") === "true") continue;
        const box = element.getBoundingClientRect();
        if (element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)))
          return element.getAttribute("data-labyrinth-node");
      }
      return null;
    });
    expect(nextId).not.toBeNull();
    const next = page.locator(`[data-labyrinth-node="${nextId}"]`);
    await next.click();
    await expect(next).toHaveAttribute("aria-pressed", "true");
    await expect(inspector).toHaveCount(1);
    await expect(inspector).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("map-inspector.png") });
    await viewport.click({ position: { x: 2, y: 2 } });
    await expect(inspector).toBeHidden();
  });

  test("hover is opaque and in front without tooltips; keyboard activation only inspects", async ({
    page,
    runtimeErrors,
  }) => {
    void runtimeErrors;
    await injectLabyrinthRun(page, { labyrinthMap: productionHexLabyrinthMapFixture(), resume: true });
    const chamber = page.getByRole("button", { name: /chamber, locked/ }).first();
    await chamber.hover();
    await expect(chamber).toHaveCSS("opacity", "1");
    await expect(chamber.locator("..")).toHaveCSS("z-index", "30");
    await expect(chamber).toHaveCSS("scale", "none");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await chamber.focus();
    await chamber.press("Enter");
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fight", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Labyrinth", exact: true })).toBeVisible();
  });

  for (const gameSizePercent of [80, 120]) {
    test(`artwork remains 4:3 with modifiers at Game Size ${gameSizePercent}`, async ({ page, runtimeErrors }) => {
      void runtimeErrors;
      await page.addInitScript((size) => {
        localStorage.setItem(
          "alchemy-device-display-v1",
          JSON.stringify({ version: 1, gameSizePercent: size, tooltipSizePercent: 100 }),
        );
      }, gameSizePercent);
      await page.setViewportSize({ width: 1280, height: 720 });
      const map = productionHexLabyrinthMapFixture();
      const entry = map.nodes["labyrinth-floor-2-n0"]!;
      entry.modifiers = ["jealous"];
      entry.rewardModifiers = gameSizePercent === 120 ? ["alchemist"] : [];
      await injectLabyrinthRun(page, { labyrinthMap: map, resume: true });
      await page
        .getByRole("button", { name: /chamber, reachable/ })
        .first()
        .click();
      const art = page.getByTestId("chamber-art");
      await expect(art).toBeVisible();
      const box = await art.boundingBox();
      expect(box!.width / box!.height).toBeCloseTo(4 / 3, 2);
      const fight = page.getByRole("button", { name: "Fight", exact: true });
      await expect(fight).toBeInViewport();
      await expect(page.getByRole("heading", { name: "Goblin" })).toHaveCount(1);
      await expect(page.getByText("Combat", { exact: true })).toHaveCount(1);
      await expect(page.getByText("Fight a standard enemy encounter")).toHaveCount(0);
      await expect(page.getByRole("complementary", { name: "Chamber details" })).toHaveCSS("opacity", "1");
      await page.screenshot({ path: test.info().outputPath("inspector.png") });
    });
  }
});

test.describe("Labyrinth touch inspector", () => {
  test.use({ hasTouch: true });

  test("keeps artwork and action usable on narrow screens and restores map focus", async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    await page.setViewportSize({ width: 600, height: 900 });
    const map = productionHexLabyrinthMapFixture();
    map.nodes["labyrinth-floor-2-n0"]!.modifiers = ["jealous"];
    map.nodes["labyrinth-floor-2-n0"]!.rewardModifiers = ["alchemist"];
    await injectLabyrinthRun(page, { labyrinthMap: map, runOverrides: { selectedAspectRatio: "auto" } });
    const chamber = page.getByRole("button", { name: /chamber, reachable/ }).first();
    await chamber.tap();
    const inspector = page.getByRole("complementary", { name: "Chamber details" });
    await expect(inspector).toBeInViewport();
    await expect(page.getByRole("button", { name: "Dismiss chamber details" })).toHaveCount(0);
    const art = await page.getByTestId("chamber-art").boundingBox();
    expect(art!.width / art!.height).toBeCloseTo(4 / 3, 2);
    await expect(page.getByRole("button", { name: "Fight", exact: true })).toBeInViewport();
    await expect(inspector.locator("..")).toBeFocused();
    await expect(inspector).toHaveCSS("opacity", "1");
    await page.screenshot({ path: test.info().outputPath("touch-inspector.png") });
    await page.keyboard.press("Escape");
    await expect(inspector).toBeHidden();
    await expect(chamber).toBeFocused();
    await chamber.tap();
    await expect(inspector).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(inspector).toBeHidden();
  });
});
