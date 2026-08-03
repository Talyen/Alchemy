import { expect } from "@playwright/test";
import { openArmory, pointerDrag, gearItemLocator } from "../../tests/e2e/armory";
import { test } from "../fixtures";
import { largeArmoryInventory } from "../scenario-data";
import { delay } from "../delay";

const MEASURE_MS = Number.parseInt(process.env.PERF_MEASURE_MS ?? "25000", 10);

test.describe("armory-drag", () => {
  test("armory-drag scroll and drag", async ({ measureScenario }) => {
    await measureScenario({
      scenario: "armory-drag",
      profile: "continuous",
      minFrames: Number.parseInt(process.env.PERF_MIN_FRAMES ?? "250", 10),
      setup: async (page) => {
        await openArmory(page, { inventory: largeArmoryInventory(40) });
        await expect(page.getByTestId("armory-inventory-item").first()).toBeVisible();
      },
      interact: async (page, phase) => {
        const board = page.getByTestId("armory-inventory-board");
        const deadline = Date.now() + MEASURE_MS;
        let cycle = 0;

        while (Date.now() < deadline) {
          await phase("armory-scroll");
          await board.evaluate((el) => {
            el.scrollTop = (el.scrollTop + 120) % Math.max(el.scrollHeight - el.clientHeight, 1);
          });
          await delay(80);

          await phase("armory-drag");
          const items = page.getByTestId("armory-inventory-item");
          const count = await items.count();
          if (count >= 2) {
            const source = items.nth(cycle % count);
            const target = items.nth((cycle + 1) % count);
            const sourceBox = await source.boundingBox();
            const targetBox = await target.boundingBox();
            if (sourceBox && targetBox) {
              await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
              await page.mouse.down();
              await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
                steps: 24,
              });
              await page.mouse.up();
            } else {
              await pointerDrag(page, source, target).catch(() => undefined);
            }
          }

          const helm = gearItemLocator(page, "Leather Helm").first();
          if (await helm.isVisible().catch(() => false)) {
            const helmSlot = page.locator('[data-testid="armory-equipment-slot"][data-slot="helm"]');
            await pointerDrag(page, helm, helmSlot).catch(() => undefined);
          }

          cycle += 1;
          await delay(50);
        }
      },
    });
  });
});
