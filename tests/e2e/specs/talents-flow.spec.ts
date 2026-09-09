import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { MenuPage } from "../../pages/menu-page";
import { injectHomestead, injectTalentUnlocks } from "../save-injection";
import { critical, slow } from "../../playwright-tags";

test.describe("Talents Flow", critical, () => {
  test("shows talent overview grid and navigates to keyword tree and back", async ({ page }) => {
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
    await expect(page.getByText("Reset Talents?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  test("keyboard navigation unlocks consecutive talents without leaving the tree", async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta({ talentXP: { dodge: 550 }, unlockedTalents: {} });
    await menu.openTalents();
    const portrait = page.getByRole("button", { name: "Select Dodge Talents" });
    await portrait.focus();
    await portrait.press("Enter");

    for (const [name, key] of [
      ["Lightfoot", "Enter"],
      ["Catch Breath", "Space"],
    ]) {
      const node = page.getByRole("button").filter({ has: page.getByText(name, { exact: true }) });
      await node.focus();
      await node.press(key);
      await expect(
        page
          .locator(".talent-node")
          .filter({ has: page.getByText(name, { exact: true }) })
          .locator(".talent-card-unlocked"),
      ).toBeVisible();
    }
  });

  test("long talent descriptions fit on a small viewport", slow, async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    await page.setViewportSize({ width: 1280, height: 720 });
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta();
    await menu.openTalents();
    for (const [keyword, name] of [
      ["Archery", "Follow-through"],
      ["Burn", "Wildfire"],
      ["Nature", "Briar Patch"],
    ]) {
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
