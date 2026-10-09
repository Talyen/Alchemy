import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { expect, test, type ElectronApplication, type Page, type TestInfo } from "@playwright/test";
import { launchElectronApp, getElectronMainWindow, ELECTRON_TEST_BACKGROUND } from "./electron-helpers";
import {
  makeCard,
  makeGoblinBattleState,
  injectActiveBattle,
  injectSaveState,
  failOnRuntimeErrors,
} from "../browser-helpers";
import { savedActivityFixture, savedActivityData } from "../fixtures/run-activity";
import { BattlePage } from "../pages/battle-page";
import { controllerInput } from "../e2e/controller-input";
import { bodyGear, openArmory, selectArmorySlot, gearItemLocator, equipmentSlotLocator } from "../e2e/armory";
import { captureFailureContext } from "../e2e/startup-diagnostics";
import { ensureRunId } from "../../scripts/lib/verification/current-run.mjs";
import {
  buildFailureDiagnostic,
  writeFailureDiagnostic,
} from "../../scripts/lib/verification/playwright-diagnostics.mjs";
import type { SaveData } from "@/features/alchemy/shared/storage";

async function desktopJourney(
  info: TestInfo,
  run: (page: Page, app: ElectronApplication, errors: string[]) => Promise<void>,
) {
  const app = await launchElectronApp({ packagedRenderer: true });
  let page: Page | undefined;
  let errors: string[] = [];
  const startedAt = Date.now();
  try {
    page = await getElectronMainWindow(app);
    errors = failOnRuntimeErrors(page);
    await run(page, app, errors);
    expect(errors).toEqual([]);
  } catch (error) {
    if (!page) throw error;
    const logs = [...errors];
    const context = await captureFailureContext(page, (message) => logs.push(message));
    writeFailureDiagnostic(
      process.cwd(),
      buildFailureDiagnostic({
        runId: ensureRunId("electron-interaction"),
        rootDir: process.cwd(),
        title: info.titlePath.slice(1).join(" > "),
        file: info.file,
        line: info.line,
        project: "electron",
        status: "failed",
        duration: Date.now() - startedAt,
        url: page.url(),
        errorMessage: String(error),
        logs,
        ...context,
      }),
    );
    throw error;
  } finally {
    await app.close();
  }
}
function readSave(profile: string): SaveData | null {
  for (const filename of ["save-recovery.json", "save.json"]) {
    const file = path.join(profile, filename);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  return null;
}
async function seedDrawBattle(page: Page, count = 1) {
  const drawing = Array.from({ length: count }, () =>
    makeCard({ id: "slash", cost: 1, effects: [{ kind: "draw-cards", amount: 1 }] }),
  );
  const deck = Array.from({ length: 6 }, () =>
    makeCard({ id: "block", cost: 1, effects: [{ kind: "block", amount: 2 }] }),
  );
  const state = makeGoblinBattleState({ hand: drawing, deck, mana: count });
  state.currentEnemy = { ...state.currentEnemy, abilityIds: ["slash", "sunder", "burning-blade"] };
  await injectActiveBattle(page, state, { runDeck: [...drawing, ...deck] });
  return new BattlePage(page);
}

async function lastManaJourney(info: TestInfo, reducedMotion: boolean) {
  await desktopJourney(info, async (page, app) => {
    await page.emulateMedia({ reducedMotion: reducedMotion ? "reduce" : "no-preference" });
    const battle = await seedDrawBattle(page);
    await battle.playFirstCard();
    await expect.poll(() => battle.mana()).toBe(0);
    await expect(page.getByRole("button", { name: /^View Deck/ })).toHaveAttribute("aria-disabled", "false");
    const enemy = page.getByTestId("battle-enemy-art-panel");
    await enemy.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(enemy).toBeFocused();
    await controllerInput(page).activate(page.getByRole("button", { name: /^View Deck/ }));
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    const health = await battle.playerHealth();
    await controllerInput(page).activate(battle.endTurnBtn);
    await expect.poll(() => battle.playerHealth()).toBeLessThan(health);
    await expect(battle.hand.first()).toBeVisible();
    await expect(battle.endTurnBtn).toBeEnabled();
    const profile = await app.evaluate(({ app: host }) => host.getPath("userData"));
    await expect.poll(() => savedActivityData(readSave(profile)?.activeRun, "battle")?.battleState.turn).toBe(3);
  });
}

test(
  "last-Mana draw releases enemy/deck inspection and End Turn in Electron",
  { tag: "@interaction-canary" },
  async ({}, info) => {
    await lastManaJourney(info, false);
  },
);

test(
  "reduced-motion last-Mana draw releases inspection and End Turn in Electron",
  { tag: "@interaction-nightly" },
  async ({}, info) => {
    await lastManaJourney(info, true);
  },
);

test(
  "completed Campfire survives repeated activation and navigation in Electron",
  { tag: "@interaction-canary" },
  async ({}, info) => {
    await desktopJourney(info, async (page, app) => {
      await injectSaveState(page, {
        runDeck: [makeCard()],
        runPlayerHealth: 10,
        runMaxHealth: 30,
        activity: savedActivityFixture("campfire"),
      });
      await page.getByRole("button", { name: "Rest", exact: true }).click({ clickCount: 2 });
      await expect(page.getByRole("button", { name: "Rest", exact: true })).toHaveCount(0);
      const profile = await app.evaluate(({ app: host }) => host.getPath("userData"));
      await expect.poll(() => readSave(profile)?.activeRun?.runPlayerHealth).toBeGreaterThan(10);
      const restoredHealth = readSave(profile)?.activeRun?.runPlayerHealth;
      await controllerInput(page).activate(page.getByRole("button", { name: "Continue", exact: true }));
      await expect(page.getByRole("button", { name: "Continue", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Open game menu" }).click();
      await controllerInput(page).activate(page.getByRole("button", { name: "Options", exact: true }));
      await expect(page.getByRole("heading", { name: "Options", exact: true })).toBeVisible();
      await expect.poll(() => readSave(profile)?.activeRun?.runPlayerHealth).toBe(restoredHealth);
    });
  },
);

test(
  "overlapping draws and autoplay takeover make real turn progress",
  { tag: "@interaction-nightly" },
  async ({}, info) => {
    await desktopJourney(info, async (page) => {
      const battle = await seedDrawBattle(page, 2);
      await battle.playFirstCard();
      await battle.playFirstCard();
      await battle.autoplayToggle.click();
      await expect.poll(() => battle.mana()).toBeGreaterThan(0);
      await battle.autoplayToggle.click();
      await expect(page.getByRole("button", { name: /^View Deck/ })).toHaveAttribute("aria-disabled", "false");
      await battle.endTurn();
    });
  },
);

test(
  "Armory transfer interruption reveals the committed loadout and returns keyboard focus",
  { tag: "@interaction-nightly" },
  async ({}, info) => {
    await desktopJourney(info, async (page, app) => {
      await openArmory(page);
      await selectArmorySlot(page, "body");
      await gearItemLocator(page, "Leather Armor").getByRole("button", { name: "Leather Armor", exact: true }).click();
      await app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0]!;
        const [width, height] = window.getSize();
        window.setSize(width - 20, height - 20);
      });
      await expect(equipmentSlotLocator(page, "body").locator("img")).toHaveCount(1);
      await page.getByRole("button", { name: "Search inventory", exact: true }).click();
      await page.getByRole("searchbox", { name: "Search inventory" }).fill("unlikely match");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Search inventory", exact: true })).toBeFocused();
      const profile = await app.evaluate(({ app: host }) => host.getPath("userData"));
      await expect.poll(() => readSave(profile)?.gearLoadouts?.knight.body).toBe(bodyGear.instanceId);
      await equipmentSlotLocator(page, "body").click();
      await expect(gearItemLocator(page, "Leather Armor")).toBeVisible();
    });
  },
);

test(
  "native focus loss pauses playback and returning releases input after resize",
  { tag: "@interaction-nightly" },
  async ({}, info) => {
    // Background launches intentionally cannot exercise native foreground focus.
    // oxlint-disable-next-line playwright/no-skipped-test -- Hidden local windows cannot prove native foreground focus; CI runs visibly in its virtual display.
    test.skip(
      ELECTRON_TEST_BACKGROUND,
      "Native focus requires the CI virtual display or an explicitly requested foreground run",
    );
    await desktopJourney(info, async (page, app) => {
      const battle = await seedDrawBattle(page);
      await battle.playFirstCard();
      await battle.autoplayToggle.click();
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.blur());
      await expect(page.getByTestId("game-menu")).toBeVisible();
      await app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0]!;
        window.setFullScreen(true);
        window.focus();
      });
      await expect
        .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isFullScreen()))
        .toBe(true);
      await expect(page.getByTestId("game-menu")).toBeVisible();
      await expect(page.getByText("Saving…", { exact: true })).toHaveCount(0);
      const pausedMana = await battle.mana();
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(await battle.mana()).toBe(pausedMana);
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("game-menu")).toHaveCount(0);
      await battle.autoplayToggle.click();
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setFullScreen(false));
      await expect(page.getByRole("button", { name: /^View Deck/ })).toHaveAttribute("aria-disabled", "false");
      await battle.endTurn();
    });
  },
);

