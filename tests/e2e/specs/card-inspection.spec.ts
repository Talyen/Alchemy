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
} from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";

test("inspects each battle pile without advancing combat", critical, async ({ page, fastBattle }) => {
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
  await expect(page.getByRole("button", { name: /^View Deck/ })).toHaveCount(0);
  for (const [pile, title, image] of [
    ["draw", "Draw Pile", "Block"],
    ["discard", "Discard Pile", "Anvil"],
  ] as const) {
    const opener = page.getByTestId(`${pile}-pile`).getByRole("button");
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: title, exact: true });
    await expect(dialog.getByRole("img")).toHaveCount(1);
    await expect(dialog.getByRole("img", { name: image, exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: / · \d+ cards$/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  }
  expect(await battle.enemyHealth()).toBe(health);
  await battle.playCardNamed("Slash");
  await page.getByTestId("discard-pile").getByRole("button").click();
  await expect(page.getByRole("dialog", { name: "Discard Pile", exact: true }).getByRole("img")).toHaveCount(2);
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
  await expect(page.getByRole("dialog").getByRole("button", { name: / · \d+ cards$/ })).toHaveCount(0);
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
      const icon = document.querySelector('[data-testid="draw-pile"] button');
      if (document.querySelector("[data-flying-card]") && icon?.getAttribute("aria-disabled") === "true") {
        state.inspectionBlockedDuringDeal = true;
      }
    }).observe(document, { childList: true, subtree: true, attributes: true });
  });
  await startBattleWithDeck(
    page,
    Array.from({ length: 8 }, () => makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] })),
  );
  const icon = page.getByTestId("draw-pile").getByRole("button");
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
