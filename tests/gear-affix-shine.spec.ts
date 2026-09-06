import { expect, test, type Locator } from "@playwright/test";
import { equipmentSlotLocator, gearItemLocator, openArmory, selectArmorySlot } from "./e2e/armory";
import type { GearInstance } from "@/lib/gear";

const danceOfBlades: GearInstance = {
  instanceId: "shine-dance",
  definitionId: "dance-of-blades",
  affixes: [
    { id: "dance-of-blades", value: 1 },
    { id: "flat-physical", value: 4 },
    { id: "armor-on-cc", value: 4 },
    { id: "start-armor", value: 6 },
  ],
};

async function expectAffixColors(panel: Locator) {
  for (const [name, colors] of [
    ["Dance of Blades", ["rgb(251, 191, 36)"]],
    ["Stalwart", ["rgb(156, 163, 175)", "rgb(252, 211, 77)", "rgb(103, 232, 249)"]],
    ["Bladedance", ["rgb(190, 242, 100)"]],
    ["Ironbound", ["rgb(203, 213, 225)"]],
  ] as const) {
    const title = panel.getByText(name, { exact: true });
    await expect(title).toBeVisible();
    const gradient = await title.evaluate((element) => getComputedStyle(element).backgroundImage);
    for (const color of colors) expect(gradient).toContain(color);
    if (name !== "Dance of Blades") {
      expect(gradient).not.toContain("rgb(251, 191, 36)");
      expect(gradient).not.toContain("rgb(217, 119, 6)");
    }
  }
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`Unique affix colors survive the shine animation with motion ${reducedMotion}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion });
    await openArmory(page, [danceOfBlades]);
    await selectArmorySlot(page, "body");
    const item = gearItemLocator(page, "Dance of Blades");
    await item.hover();
    const panel = page.locator("#tooltip-root .hover-popup-panel");
    await expectAffixColors(panel);
    const stalwart = panel.getByText("Stalwart", { exact: true });
    if (reducedMotion === "no-preference") {
      const start = await stalwart.evaluate((element) => getComputedStyle(element).backgroundPosition);
      await expect
        .poll(() => stalwart.evaluate((element) => getComputedStyle(element).backgroundPosition))
        .not.toBe(start);
      for (const fraction of [0, 0.25, 0.5, 0.75]) {
        await panel.locator(".boss-title-shine").evaluateAll((elements, phase) => {
          for (const element of elements) {
            for (const animation of element.getAnimations()) {
              animation.pause();
              animation.currentTime = Number(animation.effect?.getTiming().duration) * phase;
            }
          }
        }, fraction);
        await expectAffixColors(panel);
        await panel.screenshot({
          path: `reports/gear-shine/${testInfo.project.name}-${fraction}.png`,
          animations: "allow",
        });
      }
    } else {
      await expect(stalwart).toHaveCSS("animation-duration", "0.001s");
      await panel.screenshot({ path: `reports/gear-shine/${testInfo.project.name}-reduced.png` });
    }
    await item.click();
    await page.mouse.move(0, 0);
    await expect(panel).toHaveCount(0);
    await equipmentSlotLocator(page, "body").hover();
    await expectAffixColors(panel);
    expect(errors).toEqual([]);
  });
}
