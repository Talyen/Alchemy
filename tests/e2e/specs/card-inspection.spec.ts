import { expect, test } from "../../fixtures/e2e";
import { controllerInput } from "../controller-input";
import { expectUnfocused } from "../focus-input";
import { critical } from "../../playwright-tags";
import { injectActiveBattle, makeCard, makeGoblinBattleState } from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import type { Page } from "@playwright/test";

async function expectAuthoredBlockDamage(page: Page) {
  const tooltip = page.locator(".hover-popup-panel[data-visible]");
  await expect(tooltip).toContainText("Gain 4 Block");
  await expect(tooltip).toContainText("Gain 8 Block");
  await expect(tooltip).toContainText("Deal Physical damage equal to your Block");
}

test("inspects each battle pile without advancing combat", critical, async ({ page, fastBattle }) => {
  void fastBattle;
  const effects = [
    {
      kind: "chance",
      probability: 0.5,
      successEffects: [{ kind: "player-status", status: "block", amount: 4 }],
      failureEffects: [{ kind: "player-status", status: "block", amount: 8 }],
    },
    { kind: "damage", damageType: "physical", amount: 0, equalToBlock: true },
  ];
  const slash = makeCard({ uid: 101, cost: 1, effects });
  const block = makeCard({ id: "block", uid: 102, effects });
  const anvil = makeCard({ id: "anvil", uid: 103 });
  const apple = makeCard({ id: "apple", uid: 104, consume: true });
  await injectActiveBattle(
    page,
    makeGoblinBattleState({
      appliesFightPacing: false,
      hand: [slash],
      deck: [block],
      discard: [anvil],
      exhausted: [apple],
    }),
    { runDeck: [slash, block, anvil, apple], runBoons: ["brass-censer"] },
  );
  const battle = new BattlePage(page);
  const health = await battle.enemyHealth();
  await battle.hand.first().hover();
  await expectAuthoredBlockDamage(page);
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
    await controllerInput(page).activate(opener);
    const dialog = page.getByRole("dialog", { name: title, exact: true });
    await expect(dialog.getByRole("img")).toHaveCount(1);
    await expect(dialog.getByRole("img", { name: image, exact: true })).toBeVisible();
    if (pile === "draw") {
      await dialog.getByRole("img", { name: image, exact: true }).hover();
      await expectAuthoredBlockDamage(page);
    }
    await expect(dialog.getByRole("button", { name: / · \d+ cards$/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expectUnfocused(page);
  }
  expect(await battle.enemyHealth()).toBe(health);
  await battle.playCardNamed("Slash");
  await page.getByTestId("discard-pile").getByRole("button").click();
  await expect(page.getByRole("dialog", { name: "Discard Pile", exact: true }).getByRole("img")).toHaveCount(2);
});
