import { BattlePage } from "../../tests/pages/battle-page";
import { seedRandom } from "../../tests/e2e/rng";
import { test } from "../fixtures";
import { weakEndTurnDeck } from "../scenario-data";
import { startPerfBattle } from "../battle-setup";
import { waitForCardPlayFx, runMeasuredEndTurn, waitForHandPlayable, playHandCard } from "../battle-helpers";
import { delay } from "../delay";

const MEASURE_MS = Number.parseInt(process.env.PERF_MEASURE_MS ?? "30000", 10);

test.describe("battle-end-turn", () => {
  test("battle-end-turn transitions", async ({ measureScenario }) => {
    await measureScenario({
      scenario: "battle-end-turn",
      profile: "transition",
      minFrames: Number.parseInt(process.env.PERF_MIN_FRAMES ?? "200", 10),
      setup: async (page) => {
        await seedRandom(page, 42);
        await startPerfBattle(page, weakEndTurnDeck());
      },
      interact: async (page, phase) => {
        const battle = new BattlePage(page);
        const deadline = Date.now() + MEASURE_MS;
        let turnIndex = 0;
        while (Date.now() < deadline) {
          if (await battle.isBattleOver()) break;

          await phase("play-card");
          if ((await battle.handCount()) > 0) {
            await waitForHandPlayable(page);
            await playHandCard(page, 0);
            await waitForCardPlayFx(page, { lingerMs: 500 });
          }

          await runMeasuredEndTurn(page, battle, phase, turnIndex);
          turnIndex += 1;
        }
      },
    });
  });
});
