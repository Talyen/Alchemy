import { largeRunDeck } from "../scenario-data";
import { startPerfBattle } from "../battle-setup";
import { collectRuntimeSnapshot, expect, test } from "../fixtures";
import type { ScenarioRunResult } from "../report";

test.describe("large-deck", () => {
  test("repeatedly inspect and page the Draw Pile of a 60-card run", async ({ measureScenario }) => {
    let samples: NonNullable<ScenarioRunResult["runtimeSamples"]> = [];
    await measureScenario({
      scenario: "large-deck",
      profile: "transition",
      minFrames: 300,
      segments: [{ name: "deck-inspection", minActions: 20, minFrames: 180 }],
      collectRuntimeSamples: () => samples,
      collectObservations: async () => ({ fixtureDeckCards: 60, completedCycles: samples.length - 1 }),
      setup: async (page) => {
        samples = [];
        await startPerfBattle(page, largeRunDeck());
        samples.push({ cycle: 0, elapsedMs: 0, runtime: await collectRuntimeSnapshot(page) });
      },
      interact: async (page, phase, recordAction) => {
        const started = Date.now();
        for (let cycle = 1; cycle <= 20; cycle++) {
          await phase("deck-inspection");
          await page.getByTestId("draw-pile").getByRole("button").click();
          const dialog = page.getByRole("dialog", { name: "Draw Pile", exact: true });
          await expect(dialog).toBeVisible();
          const grid = dialog.getByTestId("card-selection-grid");
          await expect(grid.getByRole("button").first()).toBeVisible();
          for (let pageIndex = 0; pageIndex < 3; pageIndex++) {
            await dialog.getByRole("button", { name: "Next page", exact: true }).click();
            await grid.getByRole("button").first().hover();
          }
          await dialog.getByRole("button", { name: "Previous page", exact: true }).click();
          await page.keyboard.press("Escape");
          await expect(page.getByTestId("card-inspection-overlay")).toHaveCount(0);
          samples.push({ cycle, elapsedMs: Date.now() - started, runtime: await collectRuntimeSnapshot(page) });
          await recordAction(`deck-cycle:${cycle}`);
        }
      },
    });
  });
});
