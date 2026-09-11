import { expect, test } from "@playwright/test";
import { injectActiveBattle, makeCard, makeGoblinBattleState, failOnRuntimeErrors } from "../../helpers";
import { critical } from "../../playwright-tags";
import { MenuPage } from "../../pages/menu-page";
import { CorruptionPage } from "../../pages/corruption-page";
import { openArmory } from "../armory";

test("Escape cannot redirect a prepared navigation", async ({ page }) => {
  await new MenuPage(page).gotoCollection();
  await page.getByRole("button", { name: "Open game menu" }).click();
  const options = page.getByTestId("game-menu").getByRole("button", { name: "Options" });
  await expect(options).toBeVisible();
  const locked = await options.evaluate(async (button) => {
    (button as HTMLButtonElement).click();
    // Flush the click's React update while still inside the navigation delay.
    await Promise.resolve();
    const locked = document.querySelector(".page-enter")?.hasAttribute("inert");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return locked;
  });
  expect(locked).toBe(true);
  await expect(page.getByRole("heading", { name: "Options", exact: true })).toBeVisible();
  await expect(page.getByTestId("game-menu")).toHaveCount(0);
});

test("interrupting a tab reveal never jumps back to full opacity", critical, async ({ page }) => {
  await new MenuPage(page).gotoCollection();
  await expect(page.locator(".page-enter")).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  const samples = await page.evaluate(async () => {
    const deadline = performance.now() + 5000;
    while (performance.now() < deadline) {
      await new Promise(requestAnimationFrame);
      const slot = document.querySelector(".screen-fade-in:not([data-artwork-pending])");
      if (!slot) continue;
      const opacity = Number(getComputedStyle(slot).opacity);
      if (opacity < 0.05 || opacity > 0.7) continue;
      const samples = [opacity];
      [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Heroes")!.click();
      for (let frame = 0; frame < 3; frame += 1) {
        await new Promise(requestAnimationFrame);
        samples.push(Number(getComputedStyle(slot).opacity));
      }
      return samples;
    }
    throw new Error("No partially revealed tab observed");
  });
  expect(
    samples.slice(1).every((opacity) => opacity <= samples[0]! + 0.05),
    JSON.stringify(samples),
  ).toBe(true);
});

test("closing during preparation never reveals late artwork, including reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const card = makeCard();
  await injectActiveBattle(page, makeGoblinBattleState({ hand: [card] }), { runDeck: [card] });
  const opener = page.getByRole("button", { name: "View Deck · 1 cards" });
  await expect(opener).toHaveAttribute("aria-disabled", "false");
  await page.evaluate(() => {
    const decode = HTMLImageElement.prototype.decode;
    const pending: Array<(failed: boolean) => void> = [];
    Object.assign(window, {
      queuedArtwork: () => pending.length,
      finishArtwork: (failed = false) => pending.splice(0).forEach((finish) => finish(failed)),
    });
    HTMLImageElement.prototype.decode = async function () {
      await decode.call(this);
      if (this.closest('[data-testid="card-inspection-overlay"]')) {
        await new Promise<void>((resolve, reject) => {
          pending.push((failed) => (failed ? reject(new Error("decode failed")) : resolve()));
        });
      }
    };
  });
  await opener.click();
  const overlay = page.getByTestId("card-inspection-overlay");
  const panel = overlay.locator('[role="dialog"]');
  await expect(panel).toHaveCSS("visibility", "hidden");
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { queuedArtwork: () => number }).queuedArtwork()))
    .toBeGreaterThan(0);
  const samples = await panel.evaluate(async (dialog) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    (window as unknown as { finishArtwork: () => void }).finishArtwork();
    const samples: string[] = [];
    while (dialog.isConnected) {
      await new Promise(requestAnimationFrame);
      if (dialog.isConnected) samples.push(getComputedStyle(dialog).visibility);
    }
    return samples;
  });
  expect(samples.length).toBeGreaterThan(0);
  expect(samples.every((visibility) => visibility === "hidden")).toBe(true);
  await opener.click();
  await expect(panel).toHaveCSS("visibility", "hidden");
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { queuedArtwork: () => number }).queuedArtwork()))
    .toBeGreaterThan(0);
  await page.evaluate(() => (window as unknown as { finishArtwork: (failed: boolean) => void }).finishArtwork(true));
  await expect(panel).toBeVisible();
  await expect(panel.locator("img")).toHaveCSS("visibility", "hidden");
  await expect(panel).toHaveCSS("translate", "none");
  await expect(panel.getByRole("button", { name: "Close card inspection" })).toBeFocused();
});

