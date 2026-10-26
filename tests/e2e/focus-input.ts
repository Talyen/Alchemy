import { expect, type Page } from "@playwright/test";
import { controllerInput } from "./controller-input";
import { waitForLayoutSettled, injectActiveBattle, makeCard, makeGoblinBattleState } from "../browser-helpers";
import { BattlePage } from "../pages/battle-page";

export async function expectUnfocused(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-focus-navigation", "false");
  await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
}

async function watchFocus(page: Page) {
  await page.evaluate(() => {
    const events: string[] = [];
    const listener = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target !== document.body)
        events.push(target.getAttribute("aria-label") ?? target.textContent?.trim() ?? target.tagName);
    };
    document.addEventListener("focusin", listener);
    Object.assign(window, {
      finishFocusWatch: () => {
        document.removeEventListener("focusin", listener);
        return events;
      },
    });
  });
  return async () => {
    const events = await page.evaluate(async () => {
      for (let frame = 0; frame < 6; frame++) await new Promise(requestAnimationFrame);
      const watched = window as unknown as { finishFocusWatch?: () => string[] };
      const events = watched.finishFocusWatch!();
      delete watched.finishFocusWatch;
      return events;
    });
    expect(events, "dismissal or scrolling must not trigger an automatic focus handoff").toEqual([]);
  };
}

/** Real native focus, wheel scrolling, and modal fade boundaries shared with Electron. */
export async function exerciseFocusInputOptions(page: Page) {
  const input = controllerInput(page);
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await waitForLayoutSettled(page, page.getByRole("heading", { name: "Options", exact: true }));
  await expectUnfocused(page);

  const language = page.getByRole("combobox", { name: "Language", exact: true });
  await input.reach(language);
  await expect(language).toBeFocused();
  await expect(language).toHaveCSS("outline-style", "solid");
  const scroller = page.locator(".game-page-scroll");
  const bounds = await scroller.boundingBox();
  if (!bounds) throw new Error("Options scroller is not visible");
  await page.mouse.move(bounds.x + bounds.width - 12, bounds.y + bounds.height / 2);
  const finishScrollWatch = await watchFocus(page);
  await input.scroll(700);
  await expect(page.locator("html")).toHaveAttribute("data-focus-navigation", "false");
  await expect(language).toHaveCSS("outline-style", "none");
  await finishScrollWatch();

  await input.activate(page.getByRole("button", { name: "Other", exact: true }));
  const clear = page.locator("[data-screen-content]").getByRole("button", { name: "Clear Save Data", exact: true });
  await input.activate(clear);
  const dialog = page.getByRole("dialog");
  const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
  await expect(cancel).toBeFocused();
  await expect(cancel).toHaveCSS("outline-style", "solid");
  if (process.env.ALCHEMY_FOCUS_VISUAL_REVIEW === "1")
    await page.screenshot({
      path: `reports/focus-review/${page.url().startsWith("alchemy:") ? "electron" : "browser"}-keyboard.png`,
    });

  // Hold Tab across Escape: subsequent native keydown repeats are not fresh intent.
  await page.keyboard.down("Tab");
  const finishEscapeWatch = await watchFocus(page);
  await input.press("back");
  await expect(dialog).toHaveCount(0);
  await page.keyboard.down("Tab");
  await page.keyboard.up("Tab");
  await expectUnfocused(page);
  await finishEscapeWatch();
  if (process.env.ALCHEMY_FOCUS_VISUAL_REVIEW === "1")
    await page.screenshot({
      path: `reports/focus-review/${page.url().startsWith("alchemy:") ? "electron" : "browser"}-escape.png`,
    });

  await clear.click();
  await expect(dialog).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-focus-navigation", "false");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(false);
  await expect(clear).toHaveCSS("outline-style", "none");
  await input.reach(cancel);
  await expect(page.locator("html")).toHaveAttribute("data-focus-navigation", "true");
  await cancel.click();
  await expect(dialog).toHaveCount(0);
  await expectUnfocused(page);

  // A fresh arrow and F7 remain valid ways to opt back into navigation.
  await input.press("down");
  await expect(page.locator("html")).toHaveAttribute("data-focus-navigation", "true");
  await expect.poll(() => page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  await input.reach(clear, 30, "previous");
  const finishBackWatch = await watchFocus(page);
  await input.press("back");
  await waitForLayoutSettled(page, page.getByRole("button", { name: "Play", exact: true }));
  await expectUnfocused(page);
  await finishBackWatch();
}

export async function exerciseFocusInputBattle(page: Page) {
  const cards = Array.from({ length: 3 }, () =>
    makeCard({ cost: 0, effects: [{ kind: "player-status", status: "block", amount: 1 }] }),
  );
  const deck = Array.from({ length: 6 }, () => makeCard());
  await injectActiveBattle(page, makeGoblinBattleState({ hand: cards, deck }), {
    autoEndTurn: false,
    runDeck: [...cards, ...deck],
  });
  const battle = new BattlePage(page);
  const input = controllerInput(page);
  await battle.waitForOpeningHand();
  await input.activate(battle.hand.first());
  await expect(page.locator(".card-ghost-overlay")).toHaveCount(1);
  await page.mouse.wheel(0, 500);
  await expect(battle.hand).toHaveCount(2);
  await expect(page.locator(".card-ghost-overlay")).toHaveCount(0);
  await expectUnfocused(page);

  await input.reach(battle.hand.first());
  await expect(battle.hand.first()).toBeFocused();
  await input.press("back");
  await expect(page.getByTestId("game-menu")).toBeVisible();
  await expectUnfocused(page);
  await input.press("back");
  await expect(page.getByTestId("game-menu")).toHaveCount(0);
  await expectUnfocused(page);

  const draw = page.getByTestId("draw-pile").getByRole("button");
  await draw.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expectUnfocused(page);
  await input.reach(dialog.getByRole("button", { name: "Close card inspection", exact: true }));
  const finishWatch = await watchFocus(page);
  await input.press("back");
  await expect(dialog).toHaveCount(0);
  await expectUnfocused(page);
  await finishWatch();
  await input.activate(battle.endTurnBtn);
  await battle.waitForTurnReady();
  await expect(battle.endTurnBtn).toBeEnabled();
}
