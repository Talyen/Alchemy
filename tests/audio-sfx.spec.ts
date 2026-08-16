import { expect, test as baseTest } from "@playwright/test";
import { failOnRuntimeErrors } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { critical, prepush } from "./playwright-tags";

baseTest.describe("SFX playback", { tag: [prepush.tag, critical.tag] }, () => {
  baseTest("menu interaction starts at least one SFX", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await page.addInitScript(() => {
      const runtime = window as Window & { __alchemySfxPlays?: number };
      runtime.__alchemySfxPlays = 0;
      const NativeAudio = window.Audio;
      window.Audio = class extends NativeAudio {
        constructor(src?: string) {
          super(src);
          const origPlay = this.play.bind(this);
          this.play = () => {
            if (this.src.includes("/sounds/")) {
              runtime.__alchemySfxPlays = (runtime.__alchemySfxPlays ?? 0) + 1;
            }
            return origPlay();
          };
        }
      };
    });

    const errorCue = await page.request.get("/sounds/denied-03.ogg");
    const errorCueMp3 = await page.request.get("/sounds/denied-03.mp3");
    expect(errorCue.ok() || errorCueMp3.ok()).toBe(true);

    const menu = new MenuPage(page);
    await menu.goToCharacterSelect();
    await page.evaluate(() => {
      (window as Window & { __alchemySfxPlays?: number }).__alchemySfxPlays = 0;
    });
    await page.getByRole("button", { name: "Wizard (Locked)" }).click();

    const plays = await page.evaluate(() => (window as Window & { __alchemySfxPlays?: number }).__alchemySfxPlays ?? 0);
    expect(plays).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
});
