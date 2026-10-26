import { expectUnfocused } from "../focus-input";
import { controllerInput } from "../controller-input";
import { observeDuringAction } from "../observe-during-action";
import { expect, test } from "../../fixtures/e2e";
import { HomesteadPage } from "../../pages/homestead-page";
import { MenuPage } from "../../pages/menu-page";
import { readSavedGame, withSavedGame } from "../../browser-helpers";
import { critical } from "../../playwright-tags";
import { type Locator, type Page } from "@playwright/test";

async function expectNativeArtwork(art: Locator) {
  await expect
    .poll(() =>
      art.evaluate((image) => {
        if (!(image instanceof HTMLImageElement) || !image.naturalWidth) return Infinity;
        const bounds = image.getBoundingClientRect();
        return Math.abs(bounds.width / bounds.height - image.naturalWidth / image.naturalHeight);
      }),
    )
    .toBeLessThan(0.001);
}

async function observePurchase(page: Page, title: string, activate: () => Promise<void>) {
  const observation = await page.evaluateHandle((title) => {
    let cancelled = false;
    const result = (async () => {
      const frames: Array<{
        height: number;
        gap: number;
        opacity: number;
        valueOpacity: number;
        scale: number;
        active: boolean;
      }> = [];
      const start = performance.now();
      let settled = 0;
      let sawTransition = false;
      while (!cancelled && performance.now() - start < 1800) {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
        const art = Array.from(document.querySelectorAll("button img")).find(
          (image) => image.getAttribute("alt") === title,
        );
        const panel = Array.from(document.querySelectorAll('[role="tooltip"]')).find(
          (element) => element.querySelector("p > span")?.textContent === title,
        );
        const body = panel?.querySelector<HTMLElement>("[data-homestead-transition]");
        if (!art || !(panel instanceof HTMLElement) || !body) continue;
        const bounds = panel.getBoundingClientRect();
        const artwork = art.getBoundingClientRect();
        const active = body.getAttribute("data-homestead-transition") === "active";
        sawTransition ||= active;
        const opacity = Number(getComputedStyle(body.firstElementChild!).opacity);
        const scale = Number.parseFloat(getComputedStyle(panel).scale) || 1;
        const valueOpacity = Number(getComputedStyle(body.querySelector(".homestead-value-update") ?? body).opacity);
        frames.push({
          height: panel.offsetHeight,
          scale,
          gap:
            panel.getAttribute("data-placement") === "above"
              ? artwork.top - bounds.bottom
              : bounds.top - artwork.bottom,
          opacity,
          valueOpacity,
          active,
        });
        const complete =
          art.closest("button")?.querySelector('[role="status"]')?.textContent !== "Saving…" &&
          sawTransition &&
          opacity === 1 &&
          valueOpacity === 1 &&
          scale === 1 &&
          Number(getComputedStyle(art).opacity) === 1;
        settled = complete && frames.at(-2)?.height === panel.offsetHeight ? settled + 1 : 0;
        if (settled >= 6) break;
      }
      return { frames, settled, elapsedMs: performance.now() - start };
    })();
    return {
      result,
      cancel: () => {
        cancelled = true;
      },
    };
  }, title);
  const { frames, settled, elapsedMs } = await observeDuringAction(observation, activate);
  expect(settled, `${title} did not settle within ${Math.round(elapsedMs)}ms`).toBe(6);
  expect(frames.every((frame) => frame.opacity === 1)).toBe(true);
  expect(frames.some((frame) => frame.valueOpacity > 0 && frame.valueOpacity < 1)).toBe(true);
  // CI may miss the overshoot peak; still require observed motion and a settled panel.
  expect(frames.some((frame) => frame.scale !== 1)).toBe(true);
  expect(frames.at(-1)?.scale).toBe(1);
  const heights = frames.map((frame) => frame.height);
  const minimum = Math.min(...heights);
  const maximum = Math.max(...heights);
  // Previewed benefits occupy the same space before and after purchasing.
  expect(maximum - minimum).toBeLessThan(1.5);
  const moving = frames.filter((frame) => frame.active);
  expect(Math.max(...moving.map((frame) => frame.gap)) - Math.min(...moving.map((frame) => frame.gap))).toBeLessThan(
    1.5,
  );
}

