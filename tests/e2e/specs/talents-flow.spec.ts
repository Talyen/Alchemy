import { controllerInput } from "../controller-input";
import { waitForLayoutSettled } from "../layout-assertions";
import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { MenuPage } from "../../pages/menu-page";
import { readSavedGame, withSavedGame } from "../save-injection";
import { critical } from "../../playwright-tags";

test.describe("Talents Flow", () => {
  test(
    "keyboard allocation spends the last point without shifting the tree and survives resume",
    critical,
    async ({ page }) => {
      const menu = new MenuPage(page);
      await menu.gotoWithUnlockedMeta({ talentXP: { dodge: 40 }, unlockedTalents: {} });
      await menu.openTalents();
      const portrait = page.getByRole("button", { name: "Select Dodge Talents" });
      const input = controllerInput(page);
      await input.activate(portrait, 50);

      const points = page.getByText(/^\d+ Talent Points? Remaining$/);
      await expect(points).toBeVisible();
      await expect(points).toHaveText("2 Talent Points Remaining");
      const nodes = page.locator(".talent-node");
      const geometry = () =>
        nodes.evaluateAll((elements) =>
          elements.map((element) => {
            const { x, y, width, height } = element.getBoundingClientRect();
            return { x, y, width, height };
          }),
        );
      await page.mouse.move(0, 0);
      await waitForLayoutSettled(page, nodes);
      const before = await geometry();
      expect(before.length).toBeGreaterThan(0);
      for (const [name, key] of [
        ["Lightfoot", "Enter"],
        ["Catch Breath", "Space"],
      ]) {
        const node = page.getByRole("button").filter({ has: page.getByText(name, { exact: true }) });
        await input.reach(node, 50);
        await page.keyboard.press(key);
        await expect(node).toHaveAccessibleName(new RegExp(`^Unlocked.*${name}`));
        await expect(node).toHaveAttribute("aria-disabled", "true");
      }
      await expect(points).toHaveCount(0);
      await expect(async () => {
        const after = await geometry();
        expect(after).toHaveLength(before.length);
        for (const [index, rect] of after.entries()) {
          for (const dimension of ["x", "y", "width", "height"] as const) {
            expect(Math.abs(rect[dimension] - before[index]![dimension])).toBeLessThan(1);
          }
        }
      }).toPass({ timeout: 5000 });
      await expect
        .poll(async () => (await readSavedGame(page)).unlockedTalents.dodge)
        .toEqual(["dodge-lightfoot", "dodge-catch-breath"]);
      await withSavedGame(page, async (resumed) => {
        await new MenuPage(resumed).openTalents();
        await resumed.getByRole("button", { name: "Select Dodge Talents" }).click();
        await expect(resumed.getByText(/Talent Points? Remaining$/)).toHaveCount(0);
        for (const name of ["Lightfoot", "Catch Breath"]) {
          await expect(resumed.getByText(name, { exact: true })).toBeVisible();
          const node = resumed.getByRole("button").filter({ has: resumed.getByText(name, { exact: true }) });
          await expect(node).toHaveAttribute("aria-disabled", "true");
          await expect(node).toHaveAccessibleName(new RegExp(`^Unlocked.*${name}`));
        }
      });
    },
  );
});
