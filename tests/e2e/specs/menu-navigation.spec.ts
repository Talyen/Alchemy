import { exerciseControllerOptions } from "../controller-options";
import { controllerInput } from "../controller-input";
import { expect, test } from "../../fixtures/e2e";
import {
  injectLabyrinthRun,
  injectActiveBattle,
  makeCard,
  makeGoblinBattleState,
  SAVE_KEY,
  readSavedGame,
  withSavedGame,
  enableLoadingScreen,
  injectHomestead,
} from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { expectRunPhase } from "../../pages/game-stage";
import { MenuPage } from "../../pages/menu-page";
import { LOADING_WORDS } from "@/app/loading-words";
import { critical, slow } from "../../playwright-tags";

test.describe("Menu", () => {
  // The browser protects Continue and clearing the live adventure.

  test("Continue is the only play action until End Run clears the current adventure", critical, async ({ page }) => {
    await injectActiveBattle(page, makeGoblinBattleState());
    const battle = new BattlePage(page);
    await battle.menuBtn.click();
    const panel = page.getByTestId("game-menu");
    await expect(panel).toBeVisible();
    const triggerBounds = await battle.menuBtn.boundingBox();
    const menuBounds = await panel.boundingBox();
    expect(triggerBounds).not.toBeNull();
    expect(menuBounds).not.toBeNull();
    expect(Math.abs(menuBounds!.x + menuBounds!.width - triggerBounds!.x - triggerBounds!.width)).toBeLessThan(80);
    expect(menuBounds!.y).toBeGreaterThanOrEqual(triggerBounds!.y + triggerBounds!.height - 8);

    await page.getByRole("button", { name: "Main Menu" }).click();
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Play|New Run)$/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expectRunPhase(page, "battle");
    await new BattlePage(page).menuBtn.click();
    await page.getByRole("button", { name: "End Run", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Journey’s End" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Main Menu" }).click();
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").activeRun, SAVE_KEY))
      .toBeNull();
    await withSavedGame(page, async (reloaded) => {
      await expect(reloaded.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    });
  });

  test("Labyrinth resumes unchanged after menu and meta visits", async ({ page }) => {
    await injectLabyrinthRun(page, { deck: [makeCard()], runOverrides: { roomsEncountered: 3, runPlayerHealth: 17 } });
    await page.getByRole("button", { name: "Open game menu" }).click();
    await page.getByRole("button", { name: "Options", exact: true }).click();
    await page.getByRole("button", { name: "Open game menu" }).click();
    await page.getByRole("button", { name: "Main Menu" }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByLabel("Labyrinth map", { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate((key) => {
          const save = JSON.parse(localStorage.getItem(key) ?? "{}");
          return {
            rooms: save.activeRun?.roomsEncountered,
            health: save.activeRun?.runPlayerHealth,
            parked: save.parkedRuns,
          };
        }, SAVE_KEY),
      )
      .toEqual({ rooms: 3, health: 17, parked: undefined });
  });
});

test("closing the game menu blocks stray keyboard navigation", async ({ page }) => {
  const menu = new MenuPage(page);
  await menu.goto();
  await menu.openOptions();
  await page.getByRole("button", { name: "Open game menu" }).click();
  const panel = page.getByTestId("game-menu");
  await controllerInput(page).reach(panel.getByRole("button", { name: "Collection", exact: true }));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      Boolean(document.querySelector('[data-testid="game-menu"]')?.contains(document.activeElement)),
    ),
  ).toBe(false);
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Options", exact: true })).toBeVisible();
});

test.describe("Startup Loading Screen", slow, () => {
  const loadingPhrase = new RegExp(
    `^(${LOADING_WORDS.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\.\\.\\.$`,
  );

  test("loading screen appears and transitions to main menu", async ({ page }) => {
    await enableLoadingScreen(page);

    await page.goto("/");

    await expect(page.getByText(loadingPhrase)).toBeVisible({ timeout: 5000 });
    await new MenuPage(page).expectMainMenu(15000);
    const logo = page.getByRole("img", { name: "Alchemy logo" }).first();
    await expect(logo).toHaveJSProperty("complete", true);
    expect(await logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Progression Locks", () => {
  test(
    "clean save gates progression features and game-mode tiles while Armory stays open",
    critical,
    async ({ page }) => {
      await injectHomestead(page, { finishedRunCharacters: [] });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Talents" })).toHaveAttribute("aria-disabled", "true");
      await expect(page.getByRole("button", { name: "Homestead" })).toHaveAttribute("aria-disabled", "true");
      await expect(page.getByRole("button", { name: "Armory" })).toBeEnabled();

      const menu = new MenuPage(page);
      await menu.openGameModeSelect();
      await expect(page.getByRole("button", { name: "The Labyrinth (Locked)" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Wildwood Draft (Locked)" })).toBeVisible();
    },
  );
});

test("controller-equivalent options, select arrows and dialog focus", critical, async ({ page }) => {
  await page.goto("/");
  const volume = await exerciseControllerOptions(page);
  await expect.poll(async () => (await readSavedGame(page)).musicVolume).toBe(volume);
  await withSavedGame(page, async (resumed) => {
    await new MenuPage(resumed).openOptions();
    await resumed.getByRole("button", { name: "Sound", exact: true }).click();
    await expect(resumed.getByRole("slider", { name: "Music Volume", exact: true })).toHaveValue(String(volume));
  });
});

test("keeps an open game menu reachable after resizing the window", slow, async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await injectActiveBattle(page, makeGoblinBattleState());
  await page.getByRole("button", { name: "Open game menu", exact: true }).click();
  const panel = page.getByTestId("game-menu");
  await expect(panel).toBeVisible();
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 3440, height: 1440 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(panel).toBeInViewport({ ratio: 0.99 });
    await expect(panel.getByRole("button", { name: "Main Menu", exact: true })).toBeInViewport({ ratio: 0.99 });
    await expect(panel.getByRole("button", { name: "End Run", exact: true })).toBeInViewport({ ratio: 0.99 });
  }
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: "End Turn", exact: true })).toBeVisible();
});
