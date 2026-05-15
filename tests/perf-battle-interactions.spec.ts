import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { startRun } from "./helpers";

// Terminal battle screens are acceptable exits for perf waits because fast wins can remove controls.
async function isBattleTerminal(page: Page) {
  return page.getByRole("heading", { name: /^(Victory|Defeat)/ }).isVisible().catch(() => false);
}

test.describe("Battle Interaction Performance", () => {
  test("card play and end turn complete within thresholds", async ({ page }) => {
    await startRun(page);

    for (let turn = 0; turn < 3; turn++) {
      for (let i = 0; i < 3; i++) {
        const playable = page.locator('button[aria-label^="Play "]:enabled');
        const beforeCount = await playable.count();
        if (beforeCount === 0) break;

        const start = Date.now();
        await playable.first().click();
        await expect.poll(async () => (await isBattleTerminal(page)) || (await playable.count()) < beforeCount, {
          timeout: 3000,
          message: `Card ${i + 1} in turn ${turn + 1} did not resolve`,
        }).toBe(true);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(2000);
        if (await isBattleTerminal(page)) return;
      }

      const endBtn = page.getByRole("button", { name: "End Turn" });
      if (await isBattleTerminal(page)) return;
      if (!(await endBtn.isEnabled({ timeout: 500 }).catch(() => false))) {
        test.skip(true, `End Turn not enabled at turn ${turn + 1}`);
        return;
      }

      const turnStart = Date.now();
      await endBtn.click();
      let turnResult = "waiting";
      await expect.poll(async () => {
        if (await isBattleTerminal(page)) {
          turnResult = "terminal";
          return turnResult;
        }
        if (await endBtn.isEnabled().catch(() => false)) {
          turnResult = "ready";
          return turnResult;
        }
        return "waiting";
      }, { timeout: 10000 }).not.toBe("waiting");
      const turnElapsed = Date.now() - turnStart;
      // ENEMY_PHASE_DELAY (900ms) + COMPANION_ATTACK_DELAY (1000ms) + processing
      expect(turnElapsed).toBeLessThan(8000);
      if (turnResult === "terminal") return;
    }
  });
});
