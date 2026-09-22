import { controllerInput } from "../controller-input";
import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { MenuPage } from "../../pages/menu-page";
import { injectHomestead, injectTalentUnlocks } from "../save-injection";
import { critical, slow } from "../../playwright-tags";

test.describe("Talents Flow", () => {
  test("shows talent overview grid and navigates to keyword tree and back", critical, async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta();
    await menu.openTalents();

    await expect(page.getByRole("heading", { name: "Talents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Burn Talents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Physical Talents" })).toBeVisible();

    await page.getByRole("button", { name: "Select Burn Talents" }).click();
    await expect(page.getByRole("heading", { name: "Burn" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Talents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Burn Talents" })).toBeVisible();
  });

  test("reset talents button is disabled when empty and opens confirmation when allocated", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta();
    await menu.openTalents();

    const resetBtn = page.getByRole("button", { name: "Reset Talents" });
    await expect(resetBtn).toBeVisible();
    await expect(resetBtn).toBeDisabled();

    await injectHomestead(page);
    await injectTalentUnlocks(page, { physical: ["physical-expert-blacksmith"] });
    await page.goto("/");
    await menu.openTalents();

    await expect(resetBtn).toBeEnabled();
    await resetBtn.click();
    await expect(page.getByRole("heading", { name: "Reset Talents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  test("keyboard navigation unlocks consecutive talents without leaving the tree", critical, async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta({ talentXP: { dodge: 550 }, unlockedTalents: {} });
    await menu.openTalents();
    const portrait = page.getByRole("button", { name: "Select Dodge Talents" });
    const input = controllerInput(page);
    await input.activate(portrait, 50);

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
  });

  test("talent header stays put between overview and tree", slow, async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta();
    await menu.openTalents();

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Talents");
    const overviewY = await heading.evaluate((element) => element.getBoundingClientRect().y);

    await page.getByRole("button", { name: "Select Physical Talents" }).click();
    await expect(page.locator(".talent-node").first()).toBeVisible();
    await expect(heading).toHaveText("Physical");
    expect(await heading.evaluate((element) => element.getBoundingClientRect().y)).toBe(overviewY);
  });

  test("spending the last talent point preserves node geometry", slow, async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta({ talentXP: { physical: 10 }, unlockedTalents: {} });
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

    expect(await geometry()).toEqual(before);
  });

  test("long talent descriptions fit on a small viewport", slow, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta();
    await menu.openTalents();
    for (const [keyword, name] of [["Burn", "Wildfire"]]) {
      await page.getByRole("button", { name: `Select ${keyword} Talents`, exact: true }).click();
      const node = page.locator(".talent-node").filter({ has: page.getByText(name, { exact: true }) });
      await expect(node).toBeVisible();
      await expect
        .poll(
          () =>
            node.evaluate((element) => {
              const face = element.querySelector(".talent-card-face")!;
              const description = element.querySelector("p")!;
              const faceBounds = face.getBoundingClientRect();
              const textBounds = description.getBoundingClientRect();
              return (
                textBounds.bottom <= faceBounds.bottom &&
                textBounds.top >= faceBounds.top &&
                description.scrollHeight <= description.clientHeight + 1
              );
            }),
          { message: `${name} description fits its card` },
        )
        .toBe(true);
      await page.getByRole("button", { name: "Back", exact: true }).click();
    }
  });
});
