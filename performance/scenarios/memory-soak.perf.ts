import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import { MenuPage } from "../../tests/pages/menu-page";
import { BattlePage } from "../../tests/pages/battle-page";
import { DestinationPage } from "../../tests/pages/destination-page";
import { RewardPage } from "../../tests/pages/reward-page";
import { injectExactSave } from "../../tests/e2e/save-injection";
import { assertJourneyCase } from "../journey-types";
import type { ScenarioRunResult } from "../report";
import { installRuntimeResourceProbe, requireSettledResources } from "../runtime-resources";
import { collectRuntimeSnapshot, expect, test } from "../fixtures";

const MEASURE_MS = Number.parseInt(process.env.PERF_MEASURE_MS ?? "1800000", 10);
const MIN_CYCLES = Number.parseInt(process.env.PERF_SOAK_MIN_CYCLES ?? "20", 10);

async function settleSave(page: Page) {
  await expect(page.getByText("Saving…", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Couldn’t save", { exact: true })).toHaveCount(0);
}
async function menu(page: Page) {
  const main = new MenuPage(page);
  if (await page.getByRole("button", { name: "Play", exact: true }).isVisible()) return;
  await page.getByRole("button", { name: "Open game menu", exact: true }).click();
  await page.getByTestId("game-menu").getByRole("button", { name: "Main Menu", exact: true }).click();
  await main.expectMainMenu();
}
async function progress(page: Page) {
  const continuation = page.getByRole("button", { name: "Continue", exact: true });
  if (await continuation.isVisible()) await continuation.click();
  else {
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("button", { name: "The Campaign", exact: true }).click();
    await page.getByRole("button", { name: "Select Knight", exact: true }).click();
    const novice = page.getByRole("button", { name: "Novice", exact: true });
    await expect(novice.or(page.getByTestId("battle-scene"))).toBeVisible();
    if (await novice.isVisible()) {
      await novice.click();
      await page.getByRole("button", { name: "Play", exact: true }).click();
    }
  }
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0);
  await settleSave(page);
  const battle = new BattlePage(page);
  if (await page.getByTestId("battle-scene").isVisible()) {
    await battle.waitForOpeningHand();
    const inspect = page.getByRole("button", { name: /^View Deck/ });
    await inspect.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    for (let count = 0; count < 3 && !(await battle.isBattleOver()); count++) {
      const card = battle.hand.filter({ visible: true }).first();
      if (!(await card.isEnabled().catch(() => false))) break;
      await card.click();
      await settleSave(page);
      const wish = page.locator(".wish-overlay-panel");
      for (let choice = 0; choice < 8 && (await wish.isVisible()); choice++) {
        await wish
          .getByRole("button", { name: /^Choose / })
          .first()
          .click();
        await settleSave(page);
      }
    }
    if (!(await battle.isBattleOver())) await battle.endTurn();
    await settleSave(page);
  } else if (await page.locator('[aria-label^="Select "]').first().isVisible()) {
    await new RewardPage(page).claimFirstReward();
    await settleSave(page);
  } else if (await page.getByRole("button", { name: /^Buy / }).first().isVisible()) {
    const buy = page.getByRole("button", { name: /^Buy / }).first();
    if (await buy.isEnabled()) {
      await buy.click();
      await settleSave(page);
    }
    await page.getByRole("button", { name: "Leave", exact: true }).click();
  } else if (await page.getByRole("button", { name: "Rest", exact: true }).isVisible()) {
    await page.getByRole("button", { name: "Rest", exact: true }).click();
    await settleSave(page);
  } else if (await continuation.isVisible()) await continuation.click();
  else {
    const destination = new DestinationPage(page);
    await destination.expectVisible();
    const options = page.getByRole("button", {
      name: /^(Card Shop|Gear Shop|Campfire|Combat|Elite Combat|Boss Combat)$/,
    });
    await options.first().click();
  }
  await settleSave(page);
}

// One profile/process, one initial checkpoint, no warmup reload or fixture reset.
test.describe("memory-soak", () => {
  test("developed gameplay and resource ownership survive repeated cycles", async ({ measureScenario }) => {
    if (process.env.PERF_RUNS && process.env.PERF_RUNS !== "1")
      throw new Error("memory-soak requires PERF_RUNS=1; repeat whole diagnostics separately");
    const directory = process.env.PERF_CASE_DIR;
    if (!directory) throw new Error("PERF_CASE_DIR is missing");
    const checkpoint: unknown = JSON.parse(
      fs.readFileSync(
        path.join(
          directory,
          fs.existsSync(path.join(directory, "memory-soak.case.json"))
            ? "memory-soak.case.json"
            : "meta-journey.case.json",
        ),
        "utf8",
      ),
    );
    assertJourneyCase(checkpoint);
    if (createHash("sha256").update(JSON.stringify(checkpoint.initialSave)).digest("hex") !== checkpoint.saveHash)
      throw new Error("Soak checkpoint hash mismatch");
    const recordedCycles = checkpoint.recordedActions?.filter((action) => action.name.startsWith("cycle:")).length;
    const samples: NonNullable<ScenarioRunResult["runtimeSamples"]> = [];
    await measureScenario({
      scenario: "memory-soak",
      profile: "transition",
      journeyCase: { ...checkpoint, scenario: "memory-soak" },
      segments: [{ name: "armory-cycle", minActions: MIN_CYCLES, minFrames: 180 }],
      warmup: false,
      timeoutMs: MEASURE_MS + 120_000,
      minFrames: Number.parseInt(process.env.PERF_MIN_FRAMES ?? "500", 10),
      collectRuntimeSamples: () => samples,
      collectObservations: async () => ({ cycles: Math.max(0, samples.length - 1), measureMs: MEASURE_MS }),
      setup: async (page) => {
        await installRuntimeResourceProbe(page);
        await injectExactSave(page, checkpoint.initialSave);
        if (!(await page.evaluate(() => window.alchemyDesktop?.isDesktop))) await page.goto("/");
        await menu(page);
        // Warm each persistent meta route once before the baseline. Gameplay
        // subsequently develops naturally; its memory growth remains diagnostic.
        for (const name of ["Collection", "Talents", "Armory"] as const) {
          await page.getByRole("button", { name, exact: true }).click();
          await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
          await menu(page);
        }
        await progress(page);
        await menu(page);
        samples.push({ cycle: 0, elapsedMs: 0, runtime: await collectRuntimeSnapshot(page) });
      },
      interact: async (page, phase, recordAction) => {
        const started = Date.now();
        let cycles = 0;
        while (recordedCycles ? cycles < recordedCycles : Date.now() - started < MEASURE_MS) {
          await phase("gameplay-cycle");
          await progress(page);
          await menu(page);
          await phase("armory-cycle");
          await page.getByRole("button", { name: "Armory", exact: true }).click();
          await expect(page.getByRole("heading", { name: "Armory", exact: true })).toBeVisible();
          // The earned run can reserve its hero's loadout; a spare hero may
          // change gear only when the actual UI offers a legal operation.
          const rogue = page.getByRole("button", { name: "Rogue", exact: true });
          if (await rogue.isEnabled()) await rogue.click();
          const body = page.getByRole("button", { name: /^Body/ });
          if (await body.count()) await body.first().click();
          const inventory = page.getByTestId("armory-inventory-item").first();
          if (await inventory.isVisible()) {
            const equip = inventory.getByRole("button").first();
            if (await equip.isEnabled()) {
              await equip.click();
              await settleSave(page);
            }
          }
          await menu(page);
          await expect(page.locator(".card-ghost-overlay, [data-testid='armory-transfer-overlay']")).toHaveCount(0);
          const runtime = await collectRuntimeSnapshot(page);
          requireSettledResources(runtime);
          samples.push({ cycle: ++cycles, elapsedMs: Date.now() - started, runtime });
          await recordAction(`cycle:${cycles}`);
        }
        expect(cycles).toBeGreaterThanOrEqual(MIN_CYCLES);
      },
    });
  });
});
