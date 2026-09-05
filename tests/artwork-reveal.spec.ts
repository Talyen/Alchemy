import { expect, test } from "@playwright/test";
import { MenuPage } from "./pages/menu-page";

test("screen reveals wait for mounted artwork on arrival and return", async ({ page }) => {
  const menu = new MenuPage(page);
  await menu.gotoWithUnlockedMeta({ finishedRunCharacters: ["knight"] });
  await menu.expectMainMenuAfterColdStart();

  await page.evaluate(() => {
    const original = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function () {
      await original.call(this);
      if (!this.isConnected) return;
      this.dataset.decodeHeld = "true";
      await new Promise<void>((resolve) => {
        this.addEventListener("release-decode", () => resolve(), { once: true });
      });
      delete this.dataset.decodeHeld;
    };
  });

  const waitForHeldArtwork = async () => {
    await expect
      .poll(() =>
        page
          .locator(".page-enter img")
          .evaluateAll(
            (images) =>
              images.length > 0 && images.every((image) => (image as HTMLImageElement).dataset.decodeHeld === "true"),
          ),
      )
      .toBe(true);
  };

  await menu.talentsBtn.click();
  const held = page.locator('img[data-decode-held="true"]');
  await waitForHeldArtwork();
  const pendingScreen = page.locator(".page-enter[data-artwork-pending]");
  await expect(pendingScreen).toHaveCSS("visibility", "hidden");
  await expect(pendingScreen).toHaveCSS("animation-play-state", "paused");
  await expect(page.getByRole("heading", { name: "Talents" })).toBeHidden();
  await held.evaluateAll((images) =>
    images.slice(0, -1).forEach((image) => image.dispatchEvent(new Event("release-decode"))),
  );
  await expect(pendingScreen).toHaveCSS("visibility", "hidden");
  await held.last().dispatchEvent("release-decode");
  await expect(page.getByRole("heading", { name: "Talents" })).toBeVisible();

  await page.getByRole("button", { name: "Back", exact: true }).click();
  const logo = page.locator('img[alt="Alchemy logo"]');
  await expect(logo).toHaveAttribute("data-decode-held", "true");
  await expect(pendingScreen).toHaveCSS("visibility", "hidden");
  await expect(menu.playBtn).toBeHidden();
  const size = await logo.boundingBox();
  expect(size?.height).toBeGreaterThan(0);
  await logo.dispatchEvent("release-decode");
  await menu.expectMainMenu();
  await expect(logo).toBeVisible();

  await menu.playBtn.click();
  await waitForHeldArtwork();
  await held.evaluateAll((images) => images.forEach((image) => image.dispatchEvent(new Event("release-decode"))));
  await expect(page.getByRole("heading", { name: "Choose a Path" })).toBeVisible();
  await page.getByRole("button", { name: "The Campaign", exact: true }).click();
  await waitForHeldArtwork();
  await expect(pendingScreen).toHaveCSS("visibility", "hidden");
  await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeHidden();
  await held.evaluateAll((images) => images.forEach((image) => image.dispatchEvent(new Event("release-decode"))));
  await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();
});
