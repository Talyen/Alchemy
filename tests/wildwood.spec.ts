// E2E tests for the resumable Wildwood Draft boss gauntlet.
import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { BattlePage } from "./pages/battle-page";
import { critical, slow } from "./playwright-tags";
import { injectSaveState, makeCard, makeHighDamageCard, SAVE_KEY, seedRandom } from "./helpers";

async function pickDraftCard(page: import("@playwright/test").Page) {
  const confirm = page.getByRole("button", { name: "Select Card" });
  await expect(async () => {
    await page
      .getByRole("button", { name: /^Select (?!Card$).+/ })
      .first()
      .click({ force: true });
    await expect(confirm).toBeEnabled();
  }).toPass();
  await confirm.click();
}

/** Default resumable draft state with the shared inert fields; override draftChoices etc. */
function wildwoodDraftDefaults(overrides: Record<string, unknown> = {}) {
  return {
    version: 3,
    phase: "draft",
    draftChoices: [makeCard({ id: "boss-killer-final" })],
    remainingBossIds: [],
    previousBossId: null,
    currentBossId: null,
    currentCombatTraitIds: [],
    currentRewardTraitIds: [],
    rewardType: null,
    rewardChoiceIds: [],
    selectedRewardId: null,
    ...overrides,
  };
}

/** Full save-state for a mid-draft wildwood run; merge per-test overrides. */
function wildwoodBossState(overrides: Record<string, unknown> = {}) {
  return {
    contentSystemType: "wildwood",
    selectedDifficulty: null,
    currentScreen: "draft-deck",
    runPlayerHealth: 30,
    runMaxHealth: 30,
    runDeck: Array.from({ length: 5 }, (_, index) => ({
      ...makeCard({ id: `boss-killer-${index}` }),
      effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 500 }],
    })),
    wildwoodDraft: wildwoodDraftDefaults(),
    ...overrides,
  };
}

async function wildwoodWinCombat(page: import("@playwright/test").Page, battle: BattlePage, maxTurns = 6) {
  for (let turn = 0; turn < maxTurns; turn++) {
    if (await battle.isBattleOver()) break;
    await battle.playAllCards();
    if (await battle.isVictoryVisible()) break;
    if (
      await page
        .getByRole("heading", { name: "Wildwood Recovery" })
        .isVisible()
        .catch(() => false)
    )
      break;
    if (await battle.isBattleOver()) break;
    await battle.endTurn();
    if (await battle.isVictoryVisible()) break;
    if (
      await page
        .getByRole("heading", { name: "Wildwood Recovery" })
        .isVisible()
        .catch(() => false)
    )
      break;
  }
}

test.describe("Wildwood Draft", () => {
  test("drafts six cards and starts a modified boss battle", slow, async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    const draftedCards = Array.from({ length: 5 }, () => makeCard());
    const finalChoices = [
      makeCard({ id: "block", title: "Block" }),
      makeCard({ id: "bash", title: "Bash" }),
      makeCard({ id: "anvil", title: "Anvil" }),
    ];
    await injectSaveState(
      page,
      wildwoodBossState({
        runDeck: draftedCards,
        wildwoodDraft: wildwoodDraftDefaults({ draftChoices: finalChoices }),
      }),
    );
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Draft a Deck" })).toBeVisible({ timeout: 5000 });

    await pickDraftCard(page);
    await expect(page.getByRole("heading", { name: "Draft Complete" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    const battle = new BattlePage(page);
    await expect(battle.hand.first()).toBeVisible({ timeout: 5000 });
    await expect(battle.enemyHealthPanel).toBeVisible();
  });

  test("wildwood victory recovers health correctly", critical, async ({ page, fastBattle, runtimeErrors }) => {
    test.setTimeout(45000);
    void fastBattle;
    void runtimeErrors;
    const bossKiller = {
      ...makeHighDamageCard(),
      effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 500 }],
    };
    await injectSaveState(
      page,
      wildwoodBossState({
        runPlayerHealth: 10,
        runMaxHealth: 30,
        runDeck: Array.from({ length: 5 }, (_, index) => ({ ...bossKiller, id: `boss-killer-${index}` })),
        wildwoodDraft: wildwoodDraftDefaults({ draftChoices: [{ ...bossKiller, id: "boss-killer-final" }] }),
      }),
    );
    await page.goto("/");

    await pickDraftCard(page);
    await expect(page.getByRole("heading", { name: "Draft Complete" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    const battle = new BattlePage(page);
    await expect(battle.hand.first()).toBeVisible({ timeout: 5000 });
    await wildwoodWinCombat(page, battle);

    await expect(async () => {
      const hasVictory = await battle.isVictoryVisible();
      const hasRecovery = await page
        .getByRole("heading", { name: "Wildwood Recovery" })
        .isVisible()
        .catch(() => false);
      expect(hasVictory || hasRecovery).toBe(true);
    }).toPass({ timeout: 10000 });

    await expect
      .poll(() =>
        page.evaluate(
          (saveKey) => JSON.parse(localStorage.getItem(saveKey) ?? "{}").activeRun?.runPlayerHealth,
          SAVE_KEY,
        ),
      )
      .toBeGreaterThan(10);
  });

  test(
    "skips reward after wildwood victory and starts next boss",
    slow,
    async ({ page, fastBattle, runtimeErrors }) => {
      test.setTimeout(45000);
      void fastBattle;
      void runtimeErrors;
      const bossKiller = {
        ...makeHighDamageCard(),
        effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 500 }],
      };
      await injectSaveState(
        page,
        wildwoodBossState({
          runPlayerHealth: 10,
          runMaxHealth: 30,
          runDeck: Array.from({ length: 5 }, (_, index) => ({ ...bossKiller, id: `boss-killer-${index}` })),
          wildwoodDraft: wildwoodDraftDefaults({ draftChoices: [{ ...bossKiller, id: "boss-killer-final" }] }),
        }),
      );
      await page.goto("/");

      await pickDraftCard(page);
      await expect(page.getByRole("heading", { name: "Draft Complete" })).toBeVisible();
      await page.getByRole("button", { name: "Continue" }).click();

      const battle = new BattlePage(page);
      await expect(battle.hand.first()).toBeVisible({ timeout: 5000 });
      await wildwoodWinCombat(page, battle);
      await expect(battle.victoryHeading).toBeVisible({ timeout: 15000 });

      // Skip Rewards and start the next battle
      const skipBtn = page.getByRole("button", { name: "Skip" });
      await expect(async () => {
        await skipBtn.click();
        await expect(battle.hand.first()).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 10000 });
    },
  );
});

test.describe("Wildwood Traits", slow, () => {
  test.beforeEach(async ({ page }) => {
    await seedRandom(page, 42);
  });

  test("reloading mid-draft preserves combat trait assignment", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await injectSaveState(
      page,
      wildwoodBossState({
        wildwoodDraft: wildwoodDraftDefaults({ draftChoices: [makeCard()], currentCombatTraitIds: ["zealot"] }),
      }),
    );
    await page.goto("/");

    const traitsBefore = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return save.activeRun?.wildwoodDraft?.currentCombatTraitIds ?? [];
    }, SAVE_KEY);
    expect(traitsBefore).toContain("zealot");

    await page.reload();

    const traitsAfter = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return save.activeRun?.wildwoodDraft?.currentCombatTraitIds ?? [];
    }, SAVE_KEY);
    expect(traitsAfter).toContain("zealot");
  });
});
