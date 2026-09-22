import { exerciseControllerOptions } from "../controller-options";
import { controllerInput } from "../controller-input";
import { expect, test } from "../../fixtures/e2e";
import {
  injectLabyrinthRun,
  injectActiveBattle,
  makeCard,
  makeGoblinBattleState,
  SAVE_KEY,
  startBattleWithDeck,
  enableLoadingScreen,
  failOnRuntimeErrors,
  injectHomestead,
} from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { expectRunPhase } from "../../pages/game-stage";
import { MenuPage } from "../../pages/menu-page";
import { LOADING_WORDS } from "@/app/loading-words";
import { critical, slow } from "../../playwright-tags";

test.describe("Menu", () => {
  test("main menu reports the meta run phase and shows all buttons", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.expectMainMenu();
    await expectRunPhase(page, "meta");
    await expect(menu.playBtn).toBeVisible();
    await expect(menu.collectionBtn).toBeVisible();
    await expect(menu.optionsBtn).toBeVisible();
    await expect(menu.talentsBtn).toBeVisible();
    await menu.openGameModeSelect();
    await expect(page.getByRole("button", { name: /The Campaign/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /The Labyrinth/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Wildwood Draft/ })).toBeVisible();
  });

  test("unspent talents and affordable homestead show gold shine borders on main menu", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta({
      talentXP: { dodge: 550 },
      unlockedTalents: {},
      materialInventory: { wood: 50, stone: 50, iron: 50, food: 50 },
    });
    await menu.expectMainMenu();
    const shineBorders = page.locator(".shine-border");
    await expect(shineBorders).toHaveCount(2);
    await expect(shineBorders.first()).not.toHaveAttribute("data-glow", "true");
  });

  test("Continue is the only play action until End Run clears the current adventure", critical, async ({ page }) => {
    await injectActiveBattle(page, makeGoblinBattleState());
    await new BattlePage(page).menuBtn.click();
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
    const reloaded = await page.context().newPage();
    const errors = failOnRuntimeErrors(reloaded);
    try {
      await reloaded.goto("/");
      await expect(reloaded.getByRole("button", { name: "Play", exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await reloaded.close();
    }
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

test.describe("Navigation", critical, () => {
  test("in-battle menu allows navigation to collection, options, and talents", async ({ page, fastBattle }) => {
    void fastBattle;
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    const battle = new BattlePage(page);

    await battle.menuBtn.click();

    const triggerBounds = await battle.menuBtn.boundingBox();
    const menuBounds = await page.getByTestId("game-menu").boundingBox();
    expect(triggerBounds).not.toBeNull();
    expect(menuBounds).not.toBeNull();
    expect(Math.abs(menuBounds!.x + menuBounds!.width - triggerBounds!.x - triggerBounds!.width)).toBeLessThan(80);
    expect(menuBounds!.y).toBeGreaterThanOrEqual(triggerBounds!.y + triggerBounds!.height - 8);

    await expect(page.getByRole("button", { name: "Main Menu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Collection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Options" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Talents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "End Turn" })).toBeVisible();
  });
});

test.describe("Options Screen", critical, () => {
  test("options tabs, clear-save dialog, and volume persistence", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.openOptions();

    await expect(page.getByLabel("Aspect Ratio")).toBeVisible();
    const heading = page.getByRole("heading", { name: "Options", exact: true });
    const headingBounds = await heading.boundingBox();
    expect(headingBounds).not.toBeNull();
    for (const [tab, label] of [
      ["Interface", "Game Size"],
      ["Sound", "Music Volume"],
      ["Gameplay", "Auto-End Turn"],
      ["Other", "Save Data"],
      ["Display", "Aspect Ratio"],
    ]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await expect(page.getByText(label, { exact: true })).toBeVisible();
      expect(await heading.boundingBox()).toEqual(headingBounds);
    }
    await page.getByRole("button", { name: "Sound" }).click();
    await expect(page.getByText("Music Volume")).toBeVisible();
    await expect(page.getByText("Sound Effects Volume")).toBeVisible();
    await page.getByRole("button", { name: "Other" }).click();
    await expect(page.getByText("Save Data", { exact: true })).toBeVisible();
    await expect(page.getByText("Clear Save Data", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Display" }).click();
    await expect(page.getByLabel("Aspect Ratio")).toBeVisible();

    await page.getByRole("button", { name: "Other" }).click();
    await page.getByRole("button", { name: "Clear Save Data" }).click();
    await expect(page.getByRole("heading", { name: "Clear Save Data" })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("dialog").getByRole("button", { name: "Clear Save Data" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Clear Save Data" })).toBeFocused();

    await page.getByRole("button", { name: "Sound" }).click();
    await expect(page.getByText("Music Volume")).toBeVisible();
    const musicSlider = page.getByLabel("Music Volume");
    await musicSlider.focus();
    await page.keyboard.press("ArrowLeft");
    await expect
      .poll(async () => {
        const save = await page.evaluate((saveKey) => {
          return JSON.parse(localStorage.getItem(saveKey) || "{}");
        }, SAVE_KEY);
        return save.musicVolume;
      })
      .toBeLessThan(50);
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

test.describe("Auto-End Turn", () => {
  test("auto-end turn toggle is accessible in gameplay tab", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.openOptions();

    const gameplayTab = page.getByRole("button", { name: "Gameplay" });
    await expect(gameplayTab).toBeVisible({ timeout: 5000 });
    await gameplayTab.click();
    await expect(page.getByText("Auto-End Turn")).toBeVisible({ timeout: 2000 });
  });
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
  test("clean save gates meta buttons and game-mode tiles", critical, async ({ page }) => {
    await injectHomestead(page, { finishedRunCharacters: [] });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Talents" })).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("button", { name: "Homestead" })).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("button", { name: "Armory" })).toHaveAttribute("aria-disabled", "true");

    const menu = new MenuPage(page);
    await menu.openGameModeSelect();
    await expect(page.getByRole("button", { name: "The Labyrinth (Locked)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Wildwood Draft (Locked)" })).toBeVisible();
  });

  test("finished Rogue and Ranger unlock Labyrinth and Wildwood tiles", async ({ page }) => {
    await injectHomestead(page, { finishedRunCharacters: ["rogue", "ranger"] });
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.openGameModeSelect();

    await expect(page.getByRole("button", { name: "The Labyrinth", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Wildwood Draft", exact: true })).toBeVisible();
  });
});

test("controller-equivalent options, select arrows and dialog focus", critical, async ({ page }) => {
  await page.goto("/");
  await exerciseControllerOptions(page);
});
