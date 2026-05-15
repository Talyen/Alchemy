import { expect, test, type Page } from "@playwright/test";
import { startRun } from "./helpers";

async function setResolution(page: Page, resolution: string) {
  await page.addInitScript((res) => {
    const KEY = "alchemy-save-v1";
    const save = JSON.parse(localStorage.getItem(KEY) || "{}");
    save.selectedResolution = res;
    localStorage.setItem(KEY, JSON.stringify(save));
  }, resolution);
}

const RESOLUTIONS = [
  { option: "1920x1080", label: "standard-16-9", vp: { width: 1920, height: 1080 } },
  { option: "1920x1200", label: "narrow-16-10", vp: { width: 1920, height: 1200 } },
  { option: "2560x1080", label: "ultrawide-21-9", vp: { width: 2560, height: 1080 } },
] as const;

for (const { option, label, vp } of RESOLUTIONS) {
  test.describe(`Aspect ratio: ${option} (${label})`, () => {
    test("menu screen fits viewport without overflow", async ({ page }) => {
      await setResolution(page, option);
      await page.setViewportSize(vp);
      await page.goto("/");

      await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

      const layout = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        vw: window.innerWidth,
        vh: window.innerHeight,
      }));

      expect(layout.width).toBeLessThanOrEqual(layout.vw);
      expect(layout.height).toBeLessThanOrEqual(layout.vh);
    });

    test("character-select screen fits viewport without overflow", async ({ page }) => {
      await setResolution(page, option);
      await page.setViewportSize(vp);
      await page.goto("/");

      await page.getByRole("button", { name: "Play" }).click();
      await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();

      const layout = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        vw: window.innerWidth,
        vh: window.innerHeight,
      }));

      expect(layout.width).toBeLessThanOrEqual(layout.vw);
      expect(layout.height).toBeLessThanOrEqual(layout.vh);
    });

    test("battle screen cards and controls fit viewport without overflow", async ({ page }) => {
      await setResolution(page, option);
      await page.setViewportSize(vp);
      await startRun(page);

      const playableCards = page.locator('[aria-label^="Play "]');
      await expect(playableCards.first()).toBeVisible();
      expect(await playableCards.count()).toBeGreaterThanOrEqual(1);

      await page.getByRole("button", { name: "End Turn" }).click();
      await expect(page.getByText("Enemy Turn")).toBeVisible();

      const layout = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        vw: window.innerWidth,
        vh: window.innerHeight,
        cardsInViewport: [...document.querySelectorAll('[aria-label^="Play "]')].every((card) => {
          const rect = card.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight;
        }),
      }));

      expect(layout.width).toBeLessThanOrEqual(layout.vw);
      expect(layout.height).toBeLessThanOrEqual(layout.vh);
      expect(layout.cardsInViewport).toBe(true);
    });

    test("options screen is accessible and all tab panels render", async ({ page }) => {
      await setResolution(page, option);
      await page.setViewportSize(vp);
      await page.goto("/");

      await page.getByRole("button", { name: "Options" }).click();
      await expect(page.getByRole("heading", { name: "Options" })).toBeVisible();

      await page.getByRole("button", { name: "Sound" }).click();
      await expect(page.getByText("Master Volume")).toBeVisible();

      await page.getByRole("button", { name: "Display" }).click();
      await expect(page.getByText("Aspect Ratio")).toBeVisible();

      const layout = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        vw: window.innerWidth,
        vh: window.innerHeight,
      }));

      expect(layout.width).toBeLessThanOrEqual(layout.vw);
      expect(layout.height).toBeLessThanOrEqual(layout.vh);
    });
  });
}
