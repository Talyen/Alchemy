import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { MenuPage } from "../../pages/menu-page";

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
