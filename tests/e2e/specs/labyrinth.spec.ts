import { expect, test as motionTest } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { productionHexLabyrinthMapFixture } from "../../fixtures/labyrinth-hex-map";
import { critical } from "../../playwright-tags";
import { failOnRuntimeErrors, injectLabyrinthRun, makeHighDamageCard } from "../../helpers";
import { labyrinthNodeVisualState } from "@/lib/content-systems/labyrinth/map-state";
import { compareHexPositions } from "@/lib/content-systems/labyrinth/hex-grid";
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
    const rest = page.getByRole("img", { name: "Campfire chamber, locked" }).locator("..");
    await rest.click();
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Main Menu" })).toHaveCount(0);
  });

  test("switching floors dismisses the chamber inspector", async ({ page }) => {
    await injectLabyrinthRun(page, { labyrinthMap: productionHexLabyrinthMapFixture(), resume: true });

    await expect(page.getByRole("heading", { name: /Labyrinth|Map/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("combobox", { name: "Floor", exact: true })).toHaveText("Floor 2");
    const chamber = page.getByRole("button", { name: /chamber/i, disabled: false }).first();
    await chamber.click();
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeVisible();

    await page.getByRole("combobox", { name: "Floor", exact: true }).click();
    await page.getByRole("option", { name: "Floor 1", exact: true }).click();
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Main Menu" })).toBeVisible();
  });
});

