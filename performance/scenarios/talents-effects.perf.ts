import { MenuPage } from "../../tests/pages/menu-page";
import { delay } from "../delay";
import { expect, test } from "../fixtures";

const MEASURE_MS = Number.parseInt(process.env.PERF_MEASURE_MS ?? "15000", 10);

test.describe("talents-effects", () => {
  test("talent tree hover, node states, and keyword transitions", async ({ measureScenario }) => {
    await measureScenario({
      scenario: "talents-effects",
      profile: "continuous",
      minFrames: Number.parseInt(process.env.PERF_MIN_FRAMES ?? "250", 10),
      setup: async (page) => {
        const menu = new MenuPage(page);
        await menu.gotoWithUnlockedMeta({ talentXP: { physical: 500, burn: 500, freeze: 500, mana: 500 } });
        await menu.openTalents();
      },
      interact: async (page, phase) => {
        const keywords = ["Physical", "Burn", "Freeze", "Mana"];
        const deadline = Date.now() + MEASURE_MS;
        let index = 0;
        while (Date.now() < deadline) {
          await phase("talent-keyword-swap");
          await page.getByRole("button", { name: keywords[index % keywords.length]!, exact: true }).click();
          const talent = page.locator('[role="button"][aria-label^="Unlock talent:"]').first();
          if (await talent.isVisible().catch(() => false)) {
            await phase("talent-hover");
            await talent.hover();
          }
          index += 1;
          await delay(250);
        }
        await expect(page.getByRole("heading", { name: "Talents" })).toBeVisible();
      },
    });
  });
});
