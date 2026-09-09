import { expect, test as motionTest } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { productionHexLabyrinthMapFixture } from "../../fixtures/labyrinth-hex-map";
import { critical } from "../../playwright-tags";
import { failOnRuntimeErrors, injectLabyrinthRun } from "../../helpers";
import { MenuPage } from "../../pages/menu-page";

const chamberDetails = "Chamber details";

test.describe("Labyrinth exploration", critical, () => {
  test.beforeEach(async ({ runtimeErrors }) => {
    void runtimeErrors;
  });

  test("a new run opens a complete floor with inspectable chambers", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goToCharacterSelectUnlocked("labyrinth");
    await menu.selectCharacterAndContinue("Knight");
    await expect(page.getByRole("heading", { name: "Labyrinth", exact: true })).toBeVisible();
    await expect(page.getByRole("status", { name: "Floor 1" })).toBeVisible();
    await page
      .getByRole("button", { name: /chamber, reachable, enterable/ })
      .first()
      .click();
    await expect(page.getByRole("complementary", { name: chamberDetails })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fight", exact: true })).toBeVisible();
  });

  test("inspects unexplored and completed rooms, preserves the map, and restores keyboard focus", async ({ page }) => {
    const map = productionHexLabyrinthMapFixture();
    map.currentFloor = 1;
    map.currentNodeId = "labyrinth-floor-1-n4";
    await page.setViewportSize({ width: 1920, height: 1080 });
    await injectLabyrinthRun(page, { labyrinthMap: map });
    const nodes = page.locator("[data-labyrinth-node]");
    await expect(nodes).toHaveCount(12);
    const boxes = await nodes.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().toJSON()),
    );
    const unexplored = page.getByRole("button", { name: /chamber, unexplored/ }).first();
    await unexplored.click();
    await expect(page.getByText("Explore an adjacent chamber to enter.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Fight|Rest|Enter)$/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(unexplored).toBeFocused();
    const current = page.locator('[aria-current="location"]');
    await current.press("Space");
    await expect(page.getByText("You are here", { exact: true })).toBeVisible();
    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(current).toBeFocused();
    const available = page.getByRole("button", { name: /chamber, reachable/ });
    await available.first().click();
    await available.last().click();
    await expect(available.last()).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("complementary", { name: chamberDetails })).toHaveCount(1);
    expect(
      await nodes.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON())),
    ).toEqual(boxes);
    await page.getByRole("heading", { name: "Labyrinth", exact: true }).click();
    await expect(page.getByRole("complementary", { name: chamberDetails })).toBeHidden();
  });

  test("returning from a room preserves geography and saves the player's location", async ({ page }) => {
    const map = productionHexLabyrinthMapFixture();
    const target = map.nodes["labyrinth-floor-2-n0"]!;
    target.type = "rest";
    delete target.enemyId;
    await injectLabyrinthRun(page, { labyrinthMap: map });
    const room = page.locator(`[data-labyrinth-node="${target.id}"]`);
    const before = await room.boundingBox();
    await room.click();
    await page.getByRole("button", { name: "Rest", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Campfire", exact: true, level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Rest", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Labyrinth", exact: true })).toBeVisible();
    await expect(room).toHaveAttribute("aria-current", "location");
    expect(await room.boundingBox()).toEqual(before);
    await expect(page.getByRole("complementary", { name: chamberDetails })).toBeHidden();
    const fresh = await page.context().newPage();
    try {
      await fresh.goto("/");
      await expect(fresh.locator(`[data-labyrinth-node="${target.id}"]`)).toHaveAttribute("aria-current", "location", {
        timeout: 20000,
      });
    } finally {
      await fresh.close();
    }
  });

  test("a completed boss offers one-way descent without a floor picker", async ({ page }) => {
    const map = productionHexLabyrinthMapFixture();
    const boss = map.nodes["labyrinth-floor-2-n11"]!;
    boss.cleared = true;
    map.currentNodeId = boss.id;
    await injectLabyrinthRun(page, { labyrinthMap: map });
    await expect(page.getByRole("status", { name: "Floor 2" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Floor" })).toHaveCount(0);
    await page.locator(`[data-labyrinth-node="${boss.id}"]`).click();
    await expect(page.getByText("Leave 11 unexplored chambers behind.")).toBeVisible();
    await page.getByRole("button", { name: "Descend", exact: true }).click();
    await expect(page.getByRole("status", { name: "Floor 3" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: chamberDetails })).toBeHidden();
    await expect(page.locator('[data-labyrinth-node^="labyrinth-floor-2-"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /chamber, reachable, enterable/ })).toHaveCount(1);
  });
});

for (const { width, height, gameSizePercent } of [
  { width: 1920, height: 1080, gameSizePercent: 100 },
  { width: 1280, height: 720, gameSizePercent: 80 },
  { width: 1280, height: 480, gameSizePercent: 120 },
  { width: 600, height: 900, gameSizePercent: 100 },
]) {
  test(`full floor and anchored details fit ${width}×${height} at Game Size ${gameSizePercent}`, async ({
    page,
    runtimeErrors,
  }) => {
    void runtimeErrors;
    await page.addInitScript((size) => {
      localStorage.setItem(
        "alchemy-device-display-v1",
        JSON.stringify({ version: 1, gameSizePercent: size, tooltipSizePercent: 100 }),
      );
    }, gameSizePercent);
    await page.setViewportSize({ width, height });
    const map = productionHexLabyrinthMapFixture();
    const target = map.nodes["labyrinth-floor-2-n0"]!;
    target.modifiers = ["jealous", "tempered", "rooted"];
    target.rewardModifiers = ["alchemist", "companion", "scavenger"];
    await injectLabyrinthRun(page, { labyrinthMap: map, runOverrides: { selectedAspectRatio: "auto" } });
    const viewport = page.getByTestId("labyrinth-viewport");
    const nodes = page.locator("[data-labyrinth-node]");
    await expect(nodes).toHaveCount(12);
    await nodes.first().hover();
    const bounds = (await viewport.boundingBox())!;
    const rectangles = await nodes.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().toJSON()),
    );
    for (const box of rectangles) {
      expect(box.x).toBeGreaterThanOrEqual(bounds.x);
      expect(box.y).toBeGreaterThanOrEqual(bounds.y);
      expect(box.right).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
      expect(box.bottom).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
    }
    const floorLabel = (await page.getByRole("status", { name: "Floor 2" }).boundingBox())!;
    const header = (await page.getByRole("heading", { name: "Labyrinth", exact: true }).boundingBox())!;
    expect(floorLabel.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(floorLabel.y + floorLabel.height).toBeLessThanOrEqual(bounds.y);
    expect(await viewport.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
    const borderInfo = await page
      .getByTestId("labyrinth-borders")
      .locator("path")
      .evaluateAll((paths) =>
        paths.map((path) => ({
          key: path.getAttribute("data-edge"),
          width: getComputedStyle(path).strokeWidth,
          scale: path.getAttribute("vector-effect"),
        })),
      );
    expect(new Set(borderInfo.map((edge) => edge.key)).size).toBe(borderInfo.length);
    expect(new Set(borderInfo.map((edge) => edge.width))).toEqual(new Set(["2px"]));
    expect(borderInfo.every((edge) => edge.scale === "non-scaling-stroke")).toBe(true);
    await expect(page.getByRole("button", { name: /Zoom|Fit floor/ })).toHaveCount(0);
    await expect(nodes.locator("span, svg")).toHaveCount(0);
    await nodes.first().click();
    const inspector = page.getByRole("complementary", { name: chamberDetails });
    await expect(inspector).toBeVisible();
    const panel = (await inspector.boundingBox())!;
    expect(panel.x).toBeGreaterThanOrEqual(bounds.x);
    expect(panel.y).toBeGreaterThanOrEqual(bounds.y);
    expect(panel.x + panel.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
    expect(panel.y + panel.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
    expect(panel.width).toBeGreaterThanOrEqual(Math.min(320, bounds.width - 16) - 1);
    await expect(page.getByRole("button", { name: "Fight", exact: true })).toBeInViewport();
    const art = page.getByTestId("chamber-art");
    const image = art.locator("img");
    await expect(image).toHaveJSProperty("complete", true);
    const imageRatio = await image.evaluate((element: HTMLImageElement) => ({
      natural: element.naturalWidth / element.naturalHeight,
      rendered: element.getBoundingClientRect().width / element.getBoundingClientRect().height,
    }));
    expect(imageRatio.rendered).toBeCloseTo(imageRatio.natural, 2);
    await expect(art.getByRole("heading", { name: "Goblin" })).toHaveCount(1);
    const information = art.locator("..");
    await information.hover();
    await page.mouse.wheel(0, 1500);
    await expect(page.getByRole("button", { name: "Fight", exact: true })).toBeInViewport();
    expect(
      await nodes.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON())),
    ).toEqual(rectangles);
    await page.keyboard.press("Escape");
    await expect(nodes.first()).toBeFocused();
  });
}

test.describe("Labyrinth touch", () => {
  test.use({ hasTouch: true });

  test("opens and dismisses anchored details without node overlays", async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    await page.setViewportSize({ width: 600, height: 900 });
    await injectLabyrinthRun(page, {
      labyrinthMap: productionHexLabyrinthMapFixture(),
      runOverrides: { selectedAspectRatio: "auto" },
    });
    const room = page.getByRole("button", { name: /chamber, reachable/ }).first();
    await room.tap();
    await expect(page.getByRole("complementary", { name: chamberDetails })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fight", exact: true })).toBeInViewport();
    await page.getByRole("heading", { name: "Labyrinth", exact: true }).tap();
    await expect(page.getByRole("complementary", { name: chamberDetails })).toBeHidden();
  });
});

motionTest("Labyrinth shine respects reduced motion without changing border geometry", async ({ page }) => {
  const errors = failOnRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await injectLabyrinthRun(page, { labyrinthMap: productionHexLabyrinthMapFixture() });
  const room = page.getByRole("button", { name: /chamber, reachable/ }).first();
  const before = await room.boundingBox();
  await room.click();
  await expect(page.getByRole("complementary", { name: chamberDetails })).toBeVisible();
  expect(await room.boundingBox()).toEqual(before);
  await expect(page.getByTestId("labyrinth-borders").locator("animate")).toHaveCount(0);
  expect(errors).toEqual([]);
});
