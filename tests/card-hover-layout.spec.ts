import { expect, test } from "@playwright/test";
import { enterPrimaryRewardScreen } from "./helpers";

test("Victory card hover and focus preserve the screen layout", async ({ page }) => {
  await enterPrimaryRewardScreen(page, { rewardType: "card", choiceIds: ["slash", "bash"] });
  const cards = page.getByRole("button", { name: /^Select / });
  const card = cards.first();
  await expect(card).toBeVisible();
  await expect
    .poll(() => card.locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0))
    .toBe(true);
  const geometry = () =>
    page.evaluate(() => {
      const card = document.querySelector<HTMLButtonElement>('button[aria-label^="Select "]')!;
      const title = document.querySelector("h1")!.getBoundingClientRect();
      const wrapper = card.parentElement!.getBoundingClientRect();
      return { width: card.offsetWidth, height: card.offsetHeight, x: wrapper.x, y: wrapper.y, titleY: title.y };
    });
  await expect.poll(geometry).toEqual(await geometry());
  const resting = await geometry();
  await card.hover();
  await expect(card.locator(".shine-border")).toBeVisible();
  await expect.poll(() => card.evaluate((element) => getComputedStyle(element).scale)).toBe("1.035");
  expect(await geometry()).toEqual(resting);
  await page.mouse.move(0, 0);
  await expect(card.locator(".shine-border")).toHaveCount(0);
  expect(await geometry()).toEqual(resting);
  await card.focus();
  await expect(card.locator(".shine-border")).toBeVisible();
  expect(await geometry()).toEqual(resting);
});
