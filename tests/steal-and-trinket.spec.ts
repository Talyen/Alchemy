import { expect, test } from "@playwright/test";
import { startRun, playUntilVictory, completeVictoryFlow } from "./helpers";

test.describe("Steal Card", () => {
  test("steal card increases gold in battle", async ({ page }) => {
    await startRun(page);

    const stealCard = page.getByRole("button", { name: /Play Steal/ });
    if (!(await stealCard.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Steal card not in initial hand");
      return;
    }

    const goldBefore = await page.getByTestId("gold-display").textContent();
    const goldValueBefore = Number(goldBefore?.replace(/\D/g, ""));

    await stealCard.click();
    await page.waitForTimeout(300);

    const goldAfter = await page.getByTestId("gold-display").textContent();
    const goldValueAfter = Number(goldAfter?.replace(/\D/g, ""));
    expect(goldValueAfter).toBeGreaterThan(goldValueBefore);
  });
});
