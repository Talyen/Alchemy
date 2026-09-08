import { expect, test, type Locator } from "@playwright/test";
import { enterPrimaryRewardScreen } from "../../helpers";
import { MenuPage } from "../../pages/menu-page";

async function expectStableHoverLayout(card: Locator) {
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      card
        .locator("img")
        .first()
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  const geometry = () =>
    card.evaluate((element: HTMLElement) => {
      const title = document.querySelector("h1")!.getBoundingClientRect();
      const wrapper = element.parentElement!.getBoundingClientRect();
      const art = element.querySelector<HTMLImageElement>("img")!;
      return {
        width: element.offsetWidth,
        height: element.offsetHeight,
        artWidth: art.offsetWidth,
        artHeight: art.offsetHeight,
        x: wrapper.x,
        y: wrapper.y,
        titleY: title.y,
      };
    });
  const resting = await geometry();
  await card.hover();
  await expect(card.locator(".shine-border")).toBeVisible();
  expect(
    await card.locator(".shine-border").evaluate((shine) => {
      const frame = shine.closest(".surface")!;
      const clippingAncestors: string[] = [];
      for (let ancestor = shine.parentElement; ancestor && ancestor !== frame; ancestor = ancestor.parentElement) {
        if (getComputedStyle(ancestor).overflow !== "visible") clippingAncestors.push(ancestor.className);
      }
      return clippingAncestors;
    }),
  ).toEqual([]);
  await expect.poll(() => card.evaluate((element) => getComputedStyle(element).scale)).toBe("1.035");
  expect(await geometry()).toEqual(resting);
  await card.page().mouse.move(0, 0);
  await expect(card.locator(".shine-border")).toHaveCount(0);
  expect(await geometry()).toEqual(resting);
  await card.focus();
  await expect(card.locator(".shine-border")).toBeVisible();
  expect(await geometry()).toEqual(resting);
  await card.blur();
}

for (const tab of ["Cards", "Bestiary"]) {
  test(`Collection ${tab} hover and focus preserve layout`, async ({ page }) => {
    await new MenuPage(page).gotoCollection({
      discoveredCardIds: ["anvil"],
    });
    await page.getByRole("button", { name: tab, exact: true }).click();
    await expect(page.getByRole("button", { name: "Inspect Knight", exact: true })).toBeHidden();
    const entries = page.getByRole("button", { name: /^Inspect / });
    await expectStableHoverLayout(entries.first());
    const locked = page.getByRole("button", { name: /Inspect Undiscovered Entry|Inspect .*\(Locked\)/ }).first();
    if (await locked.count()) await expectStableHoverLayout(locked);
  });
}

for (const rewardType of ["card", "trinket", "gear"] as const) {
  test(`Victory ${rewardType} hover and focus preserve layout`, async ({ page }) => {
    await enterPrimaryRewardScreen(
      page,
      rewardType === "gear"
        ? { rewardType, gearChoices: [{ instanceId: "reward-gear", definitionId: "leather-armor-basic", affixes: [] }] }
        : {
            rewardType,
            choiceIds: rewardType === "card" ? ["slash", "bash"] : ["tattered-pages", "companions-collar"],
          },
    );
    await expectStableHoverLayout(page.getByRole("button", { name: /^Select / }).first());
  });
}
