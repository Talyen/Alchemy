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
  withSavedGame,
  resumeInjectedRun,
} from "../../browser-helpers";

function wildwoodDraftDefaults(overrides: Record<string, unknown> = {}) {
  return {
    phase: "draft",
    draftChoices: [],
    remainingBossIds: [],
    previousBossId: null,
    currentBossId: null,
    currentCombatTraitIds: [],
    currentRewardTraitIds: [],
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
    await injectSaveState(page, {
      contentSystemType: "wildwood",
      selectedDifficulty: null,
      activity: savedActivityFixture("draft-deck"),
      runPlayerHealth: 30,
      runMaxHealth: 30,
      runDeck: draftedCards,
      wildwoodDraft: wildwoodDraftDefaults({ draftChoices: finalChoices }),
    });
    await page.goto("/");
    await resumeInjectedRun(page);
    await expect(page.getByRole("heading", { name: "Draft a Deck" })).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "View Deck · 5 cards", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("img", { name: "Slash", exact: true })).toHaveCount(5);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Select Block", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Draft Complete" })).toBeVisible();
    await page.getByRole("button", { name: "View Deck · 6 cards", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("img", { name: "Block", exact: true })).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    const battle = new BattlePage(page);
    await battle.waitForOpeningHand();
    await expect(battle.enemyHealthPanel).toBeVisible();
    await expect
      .poll(async () => (await readSavedGame(page)).activeRun?.wildwoodDraft)
      .toMatchObject({
        phase: "battle",
        currentCombatTraitIds: [expect.any(String)],
        currentRewardTraitIds: [expect.any(String)],
      });
    expect((await readSavedGame(page)).activeRun?.runDeck.map((card) => card.id)).toEqual([
      ...draftedCards.map((card) => card.id),
      "block",
    ]);
  });

  test(
    "victory keeps Health and reward choices through resume; Skip enters the next boss once",
    critical,
    async ({ page, fastBattle }) => {
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
          wildwoodDraft: wildwoodDraftDefaults({
            phase: "battle",
            currentBossId: "forge-golem",
            remainingBossIds: ["iron-bear"],
            draftChoices: [],
          }),
        },
      );
      const battle = new BattlePage(page);
      await battle.playFirstCard();
      await expect(battle.victoryHeading).toBeVisible();
      await expect.poll(async () => (await readSavedGame(page)).activeRun?.activity.kind).toBe("rewards");
      const won = (await readSavedGame(page)).activeRun!;
      expect(won.runPlayerHealth).toBe(10);
      const rewards = savedActivityData(won, "rewards");
      if (!rewards) throw new Error("Wildwood victory did not persist its reward offers");
      const offers = rewards.rewardType === "gear" ? rewards.gearChoices : rewards.choiceIds;
      expect(offers.length).toBeGreaterThan(0);

      await withSavedGame(page, async (resumed) => {
        await expect(resumed.getByRole("heading", { name: "Victory", exact: true })).toBeVisible();
        expect(savedActivityData((await readSavedGame(resumed)).activeRun, "rewards")).toEqual(rewards);
        await resumed.getByRole("button", { name: "Skip", exact: true }).click({ clickCount: 2, delay: 20 });
        await new BattlePage(resumed).waitForOpeningHand();
        await expect
          .poll(async () => (await readSavedGame(resumed)).activeRun?.wildwoodDraft?.currentBossId)
          .toBe("iron-bear");
        const next = (await readSavedGame(resumed)).activeRun!;
        expect(next.runPlayerHealth).toBe(10);
        expect(next.runDeck).toEqual(won.runDeck);
      });
    },
  );
});
