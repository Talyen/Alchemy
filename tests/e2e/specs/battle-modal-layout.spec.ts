import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { injectActiveBattle, makeCard, makeGoblinBattleState } from "../../helpers";

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`battle inspection backdrops cover the viewport at ${viewport.width}`, async ({
    page,
    fastBattle,
    runtimeErrors,
  }, testInfo) => {
    void fastBattle;
    void runtimeErrors;
    await page.setViewportSize(viewport);
    const card = makeCard();
    await injectActiveBattle(page, makeGoblinBattleState({ hand: [card], deck: [], discard: [] }), {
      runDeck: [card],
      runBoons: ["brass-censer"],
    });
    for (const [opener, testId, title] of [
      ["Inspect Boons", "battle-boon-inspect-overlay", "Boons"],
      ["View Deck · 1 cards", "card-inspection-overlay", "Deck"],
      ["Inspect Discard Pile · 0 cards", "card-inspection-overlay", "Discard Pile"],
    ] as const) {
      await page.getByRole("button", { name: opener, exact: true }).click();
      const overlay = page.getByTestId(testId!);
      const heading = overlay.getByRole("heading", { name: title, exact: true });
      await expect(heading).toBeVisible();
      await expect.poll(() => overlay.boundingBox()).toEqual({ x: 0, y: 0, ...viewport });
      const panel = overlay.locator(":scope > div").first();
      const bounds = await panel.boundingBox();
      expect(bounds!.height).toBeLessThan(viewport.height * 0.9);
      expect(bounds!.width).toBeLessThan(viewport.width * 0.8);
      await heading.click();
      await expect(heading).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${title}-modal.png`) });
      await overlay.click({ position: { x: 3, y: 3 } });
      await expect(overlay).toHaveCount(0);
    }
  });
}
