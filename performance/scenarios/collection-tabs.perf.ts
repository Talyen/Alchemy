import { MenuPage } from "../../tests/pages/menu-page";
import { delay } from "../delay";
import { expect, test } from "../fixtures";

const MEASURE_MS = Number.parseInt(process.env.PERF_MEASURE_MS ?? "15000", 10);

test.describe("collection-tabs", () => {
  test("collection tab swaps and tile hover", async ({ measureScenario }) => {
    await measureScenario({
      scenario: "collection-tabs",
      profile: "transition",
      minFrames: Number.parseInt(process.env.PERF_MIN_FRAMES ?? "250", 10),
      setup: async (page) => {
        const menu = new MenuPage(page);
        await menu.gotoWithUnlockedMeta({
          discoveredCardIds: ["slash", "bash", "block", "anvil", "meteor", "heal", "frostbolt"],
          encounteredEnemyIds: ["skeleton", "goblin", "slime", "mimic"],
          discoveredTrinketIds: ["lucky-clover", "smugglers-map", "bone-charm"],
        });
        await menu.openCollection();
      },
      interact: async (page, phase) => {
        const tabs = ["Bestiary", "Trinkets", "Cards", "Heroes"];
        const deadline = Date.now() + MEASURE_MS;
        let index = 0;
        while (Date.now() < deadline) {
          await phase("collection-tab-swap");
          await page.getByRole("button", { name: tabs[index % tabs.length]!, exact: true }).click();
          const tile = page.getByRole("button", { name: /Inspect/ }).first();
          if (await tile.isVisible().catch(() => false)) {
            await phase("collection-hover");
            await tile.hover();
          }
          index += 1;
          await delay(180);
        }
        await expect(page.getByRole("heading", { name: "Collection" })).toBeVisible();
      },
    });
  });
});
