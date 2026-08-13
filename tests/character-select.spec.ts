import { expect, test } from "./fixtures/e2e";
import { MenuPage } from "./pages/menu-page";
import { critical } from "./playwright-tags";

test.describe("Character Select", critical, () => {
  test("hero portraits keep horizontal gaps between neighbors", async ({ page }) => {
    await new MenuPage(page).goToCharacterSelect();

    const portraits = page.getByRole("button", { name: /Select |\(Locked\)/ });
    await expect(portraits.first()).toBeVisible();
    const count = await portraits.count();
    expect(count).toBeGreaterThanOrEqual(4);

    const first = await portraits.nth(0).boundingBox();
    const second = await portraits.nth(1).boundingBox();
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    const gap = second!.x - (first!.x + first!.width);
    expect(gap).toBeGreaterThanOrEqual(16);
  });
});
