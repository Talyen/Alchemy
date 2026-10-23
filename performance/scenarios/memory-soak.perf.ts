import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import { MenuPage } from "../../tests/pages/menu-page";
import { BattlePage } from "../../tests/pages/battle-page";
import { DestinationPage } from "../../tests/pages/destination-page";
import { RewardPage } from "../../tests/pages/reward-page";
import { injectExactSave } from "../../tests/e2e/save-injection";
import { DESTINATIONS } from "../../src/lib/routing/destinations";
import { waitForBattleReady } from "../battle-setup";
import { waitForCombatDecision } from "../combat-decision";
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
  const logo = page.getByRole("img", { name: "Alchemy logo", exact: true });
  if (!(await logo.isVisible())) {
    await page.getByRole("button", { name: "Open game menu", exact: true }).click();
    await page.getByTestId("game-menu").getByRole("button", { name: "Main Menu", exact: true }).click();
  }
  await main.expectMainMenu();
  await expect.poll(() => logo.evaluate((element) => !element.closest("[inert]"))).toBe(true);
}
async function progress(page: Page) {
  const continuation = page.getByRole("button", { name: "Continue", exact: true });
  const destination = new DestinationPage(page);
  const destinations = Object.values(DESTINATIONS)
    .filter((name) => name !== DESTINATIONS.MYSTERY)
    .map((name) => destination.destinationButton(name))
    .reduce((all, option) => all.or(option));
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
  // Continue remains visible in the outgoing menu during its exit fade.
  // Branch only after the resumed activity replaces it, or we can click it twice.
  await expect(page.getByRole("img", { name: "Alchemy logo", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0);
  // The outgoing menu can unmount one frame before the activity mounts.
  // Wait for a supported activity instead of guessing Destination in that gap.
  await expect
    .poll(
      async () =>
        (await page.getByTestId("battle-scene").isVisible()) ||
        (await page.locator('[aria-label^="Select "]').first().isVisible()) ||
        (await page.getByRole("button", { name: /^Buy / }).first().isVisible()) ||
        (await page.getByRole("button", { name: "Rest", exact: true }).isVisible()) ||
        (await page.getByRole("button", { name: "Leave", exact: true }).isVisible()) ||
        (await continuation.isVisible()) ||
        (await destinations.first().isVisible()) ||
        (await page.getByRole("heading", { name: "Choose Destination", exact: true }).isVisible()),
      { timeout: 15_000 },
    )
    .toBe(true);
  await settleSave(page);
  const battle = new BattlePage(page);
  if (await page.getByTestId("battle-scene").isVisible()) {
    await waitForBattleReady(page);
    const inspect = page.getByTestId("draw-pile").getByRole("button");
    await inspect.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    const settleCombat = () =>
      waitForCombatDecision(page, battle, async () => {
        const wish = page.locator(".wish-overlay-panel");
        for (let choice = 0; choice < 8 && (await wish.isVisible()); choice++) {
          await wish
            .getByRole("button", { name: /^Choose / })
            .first()
            .click();
          await settleSave(page);
        }
        await expect(wish).toHaveCount(0);
      });
    for (let count = 0; count < 3; count++) {
      // Saving can settle before the played card finishes damage or victory.
      // Observe the next decision before choosing another moving hand target.
      await settleCombat();
      if (await battle.isBattleOver()) break;
      const card = battle.hand.filter({ visible: true }).first();
      if (!(await card.isEnabled().catch(() => false))) break;
      await card.click();
      await settleSave(page);
    }
    await settleCombat();
    if (!(await battle.isBattleOver())) await battle.endTurn();
    await settleSave(page);
  } else if (
    (await page.getByRole("button", { name: "Leave", exact: true }).isVisible()) &&
    !(await page.getByRole("button", { name: /^Buy / }).first().isVisible())
  ) {
    // Decline optional alterations through their normal exit. Mystery needs a
    // separate choice policy, so the destination policy prefers other visits.
    await page.getByRole("button", { name: "Leave", exact: true }).click();
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
    await destination.expectVisible();
    await destinations.first().click();
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
        expect(samples.at(-1)!.runtime.completedSfx ?? 0).toBeGreaterThan(samples[0]!.runtime.completedSfx ?? 0);
      },
    });
  });
});
