import { injectLabyrinthRun } from "../../tests/e2e/save-injection";
import { productionHexLabyrinthMapFixture } from "../../tests/fixtures/labyrinth-hex-map";
import { delay } from "../delay";
import { expect, test } from "../fixtures";

const MEASURE_MS = Number.parseInt(process.env.PERF_MEASURE_MS ?? "15000", 10);

test.describe("labyrinth-interactions", () => {
  test("labyrinth node inspection, floor swaps, and scrolling", async ({ measureScenario }) => {
    await measureScenario({
      scenario: "labyrinth-interactions",
      profile: "transition",
      minFrames: Number.parseInt(process.env.PERF_MIN_FRAMES ?? "250", 10),
      setup: async (page) => {
        await injectLabyrinthRun(page, { resume: true, labyrinthMap: productionHexLabyrinthMapFixture() });
        await expect(page.getByRole("region", { name: "Labyrinth map" })).toBeVisible();
        await expect(page.getByRole("combobox", { name: "Floor", exact: true })).toBeVisible();
      },
      interact: async (page, phase) => {
        const nodes = page.getByRole("button", { name: /chamber/i, disabled: false });
        const floorPicker = page.getByRole("combobox", { name: "Floor", exact: true });
        const deadline = Date.now() + MEASURE_MS;
        let index = 0;

        while (Date.now() < deadline) {
          const nodeCount = await nodes.count();
          if (nodeCount > 0) {
            await phase("labyrinth-node-inspect");
            const node = nodes.nth(index % nodeCount);
            await node.hover();
            await node.click();
            await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeVisible();
            await page.keyboard.press("Escape");
          }

          await phase("labyrinth-scroll");
          await page.mouse.wheel(0, index % 2 === 0 ? 420 : -420);

          await phase("labyrinth-floor-swap");
          await floorPicker.click();
          await page.getByRole("option", { name: `Floor ${(index % 2) + 1}`, exact: true }).click();

          index += 1;
          await delay(180);
        }
      },
    });
  });
});
