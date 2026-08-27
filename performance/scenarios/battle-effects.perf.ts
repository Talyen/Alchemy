import { BattlePage } from "../../tests/pages/battle-page";
import { seedRandom } from "../../tests/e2e/rng";
import { test } from "../fixtures";
import { effectHeavyDeck } from "../scenario-data";
import { startPerfBattle } from "../battle-setup";
import { playDenseHand, runMeasuredEndTurn } from "../battle-helpers";
import { delay } from "../delay";

const MEASURE_MS = Number.parseInt(process.env.PERF_MEASURE_MS ?? "30000", 10);

test.describe("battle-effects", () => {
  test("battle-effects sustained FX", async ({ measureScenario }) => {
    await measureScenario({
      scenario: "battle-effects",
      profile: "continuous",
      minFrames: Number.parseInt(process.env.PERF_MIN_FRAMES ?? "300", 10),
      setup: async (page) => {
        await seedRandom(page, 42);
        await startPerfBattle(page, effectHeavyDeck(), {
          roomsEncountered: 100,
          runPlayerHealth: 999,
          runMaxHealth: 999,
        });
      },
      interact: async (page, phase) => {
        const battle = new BattlePage(page);
        const deadline = Date.now() + MEASURE_MS;
        let turnIndex = 0;
        while (Date.now() < deadline) {
          if (await battle.isBattleOver()) break;

          await phase("play-card");
          const played = await playDenseHand(page, battle, {
            maxCards: 8,
            betweenCardsMs: 180,
            afterBurstMs: 1000,
          });
          if (played === 0) {
            throw new Error("battle-effects: no cards played — hand was not playable");
          }
          await phase("damage-feedback");

          if (await battle.isBattleOver()) break;

          await runMeasuredEndTurn(page, battle, phase, turnIndex);
          turnIndex += 1;
          await delay(200);
        }
      },
    });
  });
});
