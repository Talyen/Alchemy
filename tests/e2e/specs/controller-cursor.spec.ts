import { test } from "../../fixtures/e2e";
import { exerciseControllerCursor } from "../controller-cursor";

// Native focus, pointer targeting and overflow must agree in a real renderer.
test("mapped cursor clicks, hover inspection and wheel scrolling work together", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await exerciseControllerCursor(page);
});
