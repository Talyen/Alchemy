import { controllerInput } from "../controller-input";
import { expect, test } from "../../fixtures/e2e";
import { gridLabyrinthMapFixture, twoFloorLabyrinthMapFixture } from "../../fixtures/labyrinth-map";
import { critical } from "../../playwright-tags";
import { injectLabyrinthRun, waitForLayoutSettled, withSavedGame } from "../../browser-helpers";
import { MenuPage } from "../../pages/menu-page";
import { CorruptionPage } from "../../pages/corruption-page";

const encounterTooltip = '[role="tooltip"][data-visible]';

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
    await page.getByRole("button", { name: "Entrance chamber, you are here", exact: true }).hover();
    await expect(page.locator(encounterTooltip)).toHaveCount(0);
    const hidden = page.getByRole("button", { name: /^Undiscovered chamber/ });
    expect(await hidden.count()).toBeGreaterThanOrEqual(15);
    await expect(hidden.first().locator("img")).toHaveAttribute("src", /labyrinth-shrouded-/);
    await expect(hidden.first()).toHaveText("");
    await hidden.first().hover();
    await controllerInput(page).reach(hidden.first());
    await controllerInput(page).press("confirm");
    await expect(page.locator(encounterTooltip)).toHaveCount(0);
    await controllerInput(page).activate(page.getByRole("button", { name: /^Boss chamber/ }));
    await expect(page.locator(encounterTooltip)).toBeVisible();
    await expect(page.getByRole("button", { name: "Fight", exact: true })).toHaveCount(0);
    await expect(page.getByText("Move to an adjacent chamber to enter.")).toHaveCount(0);
    await controllerInput(page).reach(
      page.getByRole("button", { name: "Entrance chamber, you are here", exact: true }),
    );
    await expect(page.locator(encounterTooltip)).toHaveCount(0);
  });

  test("completed branches remain accessible and discovery survives returning from another room", async ({ page }) => {
    const map = gridLabyrinthMapFixture();
    const target = map.nodes["labyrinth-floor-1-n0"]!;
    target.type = "rest";
    delete target.enemyId;
    await injectLabyrinthRun(page, { labyrinthMap: map });
    const room = page.locator(`[data-labyrinth-node="${target.id}"] button`);
    const diagonal = page.locator('[data-labyrinth-node="labyrinth-floor-1-n4"]');
    await expect(diagonal).toHaveAttribute("data-state", "undiscovered");
    await expect(diagonal.locator("img")).toHaveAttribute("src", /labyrinth-shrouded-/);
    await room.click();
    await expect(page.getByRole("heading", { name: "Campfire", exact: true, level: 1 })).toBeVisible();
    await page.getByRole("button", { name: /^Rest$/ }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(room).toHaveAttribute("aria-current", "location");
    await expect(room.locator("img")).toHaveAttribute("src", /knight(?:-[\w-]+)?\.webp/);
    await expect(room.locator("img")).not.toHaveClass(/grayscale/);
    await expect(page.getByRole("button", { name: /^Entrance chamber/ }).locator("img")).toHaveClass(/grayscale/);
    await expect(diagonal.locator("img:not([aria-hidden])")).not.toHaveAttribute("src", /labyrinth-shrouded-/);
    const entrance = page.getByRole("button", { name: /^Entrance chamber/ });
    await entrance.click();
    await entrance.hover();
    await expect(page.locator(encounterTooltip)).toContainText("Entrance");
    await expect(room).toHaveAttribute("aria-current", "location");
    const otherBranch = page.locator('[data-labyrinth-node="labyrinth-floor-1-n3"] button');
    await otherBranch.click();
    await expect(page.getByRole("heading", { name: "Campfire", exact: true, level: 1 })).toBeVisible();
    await page.getByRole("button", { name: /^Rest$/ }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(otherBranch).toHaveAttribute("aria-current", "location");
    await expect(diagonal.locator("img")).toHaveCount(1);
    await expect(page.locator('[data-labyrinth-node="labyrinth-floor-1-n1"]')).toHaveAttribute(
      "data-state",
      "reachable",
    );
    await withSavedGame(page, async (fresh) => {
      await expect(fresh.locator('[data-labyrinth-node="labyrinth-floor-1-n3"] button')).toHaveAttribute(
        "aria-current",
        "location",
        { timeout: 20000 },
      );
      await expect(fresh.locator('[data-labyrinth-node="labyrinth-floor-1-n4"] img')).toHaveCount(1);
      await expect(fresh.locator(`[data-labyrinth-node="${target.id}"]`)).toHaveAttribute("data-state", "cleared");
    });
  });

  test("leaving Corruption unfinished does not move the player or scout beyond it", async ({ page }) => {
    const map = gridLabyrinthMapFixture();
    const target = map.nodes["labyrinth-floor-1-n0"]!;
    target.type = "corruption";
    delete target.enemyId;
    await injectLabyrinthRun(page, { labyrinthMap: map });
    const room = page.locator(`[data-labyrinth-node="${target.id}"] button`);
    await room.click();
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
    await expect(page.getByRole("region", { name: "Labyrinth map" })).toHaveAttribute("aria-description", "Floor 2");
    await expect(page.locator('[data-labyrinth-node^="labyrinth-floor-1-"]')).toHaveCount(0);
    await expect(page.locator("[data-labyrinth-node]")).toHaveCount(20);
    await expect(page.getByRole("button", { name: "Entrance chamber, you are here", exact: true })).toHaveAttribute(
      "aria-current",
      "location",
    );
    await expect(page.locator(encounterTooltip)).toHaveCount(0);
  });
});

