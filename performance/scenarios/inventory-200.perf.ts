import { equipmentSlotLocator, openArmory } from "../../tests/e2e/armory";
import { readSavedGame } from "../../tests/e2e/save-injection";
import { extremeArmoryInventory } from "../scenario-data";
import { collectRuntimeSnapshot, expect, test } from "../fixtures";
import { installRuntimeResourceProbe, requireSettledResources } from "../runtime-resources";
import type { ScenarioRunResult } from "../report";

const CYCLES = 20;

test.describe("inventory-200", () => {
  test("search, filter, sort, page, equip and revisit 200 owned items", async ({ measureScenario }) => {
    let samples: NonNullable<ScenarioRunResult["runtimeSamples"]> = [];
    let probeInstalled = false;
    await measureScenario({
      scenario: "inventory-200",
      profile: "transition",
      warmup: false,
      timeoutMs: 600_000,
      minFrames: 300,
      segments: [{ name: "inventory-work", minActions: CYCLES, minFrames: 180 }],
      collectRuntimeSamples: () => samples,
      collectObservations: async () => ({
        fixtureItems: 200,
        fixtureDefinitions: 13,
        completedCycles: samples.length - 1,
      }),
      setup: async (page) => {
        samples = [];
        if (!probeInstalled) {
          await installRuntimeResourceProbe(page);
          probeInstalled = true;
        }
        await openArmory(page, { inventory: extremeArmoryInventory() });
        const save = await readSavedGame(page);
        expect(Object.values(save.gearInventories).flat()).toHaveLength(200);
        expect(
          new Set(
            Object.values(save.gearInventories)
              .flat()
              .map((item) => item.definitionId),
          ).size,
        ).toBe(13);
        samples.push({ cycle: 0, elapsedMs: 0, runtime: await collectRuntimeSnapshot(page) });
      },
      interact: async (page, phase, recordAction) => {
        const started = Date.now();
        for (let cycle = 1; cycle <= CYCLES; cycle++) {
          await phase("inventory-work");
          const category = [
            { slot: "main-hand", search: "sword" },
            { slot: "body", search: "armor" },
            { slot: "left-accessory", search: "ring" },
          ] as const;
          const { slot, search: query } = category[(cycle - 1) % category.length]!;
          const equipment = equipmentSlotLocator(page, slot).getByRole("button").first();
          if ((await equipment.getAttribute("aria-pressed")) !== "true") await equipment.click();
          await page.getByRole("button", { name: "Search inventory", exact: true }).click();
          const search = page.getByRole("searchbox", { name: "Search inventory", exact: true });
          await search.pressSequentially(query);
          await expect(page.getByTestId("armory-inventory-item").first()).toBeVisible();
          await page.getByRole("button", { name: "Close inventory search", exact: true }).click();
          await page.getByRole("button", { name: "Filters", exact: true }).click();
          const filters = page.getByRole("dialog", { name: "Inventory filters", exact: true });
          await filters.getByRole("button", { name: "Basic", exact: true }).click();
          await filters.getByRole("button", { name: "Clear filters", exact: true }).click();
          await page.keyboard.press("Escape");
          await page.getByRole("button", { name: "Sort inventory", exact: true }).click();
          await page
            .getByRole("dialog", { name: "Sort inventory", exact: true })
            .getByRole("button", { name: cycle % 2 ? "Name" : "Rarity", exact: true })
            .click();
          await page.getByRole("button", { name: "Next page", exact: true }).click();
          const first = page.getByTestId("armory-inventory-item").first();
          await expect.poll(() => first.evaluate((element) => !element.closest("[inert]"))).toBe(true);
          const instanceId = await first.getAttribute("data-instance-id");
          if (!instanceId) throw new Error("Missing inventory item identity");
          const item = page.locator(
            `[data-testid="armory-inventory-item"][data-instance-id=${JSON.stringify(instanceId)}]`,
          );
          await item.hover();
          await item.getByRole("button").first().click();
          await expect.poll(async () => (await readSavedGame(page)).gearLoadouts.knight[slot]).toBe(instanceId);
          await expect(page.getByTestId("armory-transfer-overlay")).toHaveCount(0);
          await page.getByRole("button", { name: "Open game menu", exact: true }).click();
          await page.getByRole("button", { name: "Main Menu", exact: true }).click();
          await page.getByRole("button", { name: "Armory", exact: true }).click();
          await expect(page.getByRole("heading", { name: "Armory", exact: true })).toBeVisible();
          await expect(page.getByTestId("armory-transfer-overlay")).toHaveCount(0);
          const runtime = await collectRuntimeSnapshot(page);
          requireSettledResources(runtime);
          samples.push({ cycle, elapsedMs: Date.now() - started, runtime });
          await recordAction(`inventory-cycle:${cycle}`);
        }
      },
    });
  });
});