test(
  "desktop save write failure recovers without locking play and survives relaunch",
  { tag: "@interaction-nightly" },
  async () => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-electron-test-interaction-"));
    let app: ElectronApplication | undefined;
    try {
      app = await launchElectronApp({ packagedRenderer: true, profile });
      let page = await getElectronMainWindow(app);
      const errors = failOnRuntimeErrors(page);
      const battle = await seedDrawBattle(page);
      // Fault the isolated filesystem seam, preserving the acknowledged save.
      fs.mkdirSync(path.join(profile, "save.json.tmp"));
      fs.mkdirSync(path.join(profile, "save-recovery.json.tmp"));
      await battle.playFirstCard();
      await expect.poll(() => errors.length).toBe(2);
      expect(errors.splice(0)).toEqual([
        expect.stringMatching(/^\[storage\] Save data could not be written\s+Error: Failed to write desktop save file/),
        expect.stringMatching(
          /^\[storage\] Recovery save could not be written\s+Error: Failed to write desktop save file/,
        ),
      ]);
      fs.rmdirSync(path.join(profile, "save.json.tmp"));
      fs.rmdirSync(path.join(profile, "save-recovery.json.tmp"));
      await battle.endTurn();
      await expect.poll(() => savedActivityData(readSave(profile)?.activeRun, "battle")?.battleState.turn).toBe(3);
      const acknowledged = savedActivityData(readSave(profile)?.activeRun, "battle")!.battleState;
      expect(errors).toEqual([]);
      await app.close();
      app = undefined;
      app = await launchElectronApp({ packagedRenderer: true, profile });
      page = await getElectronMainWindow(app);
      const resumedErrors = failOnRuntimeErrors(page);
      const resumed = new BattlePage(page);
      await resumed.waitForOpeningHand();
      await expect.poll(() => resumed.playerHealth()).toBe(acknowledged.playerHealth);
      await expect.poll(() => resumed.enemyHealth()).toBe(acknowledged.enemyHealth);
      await expect(resumed.endTurnBtn).toBeEnabled();
      expect(resumedErrors).toEqual([]);
    } finally {
      await app?.close();
      fs.rmSync(profile, { recursive: true, force: true });
    }
  },
);
