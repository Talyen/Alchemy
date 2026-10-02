import { controllerInput } from "../controller-input";
import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { injectSaveState, makeStartingDeck, readSavedGame, withSavedGame } from "../../browser-helpers";
import { DestinationPage } from "../../pages/destination-page";
import { MysteryPage } from "../../pages/mystery-page";
import { CorruptionPage } from "../../pages/corruption-page";
import { critical } from "../../playwright-tags";

test(
  "a Mystery choice awards its XP once and survives returning to the route",
  critical,
  async ({ page, fastBattle }) => {
    void fastBattle;
    const choice = { label: "Take the Offering", effects: [{ kind: "gainXP", keyword: "holy", amount: 8 }] };
    await injectSaveState(page, {
      runDeck: makeStartingDeck(),
      selectedDifficulty: null,
      currentScreen: "mystery",
      interruptedFlow: { kind: "none" },
      lastOfferedDestinations: ["Mystery", "Campfire", "Normal Combat"],
      mysteryVisit: {
        event: {
          id: "ancient-altar",
          title: "Ancient Altar",
          art: "",
          narrative: "A weathered stone altar.",
          choices: [choice],
        },
        chosenChoice: null,
        cardChoices: null,
        grantedTrinketIds: [],
        grantedGear: [],
        chosenCardId: null,
      },
    });
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Take the Offering/ })).toBeVisible();
    const before = (await readSavedGame(page)).activeRun?.runTalentXP?.holy ?? 0;
    await page.getByRole("button", { name: /Take the Offering/ }).click({ clickCount: 2, delay: 20 });
    await expect.poll(async () => (await readSavedGame(page)).activeRun?.runTalentXP?.holy).toBe(before + 8);
    await new MysteryPage(page).continueBtn.click();
    await new DestinationPage(page).expectVisible();
    await withSavedGame(page, async (resumed) => {
      await new DestinationPage(resumed).expectVisible();
      expect((await readSavedGame(resumed)).activeRun?.runTalentXP?.holy).toBe(before + 8);
    });
  },
);

test.describe("Corruption Full Flow", () => {
  // Altar intro/leave and corrupted-in-deck membership live in
  // corruption.test.ts (engine) plus the result-flow wiring below.
  test("selecting a card and corrupting shows result view with continue", critical, async ({ page }) => {
    const corruption = new CorruptionPage(page);
    await corruption.open();

    const input = controllerInput(page);
    await input.activate(corruption.corruptBtn);
    await input.activate(corruption.cardGrid.getByRole("button", { name: /^Select / }).first());
    await input.activate(corruption.confirmCorruptBtn);

    await controllerInput(page).activate(corruption.continueBtn);
    await new DestinationPage(page).expectVisible();
    await expect
      .poll(async () => (await readSavedGame(page)).activeRun?.runDeck.filter((card) => card.corrupted).length)
      .toBe(1);
    await withSavedGame(page, async (resumed) => {
      await new DestinationPage(resumed).expectVisible();
      await resumed.getByRole("button", { name: "View Deck · 6 cards" }).click();
      await expect(resumed.getByRole("dialog").getByRole("img", { name: /^Corrupted / })).toHaveCount(1);
    });
  });
});
