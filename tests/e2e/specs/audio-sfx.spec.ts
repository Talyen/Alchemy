import { expect, test } from "../../fixtures/e2e";
import { MenuPage } from "../../pages/menu-page";
import { readSfxPlays, resetSfxPlays, trackSfxPlays } from "../../pages/audio-harness";
import { critical } from "../../playwright-tags";

test.describe("SFX playback", critical, () => {
  test("menu interaction starts at least one SFX", async ({ page }) => {
    await trackSfxPlays(page);

    const errorCue = await page.request.get("/sounds/denied-03.ogg");
    const errorCueMp3 = await page.request.get("/sounds/denied-03.mp3");
    expect(errorCue.ok() || errorCueMp3.ok()).toBe(true);

    const menu = new MenuPage(page);
    await menu.goToCharacterSelect();
    await resetSfxPlays(page);
    await page.getByRole("button", { name: "Wizard (Locked)" }).click({ force: true });

    expect(await readSfxPlays(page)).toBeGreaterThan(0);
  });
});
