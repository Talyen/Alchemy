import { controllerInput } from "../controller-input";
import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { MenuPage } from "../../pages/menu-page";
import { readSavedGame, withSavedGame } from "../save-injection";
import { critical, slow } from "../../playwright-tags";

test.describe("Talents Flow", () => {
  test("keyboard allocation spends two points and survives resume", critical, async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta({ talentXP: { dodge: 550 }, unlockedTalents: {} });
    await menu.openTalents();
    const portrait = page.getByRole("button", { name: "Select Dodge Talents" });
    const input = controllerInput(page);
    await input.activate(portrait, 50);

    const points = page.getByText(/^\d+ Talent Points? Remaining$/);
    const before = Number((await points.innerText()).match(/\d+/)![0]);
    for (const [name, key] of [
      ["Lightfoot", "Enter"],
      ["Catch Breath", "Space"],
    ]) {
      const node = page.getByRole("button").filter({ has: page.getByText(name, { exact: true }) });
      await input.reach(node, 50);
      await page.keyboard.press(key);
      await expect(
        page
          .locator(".talent-node")
          .filter({ has: page.getByText(name, { exact: true }) })
          .locator(".talent-card-unlocked"),
      ).toBeVisible();
    }
    await expect(points).toHaveText(`${before - 2} Talent Points Remaining`);
    await expect
      .poll(async () => (await readSavedGame(page)).unlockedTalents.dodge)
      .toEqual(["dodge-lightfoot", "dodge-catch-breath"]);
    await withSavedGame(page, async (resumed) => {
      await new MenuPage(resumed).openTalents();
      await resumed.getByRole("button", { name: "Select Dodge Talents" }).click();
      await expect(resumed.getByText(`${before - 2} Talent Points Remaining`, { exact: true })).toBeVisible();
      for (const name of ["Lightfoot", "Catch Breath"]) {
        await expect(resumed.getByText(name, { exact: true })).toBeVisible();
        await expect(resumed.getByRole("button").filter({ has: resumed.getByText(name, { exact: true }) })).toHaveCount(
          0,
        );
      }
    });
  });

  // Header stability and small-viewport description fit below belong to the
  // display-sizing layout owner; talents keeps navigation, reset, keyboard,
  // and node-geometry through unlock.
  test("spending the last talent point preserves node geometry", slow, async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta({ talentXP: { physical: 20 }, unlockedTalents: {} });
    await menu.openTalents();

    await page.getByRole("button", { name: "Select Physical Talents" }).click();
    const nodes = page.locator(".talent-node");
    await expect(nodes.first()).toBeVisible();

    const geometry = () =>
      nodes.evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }),
      );
    const scales = () => nodes.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).scale));
    // Park the mouse away from the tree so hover scale never colors the measurement.
    await page.mouse.move(0, 0);
    await expect.poll(async () => (await scales()).every((scale) => scale === "none")).toBe(true);
    const before = await geometry();
    expect(before.length).toBeGreaterThan(0);

    await page.getByRole("button", { name: /Expert Blacksmith/ }).click();
    await expect(page.getByText("1 Talent Point Remaining")).toBeHidden();
    await expect(
      nodes.filter({ has: page.getByText("Expert Blacksmith", { exact: true }) }).locator(".talent-card-unlocked"),
    ).toBeVisible();
    await page.mouse.move(0, 0);
    await expect.poll(scales).toEqual(before.map(() => "none"));

    const after = await geometry();
    expect(after).toHaveLength(before.length);
    for (const [index, rect] of after.entries()) {
      for (const dimension of ["x", "y", "width", "height"] as const) {
        expect(Math.abs(rect[dimension] - before[index]![dimension])).toBeLessThan(1);
      }
    }
  });
});
