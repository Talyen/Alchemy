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
  test("resumes a persisted mid-draft run", critical, async ({ page, runtimeErrors }) => {
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

  test("drafts six cards and starts a modified boss battle", slow, async ({ page, fastBattle, runtimeErrors }) => {
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
    test.setTimeout(45000);
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
    slow,
    async ({ page, fastBattle, runtimeErrors }) => {
      test.setTimeout(45000);
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

      // Skip Rewards and start the next battle
      const skipBtn = page.getByRole("button", { name: "Skip" });
      await expect(async () => {
        await skipBtn.click();
        await expect(battle.hand.first()).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 10000 });
    },
  );
});

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
    wildwoodDraft: {
      version: 2,
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
    },
    ...overrides,
  };
}

async function wildwoodPickDraftCard(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { name: "Draft a Deck" })).toBeVisible({ timeout: 5000 });
  const confirm = page.getByRole("button", { name: "Select Card" });
  await expect(async () => {
    await page
      .getByRole("button", { name: /^Select (?!Card$).+/ })
      .first()
      .click({ force: true });
    await expect(confirm).toBeEnabled();
  }).toPass();
  await confirm.click();
  await expect(page.getByRole("heading", { name: "Draft Complete" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
}

const VALID_COMBAT_TRAITS = [
  "tempered",
  "plated",
  "reinforced",
  "braced",
  "septic",
  "caustic",
  "flesheater",
  "combustible",
  "chilling",
  "thorns",
  "zealot",
  "insatiable",
  "jealous",
  "concussive",
  "rooted",
  "overgrowth",
  "holy-retribution",
  "divine-aegis",
];

test.describe("Wildwood Traits", slow, () => {
  test.beforeEach(async ({ page }) => {
    await seedRandom(page, 42);
  });

  test("combat trait is applied to the enemy boss", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await injectSaveState(
      page,
      wildwoodBossState({
        wildwoodDraft: {
          version: 2,
          phase: "draft",
          draftChoices: [makeCard()],
          remainingBossIds: [],
          previousBossId: null,
          currentBossId: null,
          currentCombatTraitIds: ["reinforced"],
          currentRewardTraitIds: [],
          rewardType: null,
          rewardChoiceIds: [],
          selectedRewardId: null,
        },
      }),
    );
    await page.goto("/");
    await wildwoodPickDraftCard(page);

    const traits = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return save.activeRun?.wildwoodDraft?.currentCombatTraitIds ?? [];
    }, SAVE_KEY);
    expect(traits.length).toBe(1);
    expect(VALID_COMBAT_TRAITS).toContain(traits[0]);
  });

  test("reward trait data passes through the save system without corruption", async ({
    page,
    fastBattle,
    runtimeErrors,
  }) => {
    void fastBattle;
    void runtimeErrors;

    await injectSaveState(
      page,
      wildwoodBossState({
        wildwoodDraft: {
          version: 2,
          phase: "draft",
          draftChoices: [makeCard()],
          remainingBossIds: [],
          previousBossId: null,
          currentBossId: null,
          currentCombatTraitIds: ["thorns"],
          currentRewardTraitIds: ["alchemist"],
          rewardType: null,
          rewardChoiceIds: [],
          selectedRewardId: null,
        },
      }),
    );
    await page.goto("/");
    await wildwoodPickDraftCard(page);

    const saveState = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      const draft = save.activeRun?.wildwoodDraft;
      return {
        combatTraits: draft?.currentCombatTraitIds ?? [],
        rewardTraits: draft?.currentRewardTraitIds ?? [],
      };
    }, SAVE_KEY);
    expect(saveState.combatTraits.length).toBe(1);
    expect(VALID_COMBAT_TRAITS).toContain(saveState.combatTraits[0]);
    expect(saveState.rewardTraits.length).toBe(1);
    expect(["generous", "alchemist", "scavenger", "companion"]).toContain(saveState.rewardTraits[0]);
  });

  test("reloading mid-draft preserves combat trait assignment", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await injectSaveState(
      page,
      wildwoodBossState({
        wildwoodDraft: {
          version: 2,
          phase: "draft",
          draftChoices: [makeCard()],
          remainingBossIds: [],
          previousBossId: null,
          currentBossId: null,
          currentCombatTraitIds: ["zealot"],
          currentRewardTraitIds: [],
          rewardType: null,
          rewardChoiceIds: [],
          selectedRewardId: null,
        },
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
