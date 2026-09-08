import { expect, test as baseTest } from "@playwright/test";
import { failOnRuntimeErrors } from "../../helpers";
import { MenuPage } from "../../pages/menu-page";
import { critical } from "../../playwright-tags";
import { FADE_OUT_DURATION, MUSIC_FADE_TICK_MS, NAVIGATION_DELAY_MS, PAGE_EXIT_MS } from "@/lib/game-constants";

baseTest.describe("SFX playback", critical, () => {
  baseTest("menu interaction starts at least one SFX", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await page.addInitScript(() => {
      const headlessUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => false });
      Object.defineProperty(navigator, "userAgent", {
        configurable: true,
        get: () => headlessUserAgent.replace("HeadlessChrome", "Chrome"),
      });
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
    await page.getByRole("button", { name: "Wizard (Locked)" }).click({ force: true });

    const plays = await page.evaluate(() => (window as Window & { __alchemySfxPlays?: number }).__alchemySfxPlays ?? 0);
    expect(plays).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
});

baseTest("Bestiary boss music follows portrait activation and browsing", critical, async ({ page }) => {
  baseTest.setTimeout(60_000);
  const errors = failOnRuntimeErrors(page);
  await page.addInitScript(() => {
    const userAgent = navigator.userAgent;
    Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => false });
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () => userAgent.replace("HeadlessChrome", "Chrome"),
    });
    const runtime = window as Window & { __alchemyMusic?: HTMLAudioElement[] };
    runtime.__alchemyMusic = [];
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor(src?: string) {
        super(src);
        if (src?.includes("/Music/")) runtime.__alchemyMusic?.push(this);
      }
    };
  });
  const activeMusic = () =>
    page.evaluate(
      () =>
        (window as Window & { __alchemyMusic?: HTMLAudioElement[] }).__alchemyMusic
          ?.filter((audio) => !audio.paused)
          .map((audio) => decodeURIComponent(audio.src)) ?? [],
    );
  const menu = new MenuPage(page);
  await menu.gotoCollection({ encounteredEnemyIds: ["forge-golem"] });
  await page.getByRole("button", { name: "Bestiary", exact: true }).click();
  const boss = page.getByRole("button", { name: /Inspect .*Forge Golem/, includeHidden: true });
  const firstPortrait = page
    .getByRole("button", { name: /^Inspect / })
    .first()
    .locator("img");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await expect(firstPortrait).toBeVisible();
    if (await boss.isVisible()) break;
    const previousArt = await firstPortrait.getAttribute("src");
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(firstPortrait).not.toHaveAttribute("src", previousArt!);
  }
  await expect(boss).toBeVisible();
  await boss.focus();
  await page.keyboard.press("Enter");
  await expect.poll(activeMusic).toEqual([expect.stringContaining("The Forge Golem.mp3")]);
  await page.getByRole("button", { name: "Previous page" }).click();
  await expect.poll(activeMusic).toEqual([expect.stringMatching(/Menu \d\.mp3/)]);
  await page.getByRole("button", { name: "Next page" }).click();
  await boss.click();
  await expect.poll(activeMusic).toEqual([expect.stringContaining("The Forge Golem.mp3")]);
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  await expect.poll(activeMusic).toEqual([expect.stringMatching(/Menu \d\.mp3/)]);
  await page.getByRole("button", { name: "Bestiary", exact: true }).click();
  await boss.click();
  await expect.poll(activeMusic).toEqual([expect.stringContaining("The Forge Golem.mp3")]);
  await page.keyboard.press("Escape");
  await menu.expectMainMenu();
  await expect.poll(activeMusic).toEqual([expect.stringMatching(/Menu \d\.mp3/)]);
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  await expect(boss).toBeVisible();
  await boss.focus();
  const now = new Date();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
  await page.keyboard.press("Escape");
  await page.clock.runFor(NAVIGATION_DELAY_MS);
  const outgoingScreen = page.locator(".page-exit");
  await expect(outgoingScreen).toHaveAttribute("inert", "");
  await page.keyboard.press("Enter");
  await boss.dispatchEvent("click");
  await page.clock.runFor(PAGE_EXIT_MS + FADE_OUT_DURATION + MUSIC_FADE_TICK_MS);
  await page.clock.resume();
  await menu.expectMainMenu();
  await expect.poll(activeMusic).toEqual([expect.stringMatching(/Menu \d\.mp3/)]);
  expect(errors).toEqual([]);
});
