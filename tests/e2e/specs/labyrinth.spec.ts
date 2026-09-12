import { expect, test } from "../../fixtures/e2e";
import { gridLabyrinthMapFixture, twoFloorLabyrinthMapFixture } from "../../fixtures/labyrinth-map";
import { critical } from "../../playwright-tags";
import { failOnRuntimeErrors, injectLabyrinthRun } from "../../browser-helpers";
import { MenuPage } from "../../pages/menu-page";
import { CorruptionPage } from "../../pages/corruption-page";

const chamberDetails = "Chamber details";

test.describe("Labyrinth exploration", critical, () => {
  test("a new run opens twenty rooms, with hidden encounters and an inspectable distant boss", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goToCharacterSelectUnlocked("labyrinth");
    await menu.selectCharacterAndContinue("Knight");
    await expect(page.getByRole("region", { name: "Labyrinth map" })).toHaveAttribute("aria-description", "Floor 1");
    await expect(page.getByRole("status", { name: "Floor 1" })).toHaveCount(0);
    const nodes = page.locator("[data-labyrinth-node]");
    await expect(nodes).toHaveCount(20);
    await expect(page.getByRole("button", { name: "Entrance chamber, you are here", exact: true })).toHaveAttribute(
      "aria-current",
      "location",
    );
    const hidden = page.getByRole("button", { name: /^Undiscovered chamber/ });
    expect(await hidden.count()).toBeGreaterThanOrEqual(15);
    await expect(hidden.first().locator("img")).toHaveCount(0);
    await expect(hidden.first()).toHaveText("?");
    await hidden.first().hover();
    await hidden.first().focus();
    await hidden.first().press("Enter");
    await expect(page.getByRole("complementary", { name: chamberDetails })).toHaveCount(0);
    await page.getByRole("button", { name: /^Boss chamber/ }).click();
    await expect(page.getByRole("complementary", { name: chamberDetails })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fight", exact: true })).toHaveCount(0);
    await expect(page.getByText("Move to an adjacent chamber to enter.")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^Boss chamber/ })).toBeFocused();
  });

  test("completed branches remain accessible and discovery survives returning from another room", async ({ page }) => {
    const map = gridLabyrinthMapFixture();
    const target = map.nodes["labyrinth-floor-1-n0"]!;
    target.type = "rest";
    delete target.enemyId;
    await injectLabyrinthRun(page, { labyrinthMap: map });
    const room = page.locator(`[data-labyrinth-node="${target.id}"] button`);
    const diagonal = page.locator('[data-labyrinth-node="labyrinth-floor-1-n4"]');
    const layout = await page
      .locator("[data-labyrinth-node]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("style")));
    await expect(diagonal).toHaveAttribute("data-state", "undiscovered");
    await room.click();
    await page.getByRole("button", { name: "Rest", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Campfire", exact: true, level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Rest", exact: true }).click();
    await expect(room).toHaveAttribute("aria-current", "location");
    await expect(diagonal.locator("img")).toHaveCount(1);
    const entrance = page.getByRole("button", { name: /^Entrance chamber/ });
    await entrance.click();
    await expect(page.getByText("Floor 1", { exact: true })).toBeVisible();
    await expect(room).toHaveAttribute("aria-current", "location");
    await page.keyboard.press("Escape");
    const otherBranch = page.locator('[data-labyrinth-node="labyrinth-floor-1-n3"] button');
    await otherBranch.click();
    await page.getByRole("button", { name: "Rest", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Campfire", exact: true, level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Rest", exact: true }).click();
    await expect(otherBranch).toHaveAttribute("aria-current", "location");
    await expect(diagonal.locator("img")).toHaveCount(1);
    await expect(page.locator('[data-labyrinth-node="labyrinth-floor-1-n1"]')).toHaveAttribute(
      "data-state",
      "reachable",
    );
    expect(
      await page
        .locator("[data-labyrinth-node]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("style"))),
    ).toEqual(layout);
    const fresh = await page.context().newPage();
    const freshErrors = failOnRuntimeErrors(fresh);
    try {
      await fresh.goto("/");
      await expect(fresh.locator('[data-labyrinth-node="labyrinth-floor-1-n3"] button')).toHaveAttribute(
        "aria-current",
        "location",
        { timeout: 20000 },
      );
      await expect(fresh.locator('[data-labyrinth-node="labyrinth-floor-1-n4"] img')).toHaveCount(1);
      await expect(fresh.locator(`[data-labyrinth-node="${target.id}"]`)).toHaveAttribute("data-state", "cleared");
      expect(freshErrors).toEqual([]);
    } finally {
      await fresh.close();
    }
  });

  test("leaving Corruption unfinished does not move the player or scout beyond it", async ({ page }) => {
    const map = gridLabyrinthMapFixture();
    const target = map.nodes["labyrinth-floor-1-n0"]!;
    target.type = "corruption";
    delete target.enemyId;
    await injectLabyrinthRun(page, { labyrinthMap: map });
    const room = page.locator(`[data-labyrinth-node="${target.id}"] button`);
    await room.click();
    await page.getByRole("button", { name: "Enter", exact: true }).click();
    const corruption = new CorruptionPage(page);
    await expect(corruption.altarHeading).toBeVisible();
    await corruption.leaveBtn.click();
    await expect(page.locator(`[data-labyrinth-node="${map.currentNodeId}"] button`)).toHaveAttribute(
      "aria-current",
      "location",
    );
    await expect(page.locator('[data-labyrinth-node="labyrinth-floor-1-n4"]')).toHaveAttribute(
      "data-state",
      "undiscovered",
    );
    await expect(page.locator(`[data-labyrinth-node="${target.id}"]`)).toHaveAttribute("data-state", "reachable");
  });

  test("a completed boss offers descent without backtracking", async ({ page }) => {
    const map = gridLabyrinthMapFixture();
    for (const node of Object.values(map.nodes)) node.cleared = true;
    map.nodes["labyrinth-floor-1-n3"]!.cleared = false;
    await injectLabyrinthRun(page, { labyrinthMap: map });
    await page.locator('[data-labyrinth-node="labyrinth-floor-1-n14"] button').click();
    await expect(page.getByText("Leave 1 unexplored chamber behind.")).toBeVisible();
    await page.getByRole("button", { name: "Descend", exact: true }).click();
    await expect(page.getByRole("region", { name: "Labyrinth map" })).toHaveAttribute("aria-description", "Floor 2");
    await expect(page.locator('[data-labyrinth-node^="labyrinth-floor-1-"]')).toHaveCount(0);
    await expect(page.locator("[data-labyrinth-node]")).toHaveCount(20);
    await expect(page.getByRole("button", { name: "Entrance chamber, you are here", exact: true })).toHaveAttribute(
      "aria-current",
      "location",
    );
    await expect(page.getByRole("complementary", { name: chamberDetails })).toHaveCount(0);
  });
});

