import { expect, test } from "../../fixtures/e2e";
import { MenuPage } from "../../pages/menu-page";
import { readSfxPlays, resetSfxPlays, trackSfxPlays } from "../../pages/audio-harness";
import { critical } from "../../playwright-tags";

test.describe("SFX playback", critical, () => {
  test("an enabled menu action successfully starts its SFX", async ({ page }) => {
    await trackSfxPlays(page);

    const menu = new MenuPage(page);
    await menu.goto();
    await menu.expectMainMenu();
    await resetSfxPlays(page);
    await menu.openGameModeSelect();
    await expect.poll(() => readSfxPlays(page)).toBeGreaterThan(0);
  });
});
