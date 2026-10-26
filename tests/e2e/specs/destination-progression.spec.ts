import { savedActivityFixture } from "../../fixtures/run-activity";
import { controllerInput } from "../controller-input";
import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import {
  injectSaveState,
  makeStartingDeck,
  readSavedGame,
  withSavedGame,
  resumeInjectedRun,
  startAtDestination,
  makeCard,
  waitForLayoutSettled,
} from "../../browser-helpers";
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
      lastOfferedDestinations: ["Mystery", "Campfire", "Normal Combat"],
      activity: savedActivityFixture("mystery", {
        event: {
          id: "ancient-altar",
          title: "Ancient Altar",
          art: "",
          narrative: "A weathered stone altar.",
          choices: [choice],
        },
        chosenChoice: null,
        cardChoices: null,
        grantedGear: [],
        chosenCardId: null,
      }),
    });
    await page.goto("/");
    await resumeInjectedRun(page);
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

test("Corruption preserves the chosen card through resize and resume", critical, async ({ page }) => {
  await page.setViewportSize({ width: 1470, height: 956 });
  await startAtDestination(
    page,
    {
      runDeck: [
        makeCard({ id: "bash", uid: 102 }),
        ...Array.from({ length: 5 }, (_, index) => makeCard({ uid: 201 + index })),
      ],
    },
    { forceDestination: "Corruption" },
  );
  await page.getByRole("button", { name: "Corruption", exact: true }).click();
  const corruption = new CorruptionPage(page);
  const input = controllerInput(page);
  await input.activate(corruption.corruptBtn);
  const cards = corruption.cardGrid.getByRole("button", { name: /^Select / });
  await waitForLayoutSettled(page, cards);
  const capacity = await cards.count();
  await input.activate(page.getByRole("button", { name: "Select Bash", exact: true }));
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1470, height: 956 },
  ]) {
    await page.setViewportSize(viewport);
    await waitForLayoutSettled(page, cards);
    await expect(corruption.confirmCorruptBtn).toBeInViewport();
    await expect(corruption.confirmCorruptBtn).toBeEnabled();
  }
  await expect(cards).toHaveCount(capacity);
  await input.activate(corruption.confirmCorruptBtn);
  await input.activate(corruption.continueBtn);
  await new DestinationPage(page).expectVisible();
  await expect
    .poll(async () =>
      (await readSavedGame(page)).activeRun?.runDeck.filter((card) => card.corrupted).map((card) => card.uid),
    )
    .toEqual([102]);
  await withSavedGame(page, async (resumed) => {
    await new DestinationPage(resumed).expectVisible();
    const deck = (await readSavedGame(resumed)).activeRun!.runDeck;
    expect(deck).toHaveLength(6);
    expect(deck.filter((card) => card.corrupted).map((card) => card.uid)).toEqual([102]);
    await resumed.getByRole("button", { name: "View Deck · 6 cards" }).click();
    await expect(resumed.getByRole("dialog").getByRole("img", { name: /^Corrupted / })).toHaveCount(1);
  });
});
