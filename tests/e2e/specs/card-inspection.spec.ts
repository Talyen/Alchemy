import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { critical, slow } from "../../playwright-tags";
import {
  injectActiveBattle,
  injectSaveState,
  makeCard,
  makeGoblinBattleState,
  seedRandom,
  startAtDestination,
  startBattleWithDeck,
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
  const draw = page.getByRole("button", { name: "Inspect Draw Pile · 1 cards" });
  await expect(draw).toHaveAttribute("aria-disabled", "false");
  await expect(page.getByTestId("draw-pile")).toHaveText("");
  await expect(page.getByTestId("discard-pile")).toHaveText("");
  await draw.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Draw Pile", exact: true })).toBeVisible();
  await expect(dialog.getByRole("img", { name: "Block", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close card inspection" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(draw).toBeFocused();
  await page.getByRole("button", { name: "View Deck · 4 cards" }).click();
  await expect(dialog.getByRole("heading", { name: "Deck", exact: true })).toBeVisible();
  await expect(dialog.getByRole("img")).toHaveCount(4);
  await expect(dialog.getByRole("img", { name: "Apple", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close card inspection" }).click();
  await expect(dialog).toHaveCount(0);
  const discardOpener = page.getByRole("button", { name: "Inspect Discard Pile · 1 cards" });
  await discardOpener.click();
  await expect(dialog.getByRole("heading", { name: "Discard Pile", exact: true })).toBeVisible();
  await expect(dialog.getByRole("img", { name: "Anvil", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(discardOpener).toBeFocused();
  expect(await battle.enemyHealth()).toBe(health);
  await battle.playCardNamed("Slash");
  const discard = page.getByRole("button", { name: "Inspect Discard Pile · 2 cards" });
  await expect(discard).toHaveAttribute("aria-disabled", "false");
  await discard.click();
  await expect(dialog.getByRole("img")).toHaveCount(2);
});

test("shows an empty draft and updates the viewer after each pick", critical, async ({ page, fastBattle }) => {
  void fastBattle;
  await injectSaveState(page, {
    contentSystemType: "wildwood",
    selectedDifficulty: null,
    currentScreen: "draft-deck",
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
  await page.getByRole("button", { name: "View Deck · 1 cards" }).click();
  await expect(page.getByRole("dialog").getByRole("img", { name: "Slash", exact: true })).toBeVisible();
});

test("keeps deck access on run screens and meta detours", async ({ page, fastBattle }) => {
  void fastBattle;
  await startAtDestination(
    page,
    { runDeck: Array.from({ length: 6 }, () => makeCard()) },
    { forceDestination: "Normal Combat" },
  );
  const icon = page.getByRole("button", { name: "View Deck · 6 cards" });
  await expect(icon).toBeVisible();
  await page.getByRole("button", { name: "Open game menu" }).click();
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  await icon.click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Deck", exact: true })).toBeVisible();
});

test("waits for real card animations and preserves pile transfer anchors", slow, async ({ page }) => {
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
  const drawPile = page.getByTestId("draw-pile");
  const before = await drawPile.boundingBox();
  const buttonBounds = await drawPile.getByRole("button").boundingBox();
  expect(buttonBounds).toEqual(before);
  await drawPile.getByRole("button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await drawPile.boundingBox()).toEqual(before);
  const battle = new BattlePage(page);
  await battle.playFirstCard();
  await expect(icon).toHaveAttribute("aria-disabled", "true");
  await expect(icon).toHaveAttribute("aria-disabled", "false", { timeout: 20_000 });
  await battle.endTurn();
  await expect(icon).toHaveAttribute("aria-disabled", "false", { timeout: 20_000 });
  await icon.click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
