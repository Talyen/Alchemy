// E2E tests for the resumable Wildwood Draft boss gauntlet.
import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { MenuPage } from "./pages/menu-page";
import { BattlePage } from "./pages/battle-page";
import { critical } from "./playwright-tags";
import { injectSaveState, makeCard, makeHighDamageCard, SAVE_KEY } from "./helpers";

async function pickDraftCard(page: import("@playwright/test").Page) {
  const confirm = page.getByRole("button", { name: "Select Card" });
  await expect(async () => {
    await page.getByRole("button", { name: /^Select (?!Card$).+/ }).first().click({ force: true });
    await expect(confirm).toBeEnabled();
  }).toPass();
  await confirm.click();
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
        version: 1,
        phase: "draft",
        draftChoices: choices,
        remainingBossIds: [],
        previousBossId: null,
        currentBossId: null,
        currentModifierId: null,
        rewardType: null,
        rewardChoiceIds: [],
        selectedRewardId: null,
      },
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Draft a Deck" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("2/6 selected")).toBeVisible();
  });

  test("drafts six cards and starts a modified boss battle", async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    const menu = new MenuPage(page);
    await menu.goToCharacterSelectUnlocked("wildwood");
    await menu.selectCharacterAndContinue("Knight");

    for (let round = 0; round < 6; round += 1) await pickDraftCard(page);
    await expect(page.getByRole("heading", { name: "Draft Complete" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    const battle = new BattlePage(page);
    await expect(battle.hand.first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Placeholder Wildwood modifier. No combat effect yet.")).toBeVisible();
  });

  test("recovers after victory, skips reward, and starts the next boss", async ({
    page,
    fastBattle,
    runtimeErrors,
  }) => {
    void fastBattle;
    void runtimeErrors;
    const bossKiller = makeHighDamageCard();
    await injectSaveState(page, {
      contentSystemType: "wildwood",
      selectedDifficulty: null,
      currentScreen: "draft-deck",
      runPlayerHealth: 10,
      runMaxHealth: 30,
      runDeck: Array.from({ length: 5 }, (_, index) => ({ ...bossKiller, id: `boss-killer-${index}` })),
      wildwoodDraft: {
        version: 1,
        phase: "draft",
        draftChoices: [{ ...bossKiller, id: "boss-killer-final" }],
        remainingBossIds: [],
        previousBossId: null,
        currentBossId: null,
        currentModifierId: null,
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
    await battle.winViaCombat(6);
    await expect(page.getByRole("heading", { name: "Victory" })).toBeVisible({ timeout: 5000 });
    await expect
      .poll(() =>
        page.evaluate((saveKey) => JSON.parse(localStorage.getItem(saveKey) ?? "{}").activeRun?.runPlayerHealth, SAVE_KEY),
      )
      .toBe(16);
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(battle.hand.first()).toBeVisible({ timeout: 5000 });
  });
});
