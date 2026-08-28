import { expect } from "@playwright/test";
import {
  injectLabyrinthRun,
  injectActiveBattle,
  makeCard,
  makeGoblinBattleState,
  SAVE_KEY,
  startBattleWithDeck,
  enableLoadingScreen,
  failOnRuntimeErrors,
} from "./helpers";
import { test } from "./fixtures/e2e";
import { BattlePage } from "./pages/battle-page";
import { MenuPage } from "./pages/menu-page";
import { LOADING_WORDS } from "@/app/loading-words";
import { critical, slow } from "./playwright-tags";

test.describe("Menu", critical, () => {
  test.beforeEach(async ({ runtimeErrors }) => {
    void runtimeErrors;
  });

  test("main menu reports the meta run phase and shows all buttons", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.expectMainMenu();
    await menu.stage.expectRunPhase("meta");
    await expect(menu.playBtn).toBeVisible();
    await expect(menu.collectionBtn).toBeVisible();
    await expect(menu.optionsBtn).toBeVisible();
    await expect(menu.talentsBtn).toBeVisible();
    await menu.openGameModeSelect();
    await expect(page.getByRole("button", { name: /The Campaign/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /The Labyrinth/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Wildwood Draft/ })).toBeVisible();
  });

  test("menu shows Resume Run when a campaign battle is active", async ({ page }) => {
    await injectActiveBattle(page, makeGoblinBattleState());
    const menu = new MenuPage(page);
    const battle = new BattlePage(page);
    await menu.stage.expectRunPhase("battle");
    await battle.menuBtn.click();
    await page.getByRole("button", { name: "Main Menu" }).click();
    await menu.openGameModeSelect();
    await expect(page.getByRole("button", { name: "Resume The Campaign" })).toBeVisible();
  });

  test("Labyrinth button shows Resume when a labyrinth run is active", async ({ page }) => {
    await injectLabyrinthRun(page, {
      deck: [makeCard()],
      discoveredCardIds: ["slash", "bash", "block"],
      runOverrides: { roomsEncountered: 1, destinationIndexInAct: 1 },
    });
    await page.getByLabel("Open labyrinth menu").click();
    await page.getByRole("button", { name: "Main Menu" }).click();
    const menu = new MenuPage(page);
    await menu.openGameModeSelect();
    await expect(page.getByRole("button", { name: "Resume The Labyrinth" })).toBeVisible();
  });
});

test.describe("Navigation", critical, () => {
  test("in-battle menu allows navigation to collection, options, and talents", async ({
    page,
    fastBattle,
    runtimeErrors,
  }) => {
    void fastBattle;
    void runtimeErrors;
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    const battle = new BattlePage(page);

    await battle.menuBtn.click();

    await expect(page.getByRole("button", { name: "Main Menu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Collection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Options" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Talents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "End Turn" })).toBeVisible();
  });
});

test.describe("Options Screen", critical, () => {
  test("all option tabs are accessible and show correct content", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.openOptions();

    await expect(page.getByLabel("Aspect Ratio")).toBeVisible();
    await page.getByRole("button", { name: "Sound" }).click();
    await expect(page.getByText("Music Volume")).toBeVisible();
    await expect(page.getByText("Sound Effects Volume")).toBeVisible();

    await page.getByRole("button", { name: "Other" }).click();
    await expect(page.getByText("Save Data", { exact: true })).toBeVisible();
    await expect(page.getByText("Clear Save Data", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Display" }).click();
    await expect(page.getByLabel("Aspect Ratio")).toBeVisible();
  });

  test("clear save data confirmation dialog can be cancelled", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.openOptions();
    await page.getByRole("button", { name: "Other" }).click();

    await page.getByRole("button", { name: "Clear Save Data" }).click();
    await expect(page.getByRole("heading", { name: "Clear Save Data" })).toBeVisible({ timeout: 3000 });

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Clear Save Data" })).toBeHidden();
  });

  test("volume modifications persist in localStorage", critical, async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.openOptions();

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

test.describe("Auto-End Turn", critical, () => {
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

    const errors = failOnRuntimeErrors(page);
    await page.goto("/");

    await expect(page.getByText(loadingPhrase)).toBeVisible({ timeout: 5000 });
    await new MenuPage(page).expectMainMenu(15000);
    const logo = page.getByRole("img", { name: "Alchemy logo" }).first();
    await expect(logo).toHaveJSProperty("complete", true);
    expect(await logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 15000 });
    expect(errors).toEqual([]);
  });
});

test.describe("Talents Screen", critical, () => {
  test("shows talent overview grid and navigates to keyword tree and back", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta();
    await menu.openTalents();

    await expect(page.getByRole("heading", { name: "Talents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Burn Talents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Physical Talents" })).toBeVisible();

    await page.getByRole("button", { name: "Select Burn Talents" }).click();
    await expect(page.getByRole("heading", { name: "Burn" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Talents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Burn Talents" })).toBeVisible();
  });
});
