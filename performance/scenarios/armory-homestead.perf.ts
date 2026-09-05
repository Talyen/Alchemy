import { openArmory, selectArmorySlot } from "../../tests/e2e/armory";
import { HomesteadPage } from "../../tests/pages/homestead-page";
import { largeArmoryInventory } from "../scenario-data";
import { delay } from "../delay";
import { expect, test } from "../fixtures";

const MEASURE_MS = Number.parseInt(process.env.PERF_MEASURE_MS ?? "15000", 10);

test.describe("armory-homestead", () => {
  test("armory inventory, homestead tabs, and shared menu transitions", async ({ measureScenario }) => {
    await measureScenario({
      scenario: "armory-homestead",
      profile: "transition",
      minFrames: Number.parseInt(process.env.PERF_MIN_FRAMES ?? "250", 10),
      setup: async (page) => {
        await openArmory(page, { inventory: largeArmoryInventory() });
      },
      interact: async (page, phase) => {
        const deadline = Date.now() + MEASURE_MS;
        const slots = ["main-hand", "off-hand", "body", "left-accessory", "right-accessory"] as const;
        const homestead = new HomesteadPage(page);
        let index = 0;

        while (Date.now() < deadline) {
          await phase("armory-slot-and-inventory");
          await selectArmorySlot(page, slots[index % slots.length]!);
          const inventoryItem = page.getByTestId("armory-inventory-item").nth(index % 6);
          if (await inventoryItem.isVisible().catch(() => false)) await inventoryItem.hover();

          await phase("armory-to-homestead");
          await page.getByRole("button", { name: "Open game menu" }).click();
          await page.getByRole("button", { name: "Homestead", exact: true }).click();
          await expect(homestead.heading).toBeVisible();

          await phase("homestead-tab-swap");
          await homestead.switchTab(index % 2 === 0 ? "Research" : "Companions");

          await phase("homestead-to-armory");
          await page.getByRole("button", { name: "Open game menu" }).click();
          await page.getByRole("button", { name: "Armory", exact: true }).click();
          await expect(page.getByRole("heading", { name: "Armory" })).toBeVisible();

          index += 1;
          await delay(180);
        }
      },
    });
  });
});
