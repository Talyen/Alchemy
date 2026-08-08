import { expect, test } from "@playwright/test";
import { bodyGear, gearItemLocator, openArmory, releaseDragAndCaptureSettleTop } from "./e2e/armory";
import { armory, slow } from "./playwright-tags";

/**
 * Raw-Playwright canary for the armory drag release animation — do not use the
 * e2e fixture here (it enables fastBattle). The settle spring is ~30-60ms,
 * faster than an out-of-page boundingBox round trip under parallel load, so the
 * settle frame is captured in-page at commit time via a MutationObserver.
 */
test.describe("Armory drag release animation", { ...armory, ...slow }, () => {
  test("drag visual does not snap to origin on release (settling)", async ({ page }) => {
    await openArmory(page, [bodyGear]);

    const bodyItem = gearItemLocator(page, "Leather Armor");
    const sourceBox = await bodyItem.boundingBox();
    expect(sourceBox).not.toBeNull();

    // 1. Move to center of item
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
    await page.mouse.down();

    // 2. Drag down by 50px
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2 + 50);

    const dragVisual = page.getByTestId("armory-gear-drag-visual");
    await expect(dragVisual).toBeVisible();

    // 3. Release and capture the settle visual's first frame in-page.
    const settleTop = await releaseDragAndCaptureSettleTop(page);
    expect(settleTop).not.toBeNull();

    // Since we released at Y offset 50, and it was dragged down, the visual
    // should start at/around the release position and animate towards the
    // destination. It should NOT have snapped back to the origin (Y offset
    // close to 0). Specifically, settleTop should be significantly greater
    // than sourceBox.y + 20. If the bug is present, it will snap to
    // sourceBox.y (the origin) instantly on release.
    expect(settleTop!).toBeGreaterThan(sourceBox!.y + 20);
  });
});
