import { expect, test } from "@playwright/test";
import { makeCard, SAVE_KEY, selectGameMode, startBattleWithDeck } from "./helpers";

async function setAspectRatio(page: import("@playwright/test").Page, aspectRatio: string) {
  await page.addInitScript(({ saveKey, ar }) => {
    const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
    save.selectedAspectRatio = ar;
    localStorage.setItem(saveKey, JSON.stringify(save));
  }, { saveKey: SAVE_KEY, ar: aspectRatio });
}

async function assertNoOverflow(page: import("@playwright/test").Page, screenName: string) {
  const layout = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    vw: window.innerWidth,
    vh: window.innerHeight,
  }));
  expect(layout.width, `${screenName}: scrollWidth ${layout.width} should be <= viewport width ${layout.vw}`).toBeLessThanOrEqual(layout.vw);
  expect(layout.height, `${screenName}: scrollHeight ${layout.height} should be <= viewport height ${layout.vh}`).toBeLessThanOrEqual(layout.vh);
}

async function waitForHandEntryAnimations(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => {
      const cards = [...document.querySelectorAll('[data-hand-card="true"]')];
      if (cards.length === 0) return false;
      return cards.every((card) => {
        const animations = card.getAnimations();
        return animations.length === 0 || animations.every((a) => a.playState === "finished" || a.playState === "idle");
      });
    },
    undefined,
    { timeout: 5000 },
  );
}

const RESOLUTIONS = [
  { width: 1366, height: 768, label: "1366x768" },
  { width: 1920, height: 1080, label: "1920x1080" },
  { width: 3840, height: 2160, label: "3840x2160 (4K)" },
] as const;

const CARD_VIEWPORT_TOLERANCE_PX = 12;
const CARD_VIEWPORT_TOLERANCE_RATIO = 0.015;

for (const { width, height, label } of RESOLUTIONS) {
  test.describe(`${label}`, () => {
    test("menu screen fits viewport without overflow", async ({ page }) => {
      await setAspectRatio(page, "16:9");
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
      await assertNoOverflow(page, "Menu");
    });

    test("character-select screen fits viewport without overflow", async ({ page }) => {
      await setAspectRatio(page, "16:9");
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await selectGameMode(page, "campaign");
      await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();
      await assertNoOverflow(page, "Character Select");
    });

    test("battle screen cards and controls fit viewport without overflow", async ({ page }) => {
      await setAspectRatio(page, "16:9");
      await page.setViewportSize({ width, height });
      await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeCard()));

      await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible();
      expect(await page.locator('[aria-label^="Play "]').count()).toBeGreaterThanOrEqual(1);
      await waitForHandEntryAnimations(page);
      await assertNoOverflow(page, "Battle");

      const maxCardOverflow = await page.evaluate(() =>
        Math.max(
          0,
          ...[...document.querySelectorAll('[aria-label^="Play "]')].map((card) => {
          const rect = card.getBoundingClientRect();
            return Math.max(-rect.left, rect.right - window.innerWidth, -rect.top, rect.bottom - window.innerHeight, 0);
          }),
        )
      );
      const cardViewportTolerance = Math.max(CARD_VIEWPORT_TOLERANCE_PX, height * CARD_VIEWPORT_TOLERANCE_RATIO);
      expect(maxCardOverflow, "Hand cards should stay within viewport aside from small rotated-edge drift").toBeLessThanOrEqual(cardViewportTolerance);
    });
  });
}

test.describe("Ultra HD 3840x2160 (4K) additional checks", () => {
  test("stage uses native resolution (no CSS transform scaling)", async ({ page }) => {
    await setAspectRatio(page, "16:9");
    await page.setViewportSize({ width: 3840, height: 2160 });
    await page.goto("/");

    const transform = await page.evaluate(() => {
      const stage = document.querySelector('[class*="overflow-hidden"][class*="bg-background"]');
      if (!stage) return "not-found";
      return window.getComputedStyle(stage).transform;
    });
    expect(transform).toBe("none");
  });
});
