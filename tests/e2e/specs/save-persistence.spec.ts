import { resumeInjectedRun } from "../navigation";
import { savedActivityFixture } from "../../fixtures/run-activity";
import { expect, test } from "../../fixtures/e2e";
import { injectExactSave, readSavedGame, enterPrimaryRewardScreen, withSavedGame } from "../../browser-helpers";
import { DestinationPage } from "../../pages/destination-page";
import { RewardPage } from "../../pages/reward-page";
import { critical } from "../../playwright-tags";
import { currentSchemaCampaignSave } from "../../fixtures/current-saves";

test("current-format resume retains Health, Gold, and offered destinations", critical, async ({ page }) => {
  const save = currentSchemaCampaignSave();
  await injectExactSave(page, {
    ...save,
    activeRun: {
      ...(save.activeRun as unknown as Record<string, unknown>),
      activity: savedActivityFixture("destination", {
        kind: "destination",
        destinations: ["Campfire", "Mystery", "Card Shop"],
        selectedBossId: null,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      }),
    },
  });
  await page.goto("/");
  await resumeInjectedRun(page);
  await new DestinationPage(page).expectVisible();
  await expect.poll(async () => (await readSavedGame(page)).activeRun?.runPlayerHealth).toBe(18);
  await withSavedGame(page, async (resumed) => {
    await new DestinationPage(resumed).expectVisible();
    for (const name of ["Campfire", "Mystery", "Card Shop"]) {
      await expect(resumed.getByRole("button", { name, exact: true })).toBeVisible();
    }
    const restored = await readSavedGame(resumed);
    expect(restored.gold).toBe(42);
    expect(restored.activeRun?.runPlayerHealth).toBe(18);
    expect(restored.activeRun?.destinationIndexInAct).toBe(2);
  });
});

test(
  "a pending card reward can be resumed, claimed once, and resumed again",
  critical,
  async ({ page, fastBattle }) => {
    void fastBattle;
    await enterPrimaryRewardScreen(page, { rewardType: "card", choiceIds: ["slash", "bash"] });
    await expect.poll(async () => (await readSavedGame(page)).activeRun?.activity.kind).toBe("rewards");
    await withSavedGame(page, async (resumed) => {
      await new RewardPage(resumed).claimFirstReward();
      await new DestinationPage(resumed).expectVisible();
      await expect
        .poll(
          async () => (await readSavedGame(resumed)).activeRun?.runDeck.filter((card) => card.id === "slash").length,
        )
        .toBe(1);
      await withSavedGame(resumed, async (restored) => {
        await new DestinationPage(restored).expectVisible();
        await restored.getByRole("button", { name: "View Deck · 7 cards" }).click();
        await expect(restored.getByRole("dialog").getByRole("img", { name: "Slash", exact: true })).toBeVisible();
        expect((await readSavedGame(restored)).activeRun?.runDeck).toHaveLength(7);
      });
    });
  },
);