for (const { gameSizePercent, viewports } of [
  {
    gameSizePercent: 100,
    viewports: [
      { width: 1920, height: 1080 },
      { width: 600, height: 900 },
    ],
  },
  { gameSizePercent: 80, viewports: [{ width: 1280, height: 720 }] },
  { gameSizePercent: 120, viewports: [{ width: 1280, height: 480 }] },
]) {
  test(`full grid and tooltip fit viewport boundaries at Game Size ${gameSizePercent}`, async ({ page }) => {
    if (viewports.length > 1) test.setTimeout(60_000);
    await page.addInitScript((size) => {
      localStorage.setItem(
        "alchemy-device-display-v1",
        JSON.stringify({ version: 1, gameSizePercent: size, tooltipSizePercent: 100 }),
      );
    }, gameSizePercent);
    await page.setViewportSize(viewports[0]!);
    const map = twoFloorLabyrinthMapFixture();
    const target = map.nodes["labyrinth-floor-2-n0"]!;
    target.modifiers = ["jealous", "tempered", "rooted"];
    target.rewardModifiers = ["alchemist", "companion", "scavenger"];
    await injectLabyrinthRun(page, { labyrinthMap: map });
    const viewport = page.getByTestId("labyrinth-viewport");
    const nodes = page.locator("[data-labyrinth-node]");
    const room = page.locator(`[data-labyrinth-node="${target.id}"] button`);
    await expect(nodes).toHaveCount(20);
    for (const { width, height } of viewports) {
      await page.setViewportSize({ width, height });
      await waitForLayoutSettled(page, viewport);
      const bounds = (await viewport.boundingBox())!;
      await room.hover();
      const rectangles = await nodes.evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().toJSON()),
      );
      for (const box of rectangles) {
        expect(box.x).toBeGreaterThanOrEqual(bounds.x);
        expect(box.y).toBeGreaterThanOrEqual(bounds.y);
        expect(box.right).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
        expect(box.bottom).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
      }
      const header = (await page.getByRole("heading", { name: "Labyrinth", exact: true }).boundingBox())!;
      expect(header.y + header.height).toBeLessThanOrEqual(bounds.y);
      await expect(page.getByRole("status")).toHaveCount(0);
      expect(await viewport.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
      await expect(nodes.locator("button").filter({ hasText: /Combat|Campfire|Shop|Entrance/ })).toHaveCount(0);
      const tooltip = page.locator(encounterTooltip);
      await expect(tooltip).toBeVisible();
      const panel = (await tooltip.boundingBox())!;
      const stage = (await page.getByTestId("vr-stage").boundingBox())!;
      expect(panel.x).toBeGreaterThanOrEqual(stage.x);
      expect(panel.y).toBeGreaterThanOrEqual(stage.y);
      expect(panel.x + panel.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
      expect(panel.y + panel.height).toBeLessThanOrEqual(stage.y + stage.height + 1);
      await expect(tooltip).toContainText("Goblin");
      await expect(tooltip.locator('[data-trait="alchemist"]')).toBeVisible();
      await expect(tooltip.locator("img, button")).toHaveCount(0);
      if (height === 480) {
        await page.mouse.move(0, 0);
        await controllerInput(page).reach(room);
        await expect(tooltip).toBeVisible();
        await controllerInput(page).press("confirm");
        await expect(page.getByTestId("battle-hand")).toBeVisible();
      }
    }
  });
}

test.describe("Labyrinth touch", () => {
  test.use({ hasTouch: true });

  test("enters a room with one tap", async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    const map = gridLabyrinthMapFixture();
    map.nodes["labyrinth-floor-1-n0"]!.type = "rest";
    delete map.nodes["labyrinth-floor-1-n0"]!.enemyId;
    await injectLabyrinthRun(page, { labyrinthMap: map });
    await page.locator('[data-labyrinth-node="labyrinth-floor-1-n0"] button').tap();
    await expect(page.getByRole("heading", { name: "Campfire", exact: true, level: 1 })).toBeVisible();
    await expect(page.locator(encounterTooltip)).toHaveCount(0);
  });
});
