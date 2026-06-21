// E2E tests for the resumable Wildwood Draft boss gauntlet.
import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { BattlePage } from "./pages/battle-page";
import { critical, prepush } from "./playwright-tags";
import { injectSaveState, makeCard, makeHighDamageCard, SAVE_KEY } from "./helpers";

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
  test("resumes a persisted mid-draft run", { ...critical, ...prepush }, async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    const drafted = makeCard({ id: "slash" });
    const choices = [makeCard({ id: "block" }), makeCard({ id: "bash" }), makeCard({ id: "anvil" })];
    await injectSaveState(page, {
      contentSystemType: "wildwood",
      selectedDifficulty: null,
      currentScreen: "draft-deck",
      runDeck: [drafted],
      wildwoodDraft: {
        version: 2,
        phase: "draft",
        draftChoices: choices,
        remainingBossIds: [],
        previousBossId: null,
        currentBossId: null,
        currentCombatTraitIds: [],
        currentRewardTraitIds: [],
        rewardType: null,
        rewardChoiceIds: [],
        selectedRewardId: null,
      },
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Draft a Deck" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("2/6 selected")).toBeVisible();
  });

  test("drafts six cards and starts a modified boss battle", critical, async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    const draftedCards = Array.from({ length: 5 }, () => makeCard());
    const finalChoices = [
      makeCard({ id: "block", title: "Block" }),
      makeCard({ id: "bash", title: "Bash" }),
      makeCard({ id: "anvil", title: "Anvil" }),
    ];
    await injectSaveState(page, {
      contentSystemType: "wildwood",
      selectedDifficulty: null,
      currentScreen: "draft-deck",
      runDeck: draftedCards,
      wildwoodDraft: {
        version: 2,
        phase: "draft",
        draftChoices: finalChoices,
        remainingBossIds: [],
        previousBossId: null,
        currentBossId: null,
        currentCombatTraitIds: [],
        currentRewardTraitIds: [],
        rewardType: null,
        rewardChoiceIds: [],
        selectedRewardId: null,
      },
    });
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
    void fastBattle;
    void runtimeErrors;
    const bossKiller = {
      ...makeHighDamageCard(),
      effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 500 }],
    };
    await injectSaveState(page, {
      contentSystemType: "wildwood",
      selectedDifficulty: null,
      currentScreen: "draft-deck",
      runPlayerHealth: 10,
      runMaxHealth: 30,
      runDeck: Array.from({ length: 5 }, (_, index) => ({ ...bossKiller, id: `boss-killer-${index}` })),
      wildwoodDraft: {
        version: 2,
        phase: "draft",
        draftChoices: [{ ...bossKiller, id: "boss-killer-final" }],
        remainingBossIds: [],
        previousBossId: null,
        currentBossId: null,
        currentCombatTraitIds: [],
        currentRewardTraitIds: [],
        rewardType: null,
        rewardChoiceIds: [],
        selectedRewardId: null,
      },
    });
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
    critical,
    async ({ page, fastBattle, runtimeErrors }) => {
      void fastBattle;
      void runtimeErrors;
      const bossKiller = {
        ...makeHighDamageCard(),
        effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 500 }],
      };
      await injectSaveState(page, {
        contentSystemType: "wildwood",
        selectedDifficulty: null,
        currentScreen: "draft-deck",
        runPlayerHealth: 10,
        runMaxHealth: 30,
        runDeck: Array.from({ length: 5 }, (_, index) => ({ ...bossKiller, id: `boss-killer-${index}` })),
        wildwoodDraft: {
          version: 2,
          phase: "draft",
          draftChoices: [{ ...bossKiller, id: "boss-killer-final" }],
          remainingBossIds: [],
          previousBossId: null,
          currentBossId: null,
          currentCombatTraitIds: [],
          currentRewardTraitIds: [],
          rewardType: null,
          rewardChoiceIds: [],
          selectedRewardId: null,
        },
      });
      await page.goto("/");

      await pickDraftCard(page);
      await expect(page.getByRole("heading", { name: "Draft Complete" })).toBeVisible();
      await page.getByRole("button", { name: "Continue" }).click();

      const battle = new BattlePage(page);
      await expect(battle.hand.first()).toBeVisible({ timeout: 5000 });
      await wildwoodWinCombat(page, battle);
      await expect(battle.victoryHeading).toBeVisible({ timeout: 15000 });

      await page.getByRole("button", { name: "Skip" }).click({ force: true });
      await expect(battle.hand.first()).toBeVisible({ timeout: 10000 });
    },
  );
});
