import { expect } from "@playwright/test";
import { bodyGear, gearItemLocator, openArmory } from "./e2e/armory";
import { test } from "./fixtures/e2e";
import { armory, slow } from "./playwright-tags";

test.describe("Armory flyover", { ...armory, ...slow }, () => {
  test("flyover lands at correct position on double-click equip", async ({ page }) => {
    await openArmory(page, [bodyGear]);

    const bodyItem = gearItemLocator(page, "Leather Armor");
    const bodySlot = page.locator('[data-testid="armory-equipment-slot"][data-slot="body"]');
    const flyover = page.getByTestId("armory-gear-drag-visual");

    // Capture the slot's bounding box before the flyover
    const slotBox = await bodySlot.boundingBox();
    expect(slotBox, "Slot should be visible").not.toBeNull();

    // Trigger the flyover via double-click on the inventory gear
    await bodyItem.dblclick();

    // Poll until the flyover's bounding box matches the slot's position.
    // The flyover starts at the source rect and animates to dest (~280ms),
    // then sits at dest for ~200ms before the cleanup timer removes it.
    // Polling from the start avoids the timing window between toBeAttached
    // and measurement that caused flakes with parallel workers.
    await expect
      .poll(
        async () => {
          const flyoverBox = await flyover.boundingBox();
          const slotBoxNow = await bodySlot.boundingBox();
          if (!flyoverBox || !slotBoxNow) return 99999;
          return Math.max(
            Math.abs(flyoverBox.x - slotBoxNow.x),
            Math.abs(flyoverBox.y - slotBoxNow.y),
            Math.abs(flyoverBox.width - slotBoxNow.width),
            Math.abs(flyoverBox.height - slotBoxNow.height),
          );
        },
        {
          message: `Slot at x=${Math.round(slotBox!.x)}, y=${Math.round(slotBox!.y)}, w=${Math.round(slotBox!.width)}, h=${Math.round(slotBox!.height)}`,
          timeout: 5000,
        },
      )
      .toBeLessThan(3);

    // Wait for the flyover to disappear (cleanup timer fires after 480ms)
    await expect(flyover).toHaveCount(0);

    // Verify the gear is now equipped in the slot
    await expect(bodySlot.locator("img")).toHaveCount(2);
    await expect(bodyItem).toHaveCount(0);
  });
});
