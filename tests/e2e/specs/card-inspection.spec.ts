import { savedActivityFixture } from "../../fixtures/run-activity";
import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { critical, slow } from "../../playwright-tags";
import {
  injectActiveBattle,
  injectSaveState,
  makeCard,
  makeGoblinBattleState,
  seedRandom,
  startBattleWithDeck,
  waitForLayoutSettled,
} from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";

test("inspects the run deck and each battle pile without advancing combat", critical, async ({ page, fastBattle }) => {
  void fastBattle;
  const slash = makeCard({ uid: 101, cost: 1 });
  const block = makeCard({ id: "block", uid: 102 });
  const anvil = makeCard({ id: "anvil", uid: 103 });
  const apple = makeCard({ id: "apple", uid: 104, consume: true });
  await injectActiveBattle(
    page,
    makeGoblinBattleState({
      hand: [slash],
      deck: [block],
      discard: [anvil],
      exhausted: [apple],
    }),
    { runDeck: [slash, block, anvil, apple], runBoons: ["brass-censer"] },
  );
  const battle = new BattlePage(page);
  const health = await battle.enemyHealth();
  const boonsOpener = page.getByRole("button", { name: "Inspect Boons", exact: true });
  await boonsOpener.click();
  const boonsOverlay = page.getByTestId("battle-boon-inspect-overlay");
  await expect(boonsOverlay.getByRole("heading", { name: "Boons", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(boonsOverlay).toHaveCount(0);
  const icon = page.getByRole("button", { name: "View Deck · 4 cards" });
  await expect(page.getByTestId("draw-pile")).toHaveCount(1);
  await expect(page.getByTestId("discard-pile")).toHaveCount(1);
  await icon.click();
  const dialog = page.getByRole("dialog", { name: "Deck", exact: true });
  await expect(dialog.getByRole("img")).toHaveCount(4);
  await waitForLayoutSettled(page, dialog);
  await expect(dialog.getByRole("img", { name: "Apple", exact: true })).toBeVisible();
  const draw = dialog.getByRole("button", { name: "Draw · 1 cards", exact: true });
  const tabTop = (await draw.boundingBox())!.y;
  await expect(draw).toHaveText("Draw");
  await draw.focus();
  await page.keyboard.press("Enter");
  await expect(draw).toHaveAttribute("aria-pressed", "true");
  expect((await draw.boundingBox())!.y).toBeCloseTo(tabTop, 0);
  await expect(dialog.getByRole("img", { name: "Block", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Discard · 1 cards" }).click();
  await expect(dialog.getByRole("img", { name: "Anvil", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(icon).toBeFocused();
  for (const [pile, tab, image] of [
    ["draw", "Draw · 1 cards", "Block"],
    ["discard", "Discard · 1 cards", "Anvil"],
  ] as const) {
    const opener = page.getByTestId(`${pile}-pile`).getByRole("button");
    await opener.focus();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("button", { name: tab, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByRole("img", { name: image, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
  }
  expect(await battle.enemyHealth()).toBe(health);
  await battle.playCardNamed("Slash");
  await icon.click();
  await expect(dialog.getByRole("button", { name: "Deck · 4 cards" })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Discard · 2 cards" }).click();
  await expect(dialog.getByRole("img")).toHaveCount(2);
});

test("shows an empty draft and updates the viewer after each pick", async ({ page, fastBattle }) => {
  void fastBattle;
  await injectSaveState(page, {
    contentSystemType: "wildwood",
    selectedDifficulty: null,
    runDeck: [],
    wildwoodDraft: {
      phase: "draft",
      draftChoices: [makeCard()],
      remainingBossIds: [],
      previousBossId: null,
      currentBossId: null,
      currentCombatTraitIds: [],
      currentRewardTraitIds: [],
    },
    activity: savedActivityFixture("draft-deck"),
  });
  await page.goto("/");
  await page.getByRole("button", { name: "View Deck · 0 cards" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Deck", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("img", { name: "Empty Deck", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: /^Select / })
    .first()
    .click();
  await page.getByRole("button", { name: "View Deck · 1 card" }).click();
  await expect(page.getByRole("dialog").getByRole("img", { name: "Slash", exact: true })).toBeVisible();
});

test("waits for real card animations and keeps the hand dock fixed", slow, async ({ page }) => {
  test.setTimeout(60_000);

  await seedRandom(page, 42);
  await page.addInitScript(() => {
    const state = window as Window & { inspectionBlockedDuringDeal?: boolean };
    new MutationObserver(() => {
      const icon = document.querySelector('[aria-label^="View Deck"]');
      if (document.querySelector("[data-flying-card]") && icon?.getAttribute("aria-disabled") === "true") {
        state.inspectionBlockedDuringDeal = true;
      }
    }).observe(document, { childList: true, subtree: true, attributes: true });
  });
  await startBattleWithDeck(
    page,
    Array.from({ length: 8 }, () => makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] })),
  );
  const icon = page.getByRole("button", { name: /^View Deck/ });
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { inspectionBlockedDuringDeal?: boolean }).inspectionBlockedDuringDeal),
    )
    .toBe(true);
  await expect(icon).toHaveAttribute("aria-disabled", "false", { timeout: 20_000 });
  const dock = page.getByTestId("battle-hand");
  const before = await dock.boundingBox();
  await icon.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await dock.boundingBox()).toEqual(before);
  const battle = new BattlePage(page);
  await battle.playFirstCard();
  await expect(icon).toHaveAttribute("aria-disabled", "true");
  await expect(icon).toHaveAttribute("aria-disabled", "false", { timeout: 20_000 });
  await battle.endTurn();
  await expect(icon).toHaveAttribute("aria-disabled", "false", { timeout: 20_000 });
  await icon.click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
