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

    // Wait for the flyover element to appear (it's mounted immediately by React)
    await expect(flyover).toBeAttached({ timeout: 3000 });

    // The flyover animation duration is 280ms. Wait for it to finish,
    // then measure before the cleanup timer (480ms total).
    await page.waitForTimeout(350);

    // Measure position of both flyover and slot
    const flyoverBox = await flyover.boundingBox();
    const slotBoxNow = await bodySlot.boundingBox();
    const ref = slotBoxNow ?? slotBox!;

    expect(flyoverBox, "Flyover must be visible during measurement").not.toBeNull();
    const maxDiff = Math.max(
      Math.abs(flyoverBox!.x - ref.x),
      Math.abs(flyoverBox!.y - ref.y),
      Math.abs(flyoverBox!.width - ref.width),
      Math.abs(flyoverBox!.height - ref.height),
    );
    expect(maxDiff, `Flyover vs slot: x=${flyoverBox!.x}, y=${flyoverBox!.y}, w=${flyoverBox!.width}, h=${flyoverBox!.height} | slot: x=${ref.x}, y=${ref.y}, w=${ref.width}, h=${ref.height}`).toBeLessThan(0.5);

    // Wait for the flyover to disappear (cleanup timer fires after 480ms)
    await expect(flyover).toHaveCount(0);

    // Verify the gear is now equipped in the slot
    await expect(bodySlot.locator("img")).toHaveCount(2);
    await expect(bodyItem).toHaveCount(0);
  });
});
