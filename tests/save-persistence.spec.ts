import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import {
  injectSaveState,
  injectDestinationAtIndex,
  resumeCampaignRun,
  SAVE_KEY,
  seedRandom,
  makeHighDamageCard,
  startAtDestination,
  startBattleWithDeck,
  enterPrimaryRewardScreen,
  ANVIL_CARD,
} from "./helpers";
import { injectMidCombatSave } from "./e2e/mid-combat-save";
import { BattlePage } from "./pages/battle-page";
import { DestinationPage } from "./pages/destination-page";
import { RewardPage } from "./pages/reward-page";
import { critical } from "./playwright-tags";
import { currentSchemaCampaignSave } from "./fixtures/legacy-saves";

function getSavedLastSavedAt(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate((saveKey) => {
    const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
    return typeof save.lastSavedAt === "number" ? save.lastSavedAt : 0;
  }, SAVE_KEY);
}

function getSavedBattleTurn(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate((saveKey) => {
    const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
    return save.activeRun?.activeCombat?.battleState?.turn ?? 0;
  }, SAVE_KEY);
}

function persistedPurseGold(save: { gold?: unknown; activeRun?: { runGold?: unknown } | null }): number {
  const runGold = typeof save.activeRun?.runGold === "number" ? save.activeRun.runGold : 0;
  const gold = typeof save.gold === "number" ? save.gold : 0;
  return runGold > 0 ? runGold : gold;
}

test.describe("Save Persistence & Resume", () => {
  test.beforeEach(async ({ runtimeErrors }) => {
    void runtimeErrors;
  });

  test("resume run restores exact state after reload", critical, async ({ page }) => {
    await seedRandom(page, 42);
    await injectSaveState(page, {
      characterId: "knight",
      runGold: 42,
      runPlayerHealth: 18,
      runMaxHealth: 30,
      roomsEncountered: 3,
      currentAct: 1,
      destinationIndexInAct: 2,
      completedDestinations: ["Normal Combat", "Normal Combat"],
    });
    await page.goto("/");

    const savedBefore = await page.evaluate((saveKey) => {
      const s = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return s.activeRun;
    }, SAVE_KEY);
    expect(savedBefore.runPlayerHealth).toBe(18);
    expect(savedBefore.runMaxHealth).toBe(30);
    expect(savedBefore.currentAct).toBe(1);
    expect(savedBefore.destinationIndexInAct).toBe(2);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });

    const savedAfter = await page.evaluate((saveKey) => {
      const s = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return s;
    }, SAVE_KEY);
    expect(persistedPurseGold(savedAfter)).toBe(42);
    expect(savedAfter.activeRun.runPlayerHealth).toBe(18);
  });

  test("resume restores saved destination choices", async ({ page }) => {
    await seedRandom(page, 42);
    await injectDestinationAtIndex(page, {
      destinations: ["Campfire", "Mystery", "Card Shop"],
      destinationIndexInAct: 1,
      roomsEncountered: 2,
      completedDestinations: ["Normal Combat"],
      runPlayerHealth: 22,
    });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Campfire" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mystery" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Card Shop" })).toBeVisible();
  });

  test("mid-battle reload returns to destination not battle", critical, async ({ page }) => {
    await seedRandom(page, 42);
    await injectSaveState(page, {
      runPlayerHealth: 22,
      runMaxHealth: 30,
      roomsEncountered: 2,
      destinationIndexInAct: 1,
      completedDestinations: ["Normal Combat"],
    });
    await page.goto("/");

    await resumeCampaignRun(page);

    await expect(page.locator('[aria-label^="Play "]')).toHaveCount(0);
  });

  test("reload restores an in-progress battle", critical, async ({ page }) => {
    await injectMidCombatSave(page);
    await page.goto("/");

    const battle = new BattlePage(page);
    await expect(battle.endTurnBtn).toBeVisible({ timeout: 10000 });
    await expect.poll(() => battle.playerHealth()).toBe(18);
    await expect.poll(() => battle.enemyHealth()).toBe(40);

    const turnBefore = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return save.activeRun?.activeCombat?.battleState?.turn ?? null;
    }, SAVE_KEY);
    expect(turnBefore).toBe(2);

    await expect(battle.endTurnBtn).toBeVisible({ timeout: 10000 });
    await expect.poll(() => battle.playerHealth()).toBe(18);
    await expect.poll(() => battle.enemyHealth()).toBe(40);

    const turnAfter = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return save.activeRun?.activeCombat?.battleState?.turn ?? null;
    }, SAVE_KEY);
    expect(turnAfter).toBe(2);
  });

  test(
    "reload from an enemy-resolution continuation resumes a playable battle",
    critical,
    async ({ page, runtimeErrors }) => {
      void runtimeErrors;
      await startBattleWithDeck(
        page,
        Array.from({ length: 6 }, () => makeHighDamageCard()),
      );

      const battle = new BattlePage(page);
      await expect(battle.endTurnBtn).toBeEnabled({ timeout: 5000 });
      await expect
        .poll(
          () =>
            page.evaluate((saveKey) => {
              const activeRun = JSON.parse(localStorage.getItem(saveKey) || "{}").activeRun;
              return activeRun?.activeCombat?.battleState?.turnPhase ?? null;
            }, SAVE_KEY),
          { timeout: 8000 },
        )
        .toBe("player");

      await page.evaluate((saveKey) => {
        const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
        const activeRun = save.activeRun;
        const activeCombat = activeRun?.activeCombat;
        if (!activeRun || !activeCombat) throw new Error("Expected an active combat save");
        const resultState = activeCombat.battleState;
        activeRun.currentScreen = "battle";
        activeRun.activeCombat = {
          ...activeCombat,
          battleState: { ...resultState, turnPhase: "enemy", hand: [] },
          pendingBattleTransition: {
            kind: "enemy-turn",
            resultState,
            playerTurnSkipped: false,
          },
        };
        localStorage.setItem(saveKey, JSON.stringify(save));
      }, SAVE_KEY);

      await expect(battle.endTurnBtn).toBeEnabled({ timeout: 10000 });
      await expect
        .poll(
          () =>
            page.evaluate((saveKey) => {
              const activeRun = JSON.parse(localStorage.getItem(saveKey) || "{}").activeRun;
              return {
                phase: activeRun?.activeCombat?.battleState?.turnPhase ?? null,
                hasPendingTransition: Boolean(activeRun?.activeCombat?.pendingBattleTransition),
              };
            }, SAVE_KEY),
          { timeout: 8000 },
        )
        .toEqual({ phase: "player", hasPendingTransition: false });
    },
  );

  test("resumes a run from a current-schema campaign fixture", async ({ page }) => {
    const legacySave = currentSchemaCampaignSave();
    await page.addInitScript(
      (data) => {
        try {
          localStorage.setItem(data.saveKey, JSON.stringify(data.save));
        } catch {}
      },
      { saveKey: SAVE_KEY, save: legacySave },
    );

    await page.goto("/");
    await resumeCampaignRun(page);

    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });

    const upgraded = await page.evaluate((saveKey) => {
      return JSON.parse(localStorage.getItem(saveKey) || "{}");
    }, SAVE_KEY);
    expect(upgraded.saveSchemaVersion).toBeDefined();
    expect(persistedPurseGold(upgraded)).toBe(42);
    expect(upgraded.activeRun.runPlayerHealth).toBe(18);
  });
});

