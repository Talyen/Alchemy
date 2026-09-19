import { expect, test } from "../../fixtures/e2e";
import type { Locator } from "@playwright/test";
import { openArmory, createEmptyGearLoadouts, equipmentSlotLocator } from "../armory";
import { HomesteadPage } from "../../pages/homestead-page";
import { gridLabyrinthMapFixture } from "../../fixtures/labyrinth-map";
import {
  enterPrimaryRewardScreen,
  injectActiveBattle,
  makeCard,
  makeGoblinBattleState,
  injectLabyrinthRun,
} from "../../browser-helpers";
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
  await expect(card.locator(".shine-border")).not.toHaveAttribute("data-glow", "true");
  await expect
    .poll(() => card.locator(".shine-border").evaluate((shine) => getComputedStyle(shine).filter))
    .toBe("none");
  await expect.poll(() => card.evaluate((element) => getComputedStyle(element).filter)).toBe("none");
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
  await expect(card.locator(".shine-border")).not.toHaveAttribute("data-glow", "true");
  await expect
    .poll(() => card.locator(".shine-border").evaluate((shine) => getComputedStyle(shine).filter))
    .toBe("none");
  await expect.poll(() => card.evaluate((element) => getComputedStyle(element).filter)).toBe("none");
  expect(await geometry()).toEqual(resting);
  await card.blur();
}

test("Collection card hover and focus preserve layout", async ({ page }) => {
  await new MenuPage(page).gotoCollection({ discoveredCardIds: ["anvil"] });
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  await expect(page.getByRole("button", { name: "Inspect Knight", exact: true })).toBeHidden();
  const entries = page.getByRole("button", { name: /^Inspect / });
  await expectStableHoverLayout(entries.first());
  const locked = page.getByRole("button", { name: /Inspect Undiscovered Entry|Inspect .*\(Locked\)/ }).first();
  if (await locked.count()) await expectStableHoverLayout(locked);
});

test("Victory card hover and focus preserve layout", async ({ page }) => {
  await enterPrimaryRewardScreen(page, { rewardType: "card", choiceIds: ["slash", "bash"] });
  await expectStableHoverLayout(page.getByRole("button", { name: /^Select / }).first());
});

async function expectBorderOnlyShine(surface: Locator, shineOverride?: Locator) {
  if (await surface.evaluate((element) => element.classList.contains("talent-card-available"))) {
    await expect(surface).toBeVisible();
    await surface.hover({ force: true });
  } else {
    await surface.hover();
  }
  // Battle panels mount both the turn badge and the hover shine; callers
  // scope to the hover shine so the hidden turn badge cannot match.
  const shine = shineOverride ?? surface.locator(".shine-border");
  await expect(shine).toBeVisible();
  await expect(shine).not.toHaveAttribute("data-glow", "true");
  await expect.poll(() => shine.evaluate((element) => getComputedStyle(element).filter)).toBe("none");
  await expect.poll(() => surface.evaluate((element) => getComputedStyle(element).filter)).toBe("none");
  expect(await shine.evaluate((element) => getComputedStyle(element).overflow)).toBe("visible");
  expect(
    await shine.evaluate((element) => {
      const frame = element.closest(".surface, .talent-node")!;
      for (let parent = element.parentElement; parent && parent !== frame; parent = parent.parentElement) {
        if (getComputedStyle(parent).overflow !== "visible") return false;
      }
      return true;
    }),
  ).toBe(true);
}

test("Homestead hover shows shine border without changing affordability", async ({ page }) => {
  const homestead = new HomesteadPage(page);
  await homestead.goto();
  await expectStableHoverLayout(await homestead.constructButton());
});

test("Battle hand and enemy hover shine leave turn borders unchanged", async ({ page }) => {
  const hand = [makeCard({ cost: 0 })];
  await injectActiveBattle(page, makeGoblinBattleState({ hand }), { runDeck: hand, autoEndTurn: false });
  await expectBorderOnlyShine(page.locator('[data-hand-card="true"] button').first());
  await expectBorderOnlyShine(page.getByTestId("battle-enemy-art-panel"), page.getByTestId("keyword-shine-hover"));
  await expect(page.getByTestId("turn-badge-player")).not.toHaveAttribute("data-glow", "true");
  await expect(page.getByTestId("turn-badge-enemy")).not.toHaveAttribute("data-glow", "true");
});

test("Labyrinth selected border stays glow-free after hover and focus end", async ({ page }) => {
  await injectLabyrinthRun(page, { labyrinthMap: gridLabyrinthMapFixture() });
  const room = page.getByRole("button", { name: /^Entrance chamber/ });
  await expectBorderOnlyShine(room);
  await room.click();
  await room.blur();
  await page.mouse.move(0, 0);
  await expect(room.locator(".shine-border")).toBeVisible();
  await expect(room.locator(".shine-border")).not.toHaveAttribute("data-glow", "true");
});

test("Equipped shine stays glow-free and unclipped during interaction", async ({ page }) => {
  const loadouts = createEmptyGearLoadouts();
  loadouts.knight.body = "glow-armor";
  await openArmory(page, {
    inventory: [{ instanceId: "glow-armor", definitionId: "leather-armor-astral", affixes: [] }],
    loadouts,
  });
  const slot = equipmentSlotLocator(page, "body").getByRole("button");
  await expectBorderOnlyShine(slot);
  await slot.click();
  await slot.blur();
  await page.mouse.move(0, 0);
  await expect(slot).toHaveAttribute("aria-pressed", "true");
  await expect(slot.locator(".shine-border")).toBeVisible();
  await expect(slot.locator(".shine-border")).not.toHaveAttribute("data-glow", "true");
  await slot.focus();
  await expect(slot.locator(".shine-border")).toBeVisible();
  await expect(slot.locator(".shine-border")).not.toHaveAttribute("data-glow", "true");
});
