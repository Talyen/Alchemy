import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { MenuPage } from "../../pages/menu-page";

const replacements: Record<string, string[]> = {
  Companion: ["Coordinated Strike", "Fetch"],
  Leech: ["Affliction Siphon", "Sanguine Overflow", "Armor Siphon"],
  Mana: ["Dark Recovery"],
  Wish: ["Roads Not Taken", "Discovery", "Generous Wish"],
  Bleed: ["Bloodrush"],
  Dodge: ["Tailwind"],
  Archery: ["Follow-through"],
  Health: ["Clean Slate"],
  Gold: ["Coinmail"],
  Nature: ["Bramblegrowth", "Briar Patch"],
  Burn: ["Smoke Screen"],
  Block: ["Sun-Struck Shield"],
  Freeze: ["Glacial Barrier", "Thaw Dividend"],
};

for (const width of [1280, 1920]) {
  test(`Replacement talent descriptions fit at ${width}`, async ({ page, runtimeErrors }, testInfo) => {
    void runtimeErrors;
    await page.setViewportSize({ width, height: width === 1280 ? 720 : 1080 });
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta();
    await menu.openTalents();
    for (const [keyword, names] of Object.entries(replacements)) {
      await page.getByRole("button", { name: `Select ${keyword} Talents`, exact: true }).click();
      await expect(page.locator(".talent-node")).toHaveCount(10);
      for (const name of names) {
        const node = page.locator(".talent-node").filter({ has: page.getByText(name, { exact: true }) });
        await expect(node).toBeVisible();
        await expect(node.locator("p")).not.toContainText(/first time|once per|first .*each turn/i);
        const fits = await node.evaluate((element) => {
          const face = element.querySelector(".talent-card-face")!;
          const description = element.querySelector("p")!;
          const faceBounds = face.getBoundingClientRect();
          const textBounds = description.getBoundingClientRect();
          return textBounds.bottom <= faceBounds.bottom && textBounds.top >= faceBounds.top;
        });
        expect(fits, `${keyword}: ${name} description fits its card`).toBe(true);
      }
      if (keyword === "Leech" || keyword === "Nature") {
        await page.screenshot({
          path: testInfo.outputPath(`${keyword.toLowerCase()}-replacements.png`),
          fullPage: true,
        });
      }
      await page.getByRole("button", { name: "Back", exact: true }).click();
    }
  });
}
