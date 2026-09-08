import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { critical } from "../../playwright-tags";
import {
  injectActiveBattle,
  injectSaveState,
  makeCard,
  makeGoblinBattleState,
  startAtDestination,
} from "../../helpers";
import { BattlePage } from "../../pages/battle-page";

test(
  "inspects the run deck and each battle pile without advancing combat",
  critical,
  async ({ page, fastBattle, runtimeErrors }, testInfo) => {
    void fastBattle;
    void runtimeErrors;
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
      { runDeck: [slash, block, anvil, apple] },
    );
    const battle = new BattlePage(page);
    const health = await battle.enemyHealth();
    const draw = page.getByRole("button", { name: "Inspect Draw Pile · 1 cards" });
    await expect(draw).toHaveAttribute("aria-disabled", "false");
    await expect(page.getByTestId("draw-pile")).toContainText("1");
    await draw.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Draw Pile · 1 cards" })).toBeVisible();
    await expect(dialog.getByRole("img", { name: "Block", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close card inspection" })).toBeFocused();
    await dialog.getByRole("button", { name: "Deck · 4", exact: true }).click();
    await expect(dialog.getByRole("img")).toHaveCount(4);
    await expect(dialog.getByRole("img", { name: "Apple", exact: true })).toBeVisible();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: testInfo.outputPath("deck-inspection.png") });
    await dialog.getByRole("button", { name: "Discard Pile · 1", exact: true }).click();
    await expect(dialog.getByRole("img", { name: "Anvil", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(draw).toBeFocused();
    expect(await battle.enemyHealth()).toBe(health);
    await battle.playCardNamed("Slash");
    const discard = page.getByRole("button", { name: "Inspect Discard Pile · 2 cards" });
    await expect(discard).toHaveAttribute("aria-disabled", "false");
    await discard.click();
    await expect(dialog.getByRole("img")).toHaveCount(2);
  },
);

test(
  "shows an empty draft and updates the viewer after each pick",
  critical,
  async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
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
    await expect(page.getByRole("dialog").getByText("No cards here.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", { name: /^Select / })
      .first()
      .click();
    await page.getByRole("button", { name: "View Deck · 1 cards" }).click();
    await expect(page.getByRole("dialog").getByRole("img", { name: "Slash", exact: true })).toBeVisible();
  },
);

test("keeps deck access on run screens and meta detours", async ({ page, fastBattle, runtimeErrors }, testInfo) => {
  void fastBattle;
  void runtimeErrors;
  await startAtDestination(
    page,
    { runDeck: Array.from({ length: 6 }, () => makeCard()) },
    { forceDestination: "Normal Combat" },
  );
  const icon = page.getByRole("button", { name: "View Deck · 6 cards" });
  await expect(icon).toBeVisible();
  await page.mouse.move(0, 0);
  await page.screenshot({ path: testInfo.outputPath("destination-deck-control.png") });
  await page.getByRole("button", { name: "Open game menu" }).click();
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  await icon.click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Deck · 6 cards" })).toBeVisible();
});