test.describe("Labyrinth map presentation", () => {
  test("scrolls larger chambers, preserves their hit targets, and remembers floor positions", async ({
    page,
    runtimeErrors,
  }) => {
    void runtimeErrors;
    await page.setViewportSize({ width: 1280, height: 720 });
    await injectLabyrinthRun(page, { labyrinthMap: productionHexLabyrinthMapFixture(), resume: true });
    const scroll = page.getByTestId("labyrinth-scroll");
    const picker = page.getByRole("combobox", { name: "Floor", exact: true });
    await expect(page.getByRole("button", { name: /Zoom in|Zoom out|Fit floor/ })).toHaveCount(0);
    await expect
      .poll(() => scroll.evaluate((element) => element.scrollHeight - element.clientHeight))
      .toBeGreaterThan(0);
    await expect
      .poll(() => scroll.evaluate((element) => element.scrollWidth - element.clientWidth))
      .toBeLessThanOrEqual(1);
    const chamber = page.getByRole("button", { name: /chamber, reachable/ }).first();
    const before = await chamber.boundingBox();
    await chamber.click();
    const inspector = page.getByRole("complementary", { name: "Chamber details" });
    await expect(inspector).toBeVisible();
    expect(await chamber.boundingBox()).toEqual(before);
    await page.keyboard.press("Escape");
    await expect(chamber).toBeFocused();
    await scroll.hover({ position: { x: 10, y: 10 } });
    await page.mouse.wheel(0, 220);
    await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
    const position = await scroll.evaluate((element) => element.scrollTop);
    await picker.click();
    await page.getByRole("option", { name: "Floor 1", exact: true }).click();
    const completed = page.getByTestId("cleared-chamber");
    await expect(completed).toHaveCount(6);
    await expect(completed.first().locator("img")).toHaveCSS("filter", "grayscale(1)");
    await expect(completed.first().locator("svg path")).toHaveCount(0);
    await picker.click();
    await page.getByRole("option", { name: "Floor 2", exact: true }).click();
    await expect(completed).toHaveCount(0);
    await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeCloseTo(position, 0);
  });

  test("keeps the inspector attached during scrolling and closes when its chamber leaves view", async ({
    page,
    runtimeErrors,
  }) => {
    void runtimeErrors;
    await page.setViewportSize({ width: 1280, height: 720 });
    const map = productionHexLabyrinthMapFixture();
    map.nodes["labyrinth-floor-2-n11"]!.gridPosition = { row: 8, col: -2 };
    await injectLabyrinthRun(page, { labyrinthMap: map, resume: true });
    const chamber = page.getByRole("button", { name: /chamber, reachable/ }).first();
    await chamber.click();
    const inspector = page.getByRole("complementary", { name: "Chamber details" });
    await expect(inspector).toBeVisible();
    const viewport = page.getByTestId("labyrinth-viewport");
    const scroll = page.getByTestId("labyrinth-scroll");
    const initial = (await chamber.boundingBox())!;
    await scroll.hover({ position: { x: 10, y: 10 } });
    await page.mouse.wheel(0, 60);
    await expect.poll(async () => (await chamber.boundingBox())!.y).toBeLessThan(initial.y);
    await expect(inspector).toBeVisible();
    const bounds = (await viewport.boundingBox())!;
    const panel = (await inspector.boundingBox())!;
    expect(panel.x).toBeGreaterThanOrEqual(bounds.x);
    expect(panel.y).toBeGreaterThanOrEqual(bounds.y);
    expect(panel.x + panel.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
    expect(panel.y + panel.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
    await page.mouse.wheel(0, 600);
    await expect
      .poll(() => chamber.evaluate((element) => element.getBoundingClientRect().bottom))
      .toBeLessThan(bounds.y);
    await expect(inspector).toBeHidden();
  });

  test("switches reachable nodes directly and dismisses on unavailable chambers", async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    await page.setViewportSize({ width: 1920, height: 1080 });
    const map = productionHexLabyrinthMapFixture();
    map.nodes["labyrinth-floor-1-n11"]!.outgoingIds.push("labyrinth-floor-2-n1");
    await injectLabyrinthRun(page, { labyrinthMap: map, resume: true });
    const nodes = page.getByRole("button", { name: /chamber, reachable/ });
    const inspector = page.getByRole("complementary", { name: "Chamber details" });
    await nodes.nth(1).click();
    await expect(inspector).toBeVisible();
    await nodes.first().click();
    await expect(nodes.first()).toHaveAttribute("aria-pressed", "true");
    await expect(inspector).toHaveCount(1);
    await page.getByTestId("locked-chamber").first().locator("..").click();
    await expect(inspector).toBeHidden();
    await nodes.first().click();
    await page.keyboard.press("Escape");
    await expect(nodes.first()).toBeFocused();
    await nodes.first().press("Enter");
    await expect(inspector).toBeVisible();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await page.getByRole("heading", { name: "Labyrinth", exact: true }).click();
    await expect(inspector).toBeHidden();
  });

  test("returns from a chamber to the next reachable choices", async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    const map = productionHexLabyrinthMapFixture();
    for (let index = 0; index < 6; index += 1) map.nodes[`labyrinth-floor-2-n${index}`]!.cleared = true;
    const first = Object.values(map.nodes)
      .filter((node) => node.floor === 2 && labyrinthNodeVisualState(map, node.id) === "reachable")
      .sort((a, b) => compareHexPositions(a.gridPosition, b.gridPosition))[0]!;
    first.type = "rest";
    delete first.enemyId;
    await injectLabyrinthRun(page, { labyrinthMap: map, resume: true });
    const chamber = page.locator(`[data-labyrinth-node="${first.id}"]`);
    const scroll = page.getByTestId("labyrinth-scroll");
    await expect(chamber).toBeInViewport();
    await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await chamber.click();
    await page.getByRole("button", { name: "Rest", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Campfire", exact: true, level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Rest", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Labyrinth", exact: true })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeHidden();
    await expect(chamber).toHaveCount(0);
    await expect(page.getByRole("button", { name: /chamber, reachable/ }).first()).toBeInViewport();
    await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  });

  test("keeps locked and completed chambers out of keyboard selection", async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    await injectLabyrinthRun(page, { labyrinthMap: productionHexLabyrinthMapFixture(), resume: true });
    const picker = page.getByRole("combobox", { name: "Floor", exact: true });
    await picker.focus();
    await picker.press("ArrowDown");
    await page.getByRole("option", { name: "Floor 1", exact: true }).press("Home");
    await page.keyboard.press("Enter");
    await expect(picker).toHaveText("Floor 1");
    await expect(page.getByTestId("cleared-chamber")).toHaveCount(6);
    const chamber = page.getByRole("button", { name: /chamber, reachable/ }).first();
    await chamber.focus();
    await chamber.press("Space");
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(chamber).toBeFocused();
    await expect(
      page.locator('[data-testid="cleared-chamber"][tabindex], [data-testid="locked-chamber"][tabindex]'),
    ).toHaveCount(0);
    await chamber.click();
    await page.getByTestId("cleared-chamber").first().locator("..").click();
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeHidden();
  });

  test("keeps long chamber information scrollable after resizing without moving the map", async ({
    page,
    runtimeErrors,
  }) => {
    void runtimeErrors;
    const map = productionHexLabyrinthMapFixture();
    map.nodes["labyrinth-floor-2-n0"]!.modifiers = ["jealous", "tempered", "rooted"];
    map.nodes["labyrinth-floor-2-n0"]!.rewardModifiers = ["alchemist", "companion", "scavenger"];
    await page.setViewportSize({ width: 1280, height: 720 });
    await injectLabyrinthRun(page, { labyrinthMap: map, runOverrides: { selectedAspectRatio: "auto" }, resume: true });
    await page
      .getByRole("button", { name: /chamber, reachable/ })
      .first()
      .click();
    const inspector = page.getByRole("complementary", { name: "Chamber details" });
    await expect(inspector).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 480 });
    const information = page.getByTestId("chamber-art").locator("..");
    await expect
      .poll(() => information.evaluate((element) => element.scrollHeight - element.clientHeight))
      .toBeGreaterThan(0);
    const scroll = page.getByTestId("labyrinth-scroll");
    const mapPosition = await scroll.evaluate((element) => element.scrollTop);
    await information.hover();
    await page.mouse.wheel(0, 1500);
    await expect.poll(() => information.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(page.getByRole("button", { name: "Fight", exact: true })).toBeInViewport();
    expect(await scroll.evaluate((element) => element.scrollTop)).toBe(mapPosition);
    const bounds = (await page.getByTestId("labyrinth-viewport").boundingBox())!;
    const panel = (await inspector.boundingBox())!;
    expect(panel.y).toBeGreaterThanOrEqual(bounds.y);
    expect(panel.y + panel.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
  });

  for (const gameSizePercent of [80, 100, 120]) {
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
    await page.keyboard.press("Escape");
    await expect(inspector).toBeHidden();
    await expect(chamber).toBeFocused();
    await chamber.tap();
    await expect(inspector).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(inspector).toBeHidden();
  });
});

motionTest("Labyrinth reduced motion keeps selection still and removes animated shine", async ({ page }) => {
  const errors = failOnRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await injectLabyrinthRun(page, { labyrinthMap: productionHexLabyrinthMapFixture(), resume: true });
  const node = page.getByRole("button", { name: /chamber, reachable/ }).first();
  await node.click();
  await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeVisible();
  const art = node.locator("..").locator(".labyrinth-node-art");
  await expect(art).toHaveCSS("scale", "none");
  await expect(art).toHaveCSS("translate", "none");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("labyrinth-viewport").locator("animate")).toHaveCount(0);
  expect(errors).toEqual([]);
});
