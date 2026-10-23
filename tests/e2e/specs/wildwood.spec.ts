import { savedActivityData, savedActivityFixture } from "../../fixtures/run-activity";
import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { BattlePage } from "../../pages/battle-page";
import { critical, slow } from "../../playwright-tags";
import {
  injectSaveState,
  injectActiveBattle,
  makeGoblinBattleState,
  makeCard,
  makeHighDamageCard,
  readSavedGame,
  SAVE_KEY,
  withSavedGame,
  resumeInjectedRun,
} from "../../browser-helpers";

async function pickDraftCard(page: import("@playwright/test").Page) {
  await page
    .getByRole("button", { name: /^Select / })
    .first()
    .click();
}

function wildwoodDraftDefaults(overrides: Record<string, unknown> = {}) {
  return {
    phase: "draft",
    draftChoices: [makeCard()],
    remainingBossIds: [],
    previousBossId: null,
    currentBossId: null,
    currentCombatTraitIds: [],
    currentRewardTraitIds: [],
    ...overrides,
  };
}

function wildwoodBossState(overrides: Record<string, unknown> = {}) {
  return {
    contentSystemType: "wildwood",
    selectedDifficulty: null,
    activity: savedActivityFixture("draft-deck"),
    runPlayerHealth: 30,
    runMaxHealth: 30,
    runDeck: Array.from({ length: 5 }, () => ({
      ...makeCard(),
      effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 500 }],
    })),
    wildwoodDraft: wildwoodDraftDefaults(),
    ...overrides,
  };
}

function wildwoodRewardFlow(overrides: Record<string, unknown> = {}) {
  const bossKiller = {
    ...makeHighDamageCard(),
    effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 500 }],
  };
  return {
    contentSystemType: "wildwood",
    selectedDifficulty: null,
    runPlayerHealth: 10,
    runMaxHealth: 30,
    runDeck: Array.from({ length: 6 }, () => ({ ...bossKiller })),
    wildwoodDraft: wildwoodDraftDefaults({
      phase: "reward",
      draftChoices: [],
      remainingBossIds: ["iron-bear"],
      previousBossId: "forge-golem",
    }),
    activity: savedActivityFixture("rewards", {
      rewardType: "card",
      choiceIds: ["slash", "bash", "block"],
      companionChoiceIds: [],
      selectedId: null,
      gold: 0,
      materials: { wood: 0, iron: 0, herbs: 0, food: 0, gems: 0 },
      destinations: [],
      selectedBossId: null,
      lastVictoryEnemyType: "boss",
      lastVictoryContentSystem: "wildwood",
    }),
    ...overrides,
  };
}

test.describe("Wildwood Draft", () => {
  test("drafts six cards and starts a modified boss battle", slow, async ({ page, fastBattle }) => {
    void fastBattle;
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
    await resumeInjectedRun(page);
    await expect(page.getByRole("heading", { name: "Draft a Deck" })).toBeVisible({ timeout: 5000 });

    await pickDraftCard(page);
    await expect(page.getByRole("heading", { name: "Draft Complete" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    const battle = new BattlePage(page);
    await expect(battle.hand.first()).toBeVisible({ timeout: 5000 });
    await expect(battle.enemyHealthPanel).toBeVisible();
  });

  test("wildwood victory skips recovery and keeps current health", critical, async ({ page, fastBattle }) => {
    test.setTimeout(45000);
    void fastBattle;
    const bossKiller = {
      ...makeHighDamageCard(),
      effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 500 }],
    };
    await injectActiveBattle(
      page,
      makeGoblinBattleState({
        currentEnemy: { id: "forge-golem" },
        hand: [bossKiller],
        enemyHealth: 1,
        enemyMaxHealth: 1,
        playerHealth: 10,
        playerMaxHealth: 30,
        contentSystemType: "wildwood",
      }),
      {
        contentSystemType: "wildwood",
        selectedDifficulty: null,
        runPlayerHealth: 10,
        runMaxHealth: 30,
        runDeck: Array.from({ length: 6 }, () => ({ ...bossKiller })),
        wildwoodDraft: wildwoodDraftDefaults({ phase: "battle", currentBossId: "forge-golem", draftChoices: [] }),
      },
    );
    const battle = new BattlePage(page);
    await battle.winViaCombat();

    await expect(async () => {
      const hasVictory = await battle.isVictoryVisible();
      const hasRewards = await page
        .getByRole("heading", { name: "Victory" })
        .isVisible()
        .catch(() => false);
      expect(hasVictory || hasRewards).toBe(true);
    }).toPass({ timeout: 10000 });

    await expect
      .poll(async () => {
        const health = await page.evaluate(
          (saveKey) => JSON.parse(localStorage.getItem(saveKey) ?? "{}").activeRun?.runPlayerHealth,
          SAVE_KEY,
        );
        return health === 10;
      })
      .toBe(true);
  });

  test(
    "Wildwood reward choices survive resume and Skip starts the next boss",
    critical,
    async ({ page, fastBattle }) => {
      void fastBattle;
      await injectSaveState(page, wildwoodRewardFlow());
      await page.goto("/");
      await resumeInjectedRun(page);
      await expect(page.getByRole("heading", { name: "Victory" })).toBeVisible({ timeout: 10000 });

      const rewardsBefore = savedActivityData((await readSavedGame(page)).activeRun, "rewards");
      const choiceIdsBefore = rewardsBefore?.rewardType === "card" ? rewardsBefore.choiceIds : [];
      expect(choiceIdsBefore).toEqual(["slash", "bash", "block"]);

      await withSavedGame(page, async (resumed) => {
        await expect(resumed.getByRole("heading", { name: "Victory" })).toBeVisible({ timeout: 10000 });

        const rewardsAfter = savedActivityData((await readSavedGame(resumed)).activeRun, "rewards");
        const choiceIdsAfter = rewardsAfter?.rewardType === "card" ? rewardsAfter.choiceIds : [];
        expect(choiceIdsAfter).toEqual(["slash", "bash", "block"]);
        await resumed.getByRole("button", { name: "Skip", exact: true }).click();
        await new BattlePage(resumed).waitForOpeningHand();
      });
    },
  );
});
