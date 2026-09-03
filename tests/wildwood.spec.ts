import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { BattlePage } from "./pages/battle-page";
import { critical, slow } from "./playwright-tags";
import { injectSaveState, makeCard, makeHighDamageCard, SAVE_KEY, seedRandom } from "./helpers";

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
    currentScreen: "draft-deck",
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
    currentScreen: "rewards",
    interruptedFlow: {
      kind: "primary-reward",
      pending: {
        rewardType: "card",
        choiceIds: ["slash", "bash", "block"],
        companionChoiceIds: [],
        selectedId: null,
        gold: 0,
        materials: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
        destinations: [],
        selectedBossId: null,
        lastVictoryEnemyType: "boss",
        lastVictoryContentSystem: "wildwood",
      },
    },
    runPlayerHealth: 10,
    runMaxHealth: 30,
    runDeck: Array.from({ length: 6 }, () => ({ ...bossKiller })),
    wildwoodDraft: wildwoodDraftDefaults({
      phase: "reward",
      draftChoices: [],
      remainingBossIds: ["iron-bear"],
      previousBossId: "forge-golem",
    }),
    ...overrides,
  };
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

  test(
    "wildwood victory skips recovery and keeps current health",
    critical,
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
          runDeck: Array.from({ length: 5 }, () => ({ ...bossKiller })),
          wildwoodDraft: wildwoodDraftDefaults({ draftChoices: [{ ...bossKiller }] }),
        }),
      );
      await page.goto("/");

      await pickDraftCard(page);
      await expect(page.getByRole("heading", { name: "Draft Complete" })).toBeVisible();
      await page.getByRole("button", { name: "Continue" }).click();

      const battle = new BattlePage(page);
      await expect(battle.hand.first()).toBeVisible({ timeout: 5000 });
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
          return typeof health === "number" && health > 0 && health < 30;
        })
        .toBe(true);
    },
  );

  test(
    "skips reward after wildwood victory and starts next boss",
    slow,
    async ({ page, fastBattle, runtimeErrors }) => {
      test.setTimeout(30000);
      void fastBattle;
      void runtimeErrors;
      await injectSaveState(page, wildwoodRewardFlow());
      await page.goto("/");

      await expect(page.getByRole("heading", { name: "Victory" })).toBeVisible({ timeout: 10000 });

      const skipBtn = page.getByRole("button", { name: "Skip" });
      await expect(skipBtn).toBeEnabled({ timeout: 5000 });
      await skipBtn.click();

      const battle = new BattlePage(page);
      await expect(battle.hand.first()).toBeVisible({ timeout: 10000 });
    },
  );

  test(
    "reloading a Wildwood reward save keeps interruptedFlow choices",
    critical,
    async ({ page, fastBattle, runtimeErrors }) => {
      void fastBattle;
      void runtimeErrors;
      await injectSaveState(page, wildwoodRewardFlow());
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Victory" })).toBeVisible({ timeout: 10000 });

      const choiceIdsBefore = await page.evaluate((saveKey) => {
        const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
        return save.activeRun?.interruptedFlow?.pending?.choiceIds ?? [];
      }, SAVE_KEY);
      expect(choiceIdsBefore).toEqual(["slash", "bash", "block"]);

      await page.reload();
      await expect(page.getByRole("heading", { name: "Victory" })).toBeVisible({ timeout: 10000 });

      const choiceIdsAfter = await page.evaluate((saveKey) => {
        const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
        return save.activeRun?.interruptedFlow?.pending?.choiceIds ?? [];
      }, SAVE_KEY);
      expect(choiceIdsAfter).toEqual(["slash", "bash", "block"]);
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
