import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { MenuPage } from "../../pages/menu-page";
import { slow } from "../../playwright-tags";

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
