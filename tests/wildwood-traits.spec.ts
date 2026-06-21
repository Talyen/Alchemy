import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { BattlePage } from "./pages/battle-page";
import { critical } from "./playwright-tags";
import { injectSaveState, makeCard, SAVE_KEY } from "./helpers";

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

test.describe("Wildwood Traits", critical, () => {
  test("combat trait is applied to the enemy boss", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await injectSaveState(page, wildwoodBossState({
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
    }));
    await page.goto("/");
    await wildwoodPickDraftCard(page);

    const battle = new BattlePage(page);
    const enemyHpBefore = await battle.enemyHealth();
    await battle.endTurn();
    await expect(async () => {
      expect(await battle.enemyHealth()).toBeLessThan(enemyHpBefore);
    }).toPass({ timeout: 5000 });
  });

  test("reward trait data passes through the save system without corruption", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await injectSaveState(page, wildwoodBossState({
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
    }));
    await page.goto("/");
    await wildwoodPickDraftCard(page);

    const traits = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return save.activeRun?.wildwoodDraft?.currentCombatTraitIds ?? [];
    }, SAVE_KEY);
    expect(traits).toContain("thorns");
  });

  test("reloading mid-draft preserves combat trait assignment", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await injectSaveState(page, wildwoodBossState({
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
    }));
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
