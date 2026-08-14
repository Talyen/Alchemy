import { test } from "./fixtures/e2e";
import { assertHorizontalNeighborGap } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { critical } from "./playwright-tags";

test.describe("Character Select", critical, () => {
  test("hero portraits keep horizontal gaps between neighbors", async ({ page }) => {
    await new MenuPage(page).goToCharacterSelect();

    await assertHorizontalNeighborGap(page.getByRole("button", { name: /Select |\(Locked\)/ }), { minCount: 4 });
  });
});