for (const { width, height, gameSizePercent } of [
  { width: 1920, height: 1080, gameSizePercent: 100 },
  { width: 1280, height: 720, gameSizePercent: 80 },
  { width: 1280, height: 480, gameSizePercent: 120 },
  { width: 600, height: 900, gameSizePercent: 100 },
]) {
  test(`full grid and overlay fit ${width}×${height} at Game Size ${gameSizePercent}`, async ({ page }) => {
    await page.addInitScript((size) => {
      localStorage.setItem(
        "alchemy-device-display-v1",
        JSON.stringify({ version: 1, gameSizePercent: size, tooltipSizePercent: 100 }),
      );
    }, gameSizePercent);
    await page.setViewportSize({ width, height });
    const map = twoFloorLabyrinthMapFixture();
    const target = map.nodes["labyrinth-floor-2-n0"]!;
    target.modifiers = ["jealous", "tempered", "rooted"];
    target.rewardModifiers = ["alchemist", "companion", "scavenger"];
    await injectLabyrinthRun(page, { labyrinthMap: map, runOverrides: { selectedAspectRatio: "auto" } });
    const viewport = page.getByTestId("labyrinth-viewport");
    const nodes = page.locator("[data-labyrinth-node]");
    const room = page.locator(`[data-labyrinth-node="${target.id}"] button`);
    await expect(nodes).toHaveCount(20);
    const bounds = (await viewport.boundingBox())!;
    const positions = await nodes.evaluateAll((elements) => elements.map((element) => element.getAttribute("style")));
    await room.hover();
    await expect(room.locator("..")).toHaveCSS("scale", "1.06");
    const rectangles = await nodes.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().toJSON()),
    );
    for (const box of rectangles) {
      expect(box.x).toBeGreaterThanOrEqual(bounds.x);
      expect(box.y).toBeGreaterThanOrEqual(bounds.y);
      expect(box.right).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
      expect(box.bottom).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
      expect(box.width / box.height).toBeCloseTo(4 / 3, 2);
    }
    const header = (await page.getByRole("heading", { name: "Labyrinth", exact: true }).boundingBox())!;
    expect(header.y + header.height).toBeLessThanOrEqual(bounds.y);
    await expect(page.getByRole("status")).toHaveCount(0);
    expect(await viewport.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
    await expect(nodes.locator("button").filter({ hasText: /Combat|Campfire|Shop|Entrance/ })).toHaveCount(0);
    await room.click();
    const inspector = page.getByRole("complementary", { name: chamberDetails });
    await expect(inspector).toBeVisible();
    const panel = (await inspector.boundingBox())!;
    expect(panel.x).toBeGreaterThanOrEqual(bounds.x);
    expect(panel.y).toBeGreaterThanOrEqual(bounds.y);
    expect(panel.x + panel.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
    expect(panel.y + panel.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
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
    await art.locator("..").hover();
    await page.mouse.wheel(0, 1500);
    await expect(page.getByRole("button", { name: "Fight", exact: true })).toBeInViewport();
    expect(await nodes.evaluateAll((elements) => elements.map((element) => element.getAttribute("style")))).toEqual(
      positions,
    );
    await page.keyboard.press("Escape");
    await expect(room).toBeFocused();
  });
}

test.describe("Labyrinth touch", () => {
  test.use({ hasTouch: true });

  test("opens and dismisses room details", async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await injectLabyrinthRun(page, {
      labyrinthMap: gridLabyrinthMapFixture(),
      runOverrides: { selectedAspectRatio: "auto" },
    });
    const room = page.getByRole("button", { name: /Combat chamber, reachable/ }).first();
    await room.tap();
    await expect(page.getByRole("complementary", { name: chamberDetails })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fight", exact: true })).toBeInViewport();
    await page.getByRole("heading", { name: "Labyrinth", exact: true }).tap();
    await expect(page.getByRole("complementary", { name: chamberDetails })).toBeHidden();
  });
});

test("node hover, focus and selection retain shared shine without moving neighboring rooms", async ({ page }) => {
  await injectLabyrinthRun(page, { labyrinthMap: gridLabyrinthMapFixture() });
  const room = page.locator('[data-labyrinth-node="labyrinth-floor-1-n0"] button');
  const neighbor = page.locator('[data-labyrinth-node="labyrinth-floor-1-n1"]');
  const neighborBefore = await neighbor.boundingBox();
  await room.hover();
  await expect(room.locator("..")).toHaveCSS("scale", "1.06");
  await expect(room.locator(".shine-border")).toBeVisible();
  expect(await neighbor.boundingBox()).toEqual(neighborBefore);
  await page.getByRole("heading", { name: "Labyrinth", exact: true }).hover();
  await expect(room.locator("..")).toHaveCSS("scale", "none");
  await room.focus();
  await expect(room.locator("..")).toHaveCSS("scale", "1.06");
  await room.press("Enter");
  await expect(page.getByRole("complementary", { name: chamberDetails })).toBeVisible();
  await expect(room.locator("..")).toHaveCSS("scale", "1.06");
  expect(await neighbor.boundingBox()).toEqual(neighborBefore);
});

test("current amber, dim room borders and the boss glow remain stable through hover", async ({ page }) => {
  await injectLabyrinthRun(page, { labyrinthMap: gridLabyrinthMapFixture() });
  const entrance = page.getByRole("button", { name: "Entrance chamber, you are here", exact: true });
  const room = page.locator('[data-labyrinth-node="labyrinth-floor-1-n0"] button');
  const hidden = page.getByRole("button", { name: /^Undiscovered chamber/ }).first();
  const boss = page.getByRole("button", { name: /^Boss chamber/ });
  await expect(page.getByTestId("labyrinth-location")).toHaveCount(0);
  await expect(entrance).toHaveClass(/border-primary/);
  const roomBorder = await room.evaluate((element) => getComputedStyle(element).borderColor);
  await expect(hidden).toHaveCSS("border-color", roomBorder);
  await expect(boss).toHaveCSS("border-color", roomBorder);
  const glow = await boss.evaluate((element) => getComputedStyle(element).boxShadow);
  expect(glow).not.toBe("none");
  await boss.hover();
  await expect(boss.locator(".shine-border")).toBeVisible();
  await expect(boss).toHaveCSS("box-shadow", glow);
  await page.getByRole("heading", { name: "Labyrinth", exact: true }).hover();
  await expect(boss.locator(".shine-border")).toHaveCount(0);
  await expect(boss).toHaveCSS("box-shadow", glow);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await room.hover();
  await expect(room.locator("..")).toHaveCSS("scale", "1.06");
  await expect(room.locator("..")).toHaveCSS("transition-property", "none");
  await expect(room.locator(".shine-border")).toHaveCSS("animation-name", "none");
});