test.describe("Autosave Cadence", () => {
  test("save is written after the first end turn in battle", critical, async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeHighDamageCard()),
    );

    const savedAtBefore = await getSavedLastSavedAt(page);
    const turnBefore = await getSavedBattleTurn(page);
    const battle = new BattlePage(page);
    await battle.endTurn();

    await expect.poll(() => getSavedBattleTurn(page)).toBeGreaterThan(turnBefore);
    await expect.poll(() => getSavedLastSavedAt(page)).toBeGreaterThan(savedAtBefore);
  });

  test("save is written after claiming a reward", async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    await enterPrimaryRewardScreen(page, { rewardType: "card", choiceIds: ["slash", "bash"] });

    const savedAtBeforeReward = await getSavedLastSavedAt(page);
    const reward = new RewardPage(page);
    await reward.selectFirstReward();
    await reward.addRewardBtn.click();
    await new DestinationPage(page).expectVisible();

    await expect.poll(() => getSavedLastSavedAt(page)).toBeGreaterThan(savedAtBeforeReward);
  });

  test("save persists across page navigation", critical, async ({ page }) => {
    test.setTimeout(30000);
    await startAtDestination(page, { runGold: 42, runPlayerHealth: 22 }, { forceDestination: "Campfire" });

    const goldBefore = await page.evaluate((saveKey) => {
      return JSON.parse(localStorage.getItem(saveKey) || "{}");
    }, SAVE_KEY);
    expect(persistedPurseGold(goldBefore)).toBe(42);

    await page.goto("/");
    await resumeCampaignRun(page);

    const goldAfter = await page.evaluate((saveKey) => {
      return JSON.parse(localStorage.getItem(saveKey) || "{}");
    }, SAVE_KEY);
    expect(persistedPurseGold(goldAfter)).toBe(42);
  });

  test("forge status persists across end turn", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await startBattleWithDeck(page, [ANVIL_CARD, ANVIL_CARD, ANVIL_CARD, ANVIL_CARD, ANVIL_CARD, ANVIL_CARD]);
    const battle = new BattlePage(page);

    await battle.playCardNamed("Anvil");
    await expect(page.getByRole("button", { name: "Forge 1" })).toBeVisible();

    await battle.endTurn();
    await expect(page.getByRole("button", { name: /Forge/ })).toHaveCount(1);
  });
});