// Native pointer/focus behavior and acknowledged persistence share one gallery journey.
test(
  "gallery node purchases preserve passive inspection, spend once, and survive resume",
  critical,
  async ({ page }) => {
    await new HomesteadPage(page).goto({
      materialInventory: { wood: 4, stone: 16, iron: 33 },
      constructedBuildings: {},
    });
    const art = page.getByRole("img", { name: "Blacksmith", exact: true });
    await expectNativeArtwork(art);
    const heading = page.getByRole("heading", { name: "Homestead" });
    const headingBefore = await heading.boundingBox();
    const tile = page.getByRole("button").filter({ has: art });
    const panel = page.getByRole("tooltip").filter({ has: page.getByText("Blacksmith", { exact: true }) });
    await tile.hover();
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Physical damage is increased by 1");
    await expect(panel).toContainText("Find 10% more Iron");
    await expect(panel).toHaveAttribute("data-placement", "below");
    await expect(panel.getByRole("img", { name: "Level 0 of 4" })).toBeVisible();
    await expect(panel.getByLabel("Build cost: 4 Stone, 11 Iron").locator("img")).toHaveCount(2);
    await expect(panel.getByRole("button")).toHaveCount(0);
    expect((await readSavedGame(page)).materialInventory).toMatchObject({ wood: 4, stone: 16, iron: 33 });
    await heading.hover();
    await expect(panel).toBeHidden();
    await controllerInput(page).reach(tile);
    await expect(panel).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /^Build Hunter's Lodge for / })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(tile).toBeFocused();
    await observePurchase(page, "Blacksmith", () => page.keyboard.press("Enter"));
    await expect(panel.getByRole("img", { name: "Level 1 of 4" })).toBeVisible();
    await expect(panel).toContainText("Physical damage is increased by 1");
    await expect(panel).toContainText("Find 10% more");
    await expect(panel).toHaveAttribute("data-placement", "below");
    await expect(tile).toHaveAttribute("aria-label", "Upgrade Blacksmith for 8 Stone, 22 Iron");
    await expect(tile).toHaveAttribute("aria-disabled", "false");
    const physicalKeyword = await panel.getByText("Physical", { exact: true }).elementHandle();
    await observePurchase(page, "Blacksmith", () => page.keyboard.press("Enter"));
    await expect(panel).toContainText("Physical damage is increased by 2");
    expect(await physicalKeyword!.evaluate((element) => element.isConnected)).toBe(true);
    await expect(tile.getByText(/^(Built|Upgraded|Bonded)$/)).toHaveCount(0);
    await expect(tile).toHaveAttribute("aria-disabled", "true");
    await expect(art).not.toHaveClass(/grayscale/);
    await expectNativeArtwork(art);
    expect(await heading.boundingBox()).toEqual(headingBefore);
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await readSavedGame(page)).constructedBuildings["blacksmiths-forge"]).toBe(2);
    await expect
      .poll(async () => (await readSavedGame(page)).materialInventory)
      .toMatchObject({ wood: 4, stone: 4, iron: 0 });
    await withSavedGame(
      page,
      async (resumed) => {
        await new MenuPage(resumed).openHomestead();
        const resumedTile = resumed.getByRole("button", {
          name: "Upgrade Blacksmith for 12 Stone, 33 Iron",
          exact: true,
        });
        await controllerInput(resumed).reach(resumedTile);
        const inspection = resumed
          .getByRole("tooltip")
          .filter({ has: resumed.getByText("Blacksmith", { exact: true }) });
        await expect(inspection).toContainText("Physical damage is increased by 2");
        await expect(inspection.getByRole("button")).toHaveCount(0);
        await expect(inspection).not.toContainText("More materials needed");
        await expect(inspection).toHaveAttribute("data-placement", "below");
        await expect(resumedTile).toHaveAttribute("aria-disabled", "true");
        await expect(resumed.getByRole("img", { name: "Blacksmith", exact: true })).not.toHaveClass(/grayscale/);
        const save = await readSavedGame(resumed);
        expect(save.constructedBuildings["blacksmiths-forge"]).toBe(2);
        expect(save.materialInventory).toMatchObject({ wood: 4, stone: 4, iron: 0 });
      },
      "Continue",
      { keepSource: true },
    );
    const bottomTile = page.getByRole("button", { name: /^Build Wishing Well for / });
    await bottomTile.hover();
    const bottomPanel = page.getByRole("tooltip").filter({ has: page.getByText("Wishing Well", { exact: true }) });
    await expect(bottomPanel).toBeVisible();
    await expect(bottomPanel).toHaveAttribute("data-placement", "above");
    const panelBounds = await bottomPanel.boundingBox();
    const tileBounds = await bottomTile.boundingBox();
    expect(panelBounds!.y + panelBounds!.height).toBeLessThan(tileBounds!.y);
    await observePurchase(page, "Wishing Well", () => bottomTile.click());
    await expect(bottomPanel).toContainText("Wish has a 10% chance");
    await expect(bottomPanel).toHaveAttribute("data-placement", "above");
    await page.getByRole("button", { name: "Reset Homestead", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Reset Homestead", exact: true });
    await expect(dialog).toContainText("refund all spent materials");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expectUnfocused(page);
    await controllerInput(page).activate(page.getByRole("button", { name: "Reset Homestead", exact: true }));
    await controllerInput(page).activate(dialog.getByRole("button", { name: "Reset", exact: true }));
    await expect(dialog).toBeHidden();
    await expect(tile).toHaveAttribute("aria-label", "Build Blacksmith for 4 Stone, 11 Iron");
    await expect(page.getByRole("button", { name: "Reset Homestead", exact: true })).toBeDisabled();
    await expect(art).toHaveClass(/grayscale/);
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeFocused();
    await expect
      .poll(async () => (await readSavedGame(page)).materialInventory)
      .toMatchObject({ wood: 4, stone: 16, iron: 33 });
    await tile.click();
    await expect(tile).toHaveAttribute("aria-label", "Upgrade Blacksmith for 8 Stone, 22 Iron");
    await withSavedGame(page, async (resumed) => {
      await new MenuPage(resumed).openHomestead();
      await expect(
        resumed.getByRole("button", { name: "Upgrade Blacksmith for 8 Stone, 22 Iron", exact: true }),
      ).toBeVisible();
      await expect(resumed.getByRole("status")).toHaveCount(0);
      expect((await readSavedGame(resumed)).constructedBuildings["wishing-well"]).toBe(0);
    });
  },
);
