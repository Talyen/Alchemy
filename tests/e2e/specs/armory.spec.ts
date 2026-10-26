import { expectUnfocused } from "../focus-input";
import { controllerInput } from "../controller-input";
import { BattlePage } from "../../pages/battle-page";
import { expect } from "@playwright/test";
import { bodyGear, gearItemLocator, openArmory, selectArmorySlot } from "../armory";
import { createEmptyGearInventories, createEmptyGearLoadouts } from "@/lib/gear/types";
import {
  buildActiveRunSave,
  injectExactSave,
  resumeInjectedRun,
  makeGoblinBattleState,
  makeHighDamageCard,
  readSavedGame,
  withSavedGame,
} from "../../browser-helpers";
import { savedActivityFixture } from "../../fixtures/run-activity";
import { test } from "../../fixtures/e2e";
import { critical } from "../../playwright-tags";

const affixedSword = {
  instanceId: "gear-sword",
  definitionId: "longsword-basic" as const,
  affixes: [{ id: "flat-physical" as const, value: 1 }],
};

test(
  "combat locks the battling hero, preserves other loadouts through resume, and releases reserved gear after victory",
  critical,
  async ({ page, fastBattle }) => {
    void fastBattle;
    const gearInventories = createEmptyGearInventories();
    gearInventories.knight = [affixedSword, bodyGear];
    const gearLoadouts = createEmptyGearLoadouts();
    gearLoadouts.knight["main-hand"] = affixedSword.instanceId;
    await injectExactSave(page, {
      ...buildActiveRunSave({
        activity: savedActivityFixture("battle", {
          battleState: makeGoblinBattleState({
            hand: [makeHighDamageCard()],
            deck: Array.from({ length: 6 }, () => makeHighDamageCard()),
          }),
          activeLabyrinthModifiers: [],
          activeLabyrinthRewardModifiers: [],
        }),
      }),
      gearInventories,
      gearLoadouts,
    });
    await page.goto("/");
    await resumeInjectedRun(page);
    await page.getByRole("button", { name: "Open game menu" }).click();
    await page.getByRole("button", { name: "Armory", exact: true }).click();
    await selectArmorySlot(page, "body");
    const body = gearItemLocator(page, "Leather Armor").getByRole("button", { name: "Leather Armor", exact: true });
    const rejection = page.getByText("Equipment cannot be changed during Combat.", { exact: true });
    await expect(rejection).toHaveCount(0);
    await expect(body).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByTestId("armory-item-picker").locator('[data-artwork-pending="true"]')).toHaveCount(0);
    const input = controllerInput(page);
    await input.point(body);
    await input.click();
    await expect(rejection).toBeVisible();
    expect((await readSavedGame(page)).gearLoadouts.knight.body).toBeNull();
    await page.getByRole("button", { name: "Rogue", exact: true }).click();
    await expect(rejection).toHaveCount(0);
    await body.click();
    await expect.poll(async () => (await readSavedGame(page)).gearLoadouts.rogue.body).toBe(bodyGear.instanceId);
    await selectArmorySlot(page, "main-hand");
    const reserved = page.getByRole("button", { name: /Longsword. Reserved for Knight/ });
    await expect(reserved).toHaveAttribute("aria-disabled", "true");
    await reserved.hover();
    await expect(page.getByText("Reserved for Knight until their battle ends.", { exact: true })).toBeVisible();
    await withSavedGame(page, async (resumed) => {
      await resumed.getByRole("button", { name: "Open game menu" }).click();
      await resumed.getByRole("button", { name: "Armory", exact: true }).click();
      await resumed.getByRole("button", { name: "Rogue", exact: true }).click();
      const restoredReserved = resumed.getByRole("button", { name: /Longsword. Reserved for Knight/ });
      await expect(restoredReserved).toHaveAttribute("aria-disabled", "true");
      expect((await readSavedGame(resumed)).gearLoadouts.rogue.body).toBe(bodyGear.instanceId);
      await resumed.getByRole("button", { name: "Open game menu" }).click();
      await resumed.getByRole("button", { name: "Return to Battle", exact: true }).click();
      const battle = new BattlePage(resumed);
      await battle.playFirstCard();
      await expect(battle.victoryHeading).toBeVisible();
      await resumed.getByRole("button", { name: "Open game menu" }).click();
      await resumed.getByRole("button", { name: "Armory", exact: true }).click();
      await expect(resumed.getByText("Equipment cannot be changed during Combat.", { exact: true })).toHaveCount(0);
      await resumed.getByRole("button", { name: "Rogue", exact: true }).click();
      await gearItemLocator(resumed, "Longsword").getByRole("button", { name: "Longsword", exact: true }).click();
      await expect
        .poll(async () => (await readSavedGame(resumed)).gearLoadouts.rogue["main-hand"])
        .toBe(affixedSword.instanceId);
    });
  },
);

test.describe("Armory browsing", () => {
  test("inventory toolbar preserves layout and keyboard focus through search and filtering", async ({ page }) => {
    await openArmory(page, [affixedSword, { instanceId: "unique-sword", definitionId: "oathkeeper", affixes: [] }]);
    const items = page.getByTestId("armory-inventory-item");
    const search = page.getByRole("searchbox", { name: "Search inventory" });
    const filters = page.getByRole("button", { name: /^Filters/ });
    const gridTop = (await items.first().boundingBox())!.y;
    await page.getByRole("button", { name: "Search inventory", exact: true }).click();
    await expect(search).toBeFocused();
    await search.fill(" physical  LONGSWORD ");
    await expect(items).toHaveCount(2);
    await controllerInput(page).activate(filters);
    const panel = page.getByRole("dialog", { name: "Inventory filters" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("button", { name: "Close inventory filters" })).toBeFocused();
    await panel.getByRole("button", { name: "Basic", exact: true }).click();
    await panel.getByRole("checkbox", { name: "Physical", exact: true }).check();
    await expect(items).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expectUnfocused(page);
    await expect(page.getByRole("heading", { name: "Armory", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close inventory search" }).click();
    expect((await items.first().boundingBox())!.y).toBeCloseTo(gridTop, 0);
    await filters.click();
    await page.getByRole("button", { name: "Search inventory", exact: true }).click();
    await expect(panel).toBeHidden();
    await expect(search).toBeFocused();
    await search.fill("unfindable");
    await expect(page.getByText("No items match your search and filters.")).toBeVisible();
  });
});
