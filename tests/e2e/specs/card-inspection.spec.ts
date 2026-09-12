import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { critical } from "../../playwright-tags";
import {
  injectActiveBattle,
  injectSaveState,
  makeCard,
  makeGoblinBattleState,
  startAtDestination,
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
  await expect(page.getByRole("dialog").getByText("Empty", { exact: true })).toBeVisible();
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

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`keeps inspection minimal and paginates at ${viewport.width}x${viewport.height}`, async ({
    page,
    fastBattle,
  }) => {
    void fastBattle;
    await page.setViewportSize(viewport);
    const cards = Array.from({ length: 40 }, (_, uid) => makeCard({ uid: uid + 1 }));
    await injectActiveBattle(page, makeGoblinBattleState({ hand: [cards[0]!], deck: cards.slice(1), discard: [] }), {
      runDeck: cards,
    });
    const icon = page.getByRole("button", { name: "View Deck · 40 cards" });
    await expect(icon).toHaveAttribute("aria-disabled", "false");
    await icon.hover();
    await expect(page.getByText("View Deck · 40 cards", { exact: true })).toHaveCount(0);
    await icon.focus();
    await expect(page.getByText("View Deck · 40 cards", { exact: true })).toHaveCount(0);
    await icon.click();
    const dialog = page.getByRole("dialog");
    const heading = dialog.getByRole("heading", { name: "Deck", exact: true });
    await expect(heading).toBeVisible();
    await expect(dialog.getByRole("group", { name: "Card collections" })).toHaveCount(0);
    await expect(dialog.getByText(/Your run’s deck|Shown alphabetically|No cards here/)).toHaveCount(0);
    const panelBounds = await dialog.boundingBox();
    const titleBounds = await heading.boundingBox();
    expect(panelBounds).not.toBeNull();
    expect(titleBounds).not.toBeNull();
    expect(Math.abs(titleBounds!.x + titleBounds!.width / 2 - panelBounds!.x - panelBounds!.width / 2)).toBeLessThan(1);
    await expect(dialog.getByRole("button", { name: "Next page" })).toBeVisible();
    await dialog.getByRole("button", { name: "Next page" }).click();
    await expect(dialog.getByRole("button", { name: "Previous page" })).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await icon.click();
    await expect(dialog.getByRole("button", { name: "Previous page" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "Inspect Discard Pile · 0 cards" }).click();
    await expect(dialog.getByRole("heading", { name: "Discard Pile", exact: true })).toBeVisible();
    const empty = dialog.getByText("Empty", { exact: true });
    await expect(empty).toBeVisible();
    const emptyBounds = await empty.boundingBox();
    const emptyPanelBounds = await dialog.boundingBox();
    expect(emptyBounds).not.toBeNull();
    expect(emptyPanelBounds).not.toBeNull();
    expect(emptyBounds!.height).toBeGreaterThan(titleBounds!.height * 3);
    expect(
      Math.abs(emptyBounds!.x + emptyBounds!.width / 2 - emptyPanelBounds!.x - emptyPanelBounds!.width / 2),
    ).toBeLessThan(1);
    expect(emptyPanelBounds!.x).toBeGreaterThanOrEqual(0);
    expect(emptyPanelBounds!.y).toBeGreaterThanOrEqual(0);
    expect(emptyPanelBounds!.x + emptyPanelBounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(emptyPanelBounds!.y + emptyPanelBounds!.height).toBeLessThanOrEqual(viewport.height);
    await expect(dialog.getByRole("button")).toHaveCount(1);
  });
}
