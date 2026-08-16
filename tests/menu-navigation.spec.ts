import { expect } from "@playwright/test";
import {
  injectLabyrinthRun,
  injectSaveState,
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
    await injectSaveState(page, {
      currentScreen: "battle",
      activeCombat: {
        battleState: makeGoblinBattleState(),
        activeLabyrinthModifiers: [],
        activeLabyrinthRewardModifiers: [],
      },
    });
    await page.goto("/");
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

test.describe("Character Select", critical, () => {
  test("all characters are selectable and starting run is mapped to localStorage", async ({ page, fastBattle }) => {
    void fastBattle;
    const menu = new MenuPage(page);
    await menu.goToCharacterSelectUnlocked();
    await expect(page.getByRole("button", { name: "Select Knight" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Ranger" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Rogue" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Wizard" })).toBeVisible();

    await page.getByRole("button", { name: "Select Knight" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });

    await expect
      .poll(
        async () => {
          const saveStateJson = await page.evaluate((saveKey) => localStorage.getItem(saveKey), SAVE_KEY);
          if (!saveStateJson) return null;
          const save = JSON.parse(saveStateJson) as { activeRun?: { characterId?: string; runDeck?: unknown[] } };
          return save.activeRun?.characterId === "knight" && Array.isArray(save.activeRun?.runDeck)
            ? save.activeRun
            : null;
        },
        { timeout: 5000, message: "activeRun should persist knight characterId and runDeck after run start" },
      )
      .not.toBeNull();
  });

  test("screen menu returns to main menu", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goToCharacterSelect();
    await page.getByRole("button", { name: "Open character select menu" }).click();
    await page.getByRole("button", { name: "Main Menu" }).click();
    await menu.expectMainMenu();
  });
});

test.describe("Navigation", () => {
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

test.describe("Options Screen", () => {
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

    const musicSlider = page
      .locator("div")
      .filter({ hasText: /^Music Volume/ })
      .locator('input[type="range"]');
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

    const errors = failOnRuntimeErrors(page);
    await page.goto("/");

    await expect(page.getByText(loadingPhrase)).toBeVisible({ timeout: 5000 });
    await new MenuPage(page).expectMainMenu(15000);
    const logo = page.getByRole("img", { name: "Alchemy logo" }).first();
    await expect(logo).toHaveJSProperty("complete", true);
    expect(await logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });

  test("loading screen shows animated bar element", async ({ page }) => {
    await enableLoadingScreen(page);
    await page.goto("/");

    const bar = page.locator(".alchemy-startup-bar");
    await expect(bar).toBeVisible({ timeout: 5000 });
    await new MenuPage(page).expectMainMenu(15000);
  });
});

test.describe("Talents Screen", () => {
  test("shows talent overview grid and navigates to keyword tree and back", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta();
    await menu.openTalents();

    // Verify Overview screen header and cards
    await expect(page.getByRole("heading", { name: "Talents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Burn Talents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Physical Talents" })).toBeVisible();

    // Click Burn card to navigate to detail tree
    await page.getByRole("button", { name: "Select Burn Talents" }).click();
    await expect(page.getByRole("heading", { name: "Burn" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();

    // Click Back to return to overview
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Talents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Burn Talents" })).toBeVisible();
  });
});