test("Corruption prepares the prompt, cards, and actions as one view", async ({ page }) => {
  const corruption = new CorruptionPage(page);
  await corruption.open();
  await expect(corruption.corruptBtn).toBeVisible();
  await page.evaluate(() => {
    const decode = HTMLImageElement.prototype.decode;
    const hold = new Promise<void>((resolve) => {
      Object.assign(window, { releaseArtwork: resolve });
    });
    HTMLImageElement.prototype.decode = async function () {
      await decode.call(this);
      await hold;
    };
  });
  await corruption.corruptBtn.click();
  await expect(corruption.cardGrid).toHaveCount(1);
  await expect(corruption.confirmCorruptBtn).toBeHidden();
  await expect(page.getByText("Select one card. The altar may weaken, strengthen, or remake it.")).toBeHidden();
  await page.evaluate(() => (window as unknown as { releaseArtwork: () => void }).releaseArtwork());
  await expect(corruption.cardGrid).toBeVisible();
  await expect(corruption.confirmCorruptBtn).toBeVisible();
});

test("Armory slot headings never label the outgoing items", async ({ page }) => {
  await openArmory(page);
  const panel = page.getByTestId("armory-right-panel");
  await expect(panel.getByRole("heading", { name: "Weapons" })).toBeVisible();
  const samples = await panel.evaluate(async (panel) => {
    document.querySelector<HTMLButtonElement>('[aria-label="Armor equipment slot"]')!.click();
    const samples: Array<{ title: string | null; items: Array<string | null> }> = [];
    const deadline = performance.now() + 1000;
    while (performance.now() < deadline) {
      await new Promise(requestAnimationFrame);
      samples.push({
        title: panel.querySelector("h2")?.textContent ?? null,
        items: [...panel.querySelectorAll("[data-gear-title]")].map((item) => item.getAttribute("data-gear-title")),
      });
    }
    return samples;
  });
  expect(samples.some((sample) => sample.title === "Armor" && sample.items.includes("Leather Armor"))).toBe(true);
  expect(samples.some((sample) => sample.title === "Armor" && sample.items.includes("Longsword"))).toBe(false);
});

test("inspection reveals a complete panel and retains its page through exit", critical, async ({ page }) => {
  const errors = failOnRuntimeErrors(page);
  const cards = Array.from({ length: 40 }, (_, uid) => makeCard({ uid: uid + 1 }));
  await injectActiveBattle(page, makeGoblinBattleState({ hand: [cards[0]!], deck: cards.slice(1) }), {
    runDeck: cards,
  });
  const opener = page.getByRole("button", { name: "View Deck · 40 cards" });
  await expect(opener).toHaveAttribute("aria-disabled", "false");
  await page.evaluate(() => {
    const decode = HTMLImageElement.prototype.decode;
    const hold = new Promise<void>((resolve) => {
      Object.assign(window, { releaseOverlayArtwork: resolve });
    });
    HTMLImageElement.prototype.decode = async function () {
      await decode.call(this);
      if (this.closest('[data-testid="card-inspection-overlay"]')) await hold;
    };
  });
  await opener.click();
  const overlay = page.getByTestId("card-inspection-overlay");
  const panel = overlay.locator('[role="dialog"]');
  await expect(overlay).toBeVisible();
  await expect(panel).toHaveCSS("visibility", "hidden");
  expect(await panel.evaluate((element) => element.contains(document.activeElement))).toBe(false);
  await page.evaluate(() => (window as unknown as { releaseOverlayArtwork: () => void }).releaseOverlayArtwork());
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "Close card inspection" })).toBeFocused();
  await panel.getByRole("button", { name: "Next page" }).click();
  await expect(panel.getByRole("button", { name: "Previous page" })).toBeEnabled();
  await expect(panel.locator(".screen-fade-out, [data-artwork-pending]")).toHaveCount(0);
  const samples = await panel.evaluate(async (dialog) => {
    const samples: Array<{ previousDisabled: boolean; width: number; height: number }> = [];
    const capture = () => {
      const previous = dialog.querySelector<HTMLButtonElement>('[aria-label="Previous page"]')!;
      const { width, height } = dialog.getBoundingClientRect();
      samples.push({ previousDisabled: previous.disabled, width, height });
    };
    capture();
    dialog.querySelector<HTMLButtonElement>('[aria-label="Close card inspection"]')!.click();
    while (dialog.isConnected) {
      await new Promise(requestAnimationFrame);
      if (dialog.isConnected) capture();
    }
    return samples;
  });
  expect(samples.length).toBeGreaterThan(2);
  expect(samples.every((sample) => !sample.previousDisabled)).toBe(true);
  expect(samples.every((sample) => Math.abs(sample.width - samples[0]!.width) < 1)).toBe(true);
  expect(samples.every((sample) => Math.abs(sample.height - samples[0]!.height) < 1)).toBe(true);
  await opener.click();
  await expect(panel.getByRole("button", { name: "Previous page" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(overlay).toHaveCount(0);
  expect(errors).toEqual([]);
});
