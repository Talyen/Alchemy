import { expect, test } from "@playwright/test";
import { getElectronMainWindow, launchElectronApp } from "./electron-helpers";
import { injectActiveBattle, makeCard, makeGoblinBattleState } from "../browser-helpers";
import { BattlePage } from "../pages/battle-page";
import { failOnRuntimeErrors } from "../e2e/errors";

test("packaged plasma restores a lost context and falls back on shader failure", async () => {
  const app = await launchElectronApp({ packagedRenderer: true, enableGpu: true });
  try {
    const page = await getElectronMainWindow(app);
    const errors = failOnRuntimeErrors(page);
    const play = page.getByRole("button", { name: "Play", exact: true });
    await expect(play).toBeVisible({ timeout: 30000 });
    await play.hover();
    const cards = [makeCard({ cost: 0 }), makeCard({ cost: 0 })];
    await injectActiveBattle(page, makeGoblinBattleState({ hand: cards }), { runDeck: cards, autoEndTurn: false });
    const battle = new BattlePage(page);
    await battle.waitForOpeningHand();
    await battle.hand.first().hover();
    const canvas = page.getByTestId("global-plasma-background");
    const extension = await canvas.evaluateHandle((element: HTMLCanvasElement) =>
      element.getContext("webgl")?.getExtension("WEBGL_lose_context"),
    );
    expect(await extension.evaluate((value) => Boolean(value))).toBe(true);
    await battle.playFirstCard();
    await extension.evaluate((value) => value?.loseContext());
    await expect(page.getByTestId("static-plasma-background")).toBeVisible();
    await extension.evaluate((value) => value?.restoreContext());
    await extension.dispose();
    await expect(page.getByTestId("static-plasma-background")).toHaveCount(0);
    await expect(page.getByText("Saving…", { exact: true })).toHaveCount(0);
    await expect(battle.hand).toHaveCount(1);
    await battle.endTurn();
    await expect(battle.endTurnBtn).toBeEnabled();
    expect(errors.splice(0).map((message) => message.trim())).toEqual([
      "[other] Plasma WebGL context lost; using static decoration",
    ]);
    await page.addInitScript(() => {
      const original = WebGLRenderingContext.prototype.getProgramParameter;
      WebGLRenderingContext.prototype.getProgramParameter = function (program, parameter) {
        return parameter === this.LINK_STATUS ? false : original.call(this, program, parameter);
      };
    });
    await page.reload();
    await battle.waitForOpeningHand();
    await battle.hand.first().hover();
    await expect(page.getByTestId("static-plasma-background")).toBeVisible();
    expect(errors.splice(0).map((message) => message.trim())).toEqual([
      "[other] Plasma WebGL unavailable; using static decoration",
    ]);
  } finally {
    await app.close();
  }
});
