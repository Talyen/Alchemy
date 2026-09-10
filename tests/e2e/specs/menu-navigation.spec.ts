import { expect, test as animationTest } from "@playwright/test";
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
} from "../../helpers";
import { test } from "../../fixtures/e2e";
import { BattlePage } from "../../pages/battle-page";
import { expectRunPhase } from "../../pages/game-stage";
import { MenuPage } from "../../pages/menu-page";
import { LOADING_WORDS } from "@/app/loading-words";
import { critical, slow } from "../../playwright-tags";

test.describe("Menu", critical, () => {
  test.beforeEach(async ({ runtimeErrors }) => {
    void runtimeErrors;
  });

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

  test("menu shows Resume Run when a campaign battle is active", async ({ page }) => {
    await injectActiveBattle(page, makeGoblinBattleState());
    const menu = new MenuPage(page);
    const battle = new BattlePage(page);
    await expectRunPhase(page, "battle");
    await battle.menuBtn.click();
    await page.getByRole("button", { name: "Main Menu" }).click();
    await menu.openGameModeSelect();
    await expect(page.getByRole("button", { name: "Resume The Campaign" })).toBeVisible();
  });

  test("Labyrinth resumes after backing out of Campaign setup through either resume control", async ({ page }) => {
    await injectLabyrinthRun(page, {
      deck: [makeCard()],
      discoveredCardIds: ["slash", "bash", "block"],
      runOverrides: { roomsEncountered: 1, destinationIndexInAct: 1 },
    });
    const menu = new MenuPage(page);
    for (const control of ["mode", "menu"]) {
      await page.getByRole("button", { name: "Open game menu" }).click();
      await page.getByRole("button", { name: "Main Menu" }).click();
      await menu.openGameModeSelect();
      await page.getByRole("button", { name: "The Campaign", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("heading", { name: "Choose a Path" })).toBeVisible();
      if (control === "mode") {
        await page.getByRole("button", { name: "Resume The Labyrinth" }).click();
      } else {
        await page.getByRole("button", { name: "Open game menu" }).click();
        await page.getByRole("button", { name: "Return to Run" }).click();
      }
      await expect(page.getByLabel("Labyrinth map", { exact: true })).toBeVisible();
    }
  });

  test("Campaign combat and Labyrinth progress both survive a reload and mode switching", async ({
    page,
    fastBattle,
    runtimeErrors,
  }) => {
    void fastBattle;
    void runtimeErrors;
    await injectLabyrinthRun(page, {
      deck: [makeCard()],
      runOverrides: { roomsEncountered: 3, runPlayerHealth: 17 },
    });
    await page.getByRole("button", { name: "Open game menu" }).click();
    await page.getByRole("button", { name: "Main Menu" }).click();
    const menu = new MenuPage(page);
    await menu.openGameModeSelect();
    await page.getByRole("button", { name: "The Campaign", exact: true }).click();
    await menu.selectCharacterAndContinue();
    await expectRunPhase(page, "battle");
    await expect
      .poll(() =>
        page.evaluate((key) => {
          const save = JSON.parse(localStorage.getItem(key) ?? "{}");
          return {
            active: save.activeRun?.contentSystemType,
            combat: save.activeRun?.activeCombat?.battleState.turnPhase,
            labyrinthHealth: save.parkedRuns?.labyrinth?.runPlayerHealth,
            labyrinthRooms: save.parkedRuns?.labyrinth?.roomsEncountered,
          };
        }, SAVE_KEY),
      )
      .toEqual({ active: "campaign", combat: "player", labyrinthHealth: 17, labyrinthRooms: 3 });

    const reloaded = await page.context().newPage();
    const errors = failOnRuntimeErrors(reloaded);
    try {
      await reloaded.goto("/");
      await expectRunPhase(reloaded, "battle");
      await new BattlePage(reloaded).menuBtn.click();
      await reloaded.getByRole("button", { name: "Main Menu" }).click();
      await new MenuPage(reloaded).openGameModeSelect();
      await expect(reloaded.getByText("Resume The Campaign", { exact: true })).toBeVisible();
      await expect(reloaded.getByText("Resume The Labyrinth", { exact: true })).toBeVisible();
      await reloaded.getByRole("button", { name: "Resume The Labyrinth" }).click();
      await expect(reloaded.getByLabel("Labyrinth map", { exact: true })).toBeVisible();
      await reloaded.getByRole("button", { name: "Open game menu" }).click();
      await reloaded.getByRole("button", { name: "Main Menu" }).click();
      await new MenuPage(reloaded).openGameModeSelect();
      await reloaded.getByRole("button", { name: "Resume The Campaign" }).click();
      await expectRunPhase(reloaded, "battle");
      expect(errors).toEqual([]);
    } finally {
      await reloaded.close();
    }
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

animationTest("closing the game menu prevents keyboard navigation during its fade", async ({ page }) => {
  const errors = failOnRuntimeErrors(page);
  const menu = new MenuPage(page);
  await menu.goto();
  await menu.openOptions();
  await page.getByRole("button", { name: "Open game menu" }).click();
  const panel = page.getByTestId("game-menu");
  await panel.getByRole("button", { name: "Collection", exact: true }).focus();
  await page.evaluate(() => {
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Enter") return;
        const menuPanel = document.querySelector('[data-testid="game-menu"]');
        document.body.dataset.menuExitAtEnter = String(Boolean(menuPanel?.closest("[inert]")));
      },
      { capture: true },
    );
  });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await expect(page.locator("body")).toHaveAttribute("data-menu-exit-at-enter", "true");
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      Boolean(document.querySelector('[data-testid="game-menu"]')?.contains(document.activeElement)),
    ),
  ).toBe(false);
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Options", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
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

test.describe("Progression Locks", critical, () => {
  test("clean save gates meta buttons and game-mode tiles", async ({ page }) => {
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
