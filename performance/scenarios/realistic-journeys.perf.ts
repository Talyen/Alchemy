import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { gearItemLocator, selectArmorySlot } from "../../tests/e2e/armory";
import type { Page } from "@playwright/test";
import { BattlePage } from "../../tests/pages/battle-page";
import { DestinationPage } from "../../tests/pages/destination-page";
import { HomesteadPage } from "../../tests/pages/homestead-page";
import { MenuPage } from "../../tests/pages/menu-page";
import { RewardPage } from "../../tests/pages/reward-page";
import { ShopPage } from "../../tests/pages/shop-page";
import { injectExactSave } from "../../tests/e2e/save-injection";
import { waitForBattleReady } from "../battle-setup";
import { delay } from "../delay";
import { expect, test, type ScenarioId } from "../fixtures";
import { assertJourneyCase, type JourneyCase, type SegmentRequirement } from "../journey-types";

type Phase = (name: string) => Promise<void>;
type RecordAction = (name: string) => Promise<void>;

function readCase(scenario: string): JourneyCase {
  const dir = process.env.PERF_CASE_DIR;
  if (!dir) throw new Error("PERF_CASE_DIR is missing");
  const value: unknown = JSON.parse(fs.readFileSync(path.join(dir, `${scenario}.case.json`), "utf8"));
  assertJourneyCase(value);
  if (value.scenario !== scenario) throw new Error(`Wrong case for ${scenario}`);
  if (createHash("sha256").update(JSON.stringify(value.initialSave)).digest("hex") !== value.saveHash) {
    throw new Error(`Case checkpoint hash mismatch for ${scenario}`);
  }
  return value;
}

async function loadSave(page: Page, journeyCase: JourneyCase): Promise<void> {
  await injectExactSave(page, journeyCase.initialSave);
  const desktop = await page.evaluate(() => Boolean(window.alchemyDesktop?.isDesktop)).catch(() => false);
  if (!desktop) await page.goto("/");
}

async function record(name: string, action: () => Promise<unknown>, recordAction: RecordAction): Promise<void> {
  await action();
  await recordAction(name);
}

async function resolveWishChoices(page: Page, recordAction: RecordAction): Promise<void> {
  const panel = page.locator(".wish-overlay-panel");
  for (let index = 0; index < 8 && (await panel.isVisible().catch(() => false)); index++) {
    const choice = panel.getByRole("button", { name: /^Choose / }).first();
    const label = await choice.getAttribute("aria-label");
    await record(`wish:${label ?? index}`, () => choice.click(), recordAction);
    await delay(350);
  }
  if (await panel.isVisible().catch(() => false)) throw new Error("Wish choices did not settle");
}

async function playRealCombat(
  page: Page,
  phase: Phase,
  recordAction: RecordAction,
  journeyCase: JourneyCase,
  maxTurns = 3,
): Promise<void> {
  const battle = new BattlePage(page);
  await battle.waitForOpeningHand();
  let actions = 0;
  const expectedPlays = journeyCase.recordedActions?.filter((action) => action.name.startsWith("play:")) ?? [];
  let expectedPlayIndex = 0;
  for (let turn = 0; turn < maxTurns && !(await battle.isBattleOver()); turn++) {
    await phase("combat");
    for (let cardIndex = 0; cardIndex < 3 && !(await battle.isBattleOver()); cardIndex++) {
      const playable = battle.hand.filter({ visible: true });
      const count = await playable.count();
      const choices: Array<{ label: string; index: number }> = [];
      for (let index = 0; index < count; index++) {
        const card = playable.nth(index);
        if (await card.isEnabled().catch(() => false)) {
          choices.push({ label: (await card.getAttribute("aria-label")) ?? "", index });
        }
      }
      if (!choices.length) break;
      const expected = expectedPlays[expectedPlayIndex++];
      const choice = expected
        ? choices.find((candidate) => expected.name === `play:${candidate.label}`)
        : (choices.find((candidate) => /Block|Heal|Companion|Shield/.test(candidate.label)) ?? choices[0]);
      if (!choice) throw new Error(`Replay card unavailable: ${expected?.name}`);
      const card = playable.nth(choice.index);
      if (cardIndex === 0) await card.hover();
      await record(`play:${choice.label}`, () => card.click(), recordAction);
      actions++;
      await delay(350);
      await resolveWishChoices(page, recordAction);
    }
    if (await battle.isBattleOver()) break;
    await resolveWishChoices(page, recordAction);
    await phase("enemy-turn");
    await record("end-turn", () => battle.endTurn(), recordAction);
    actions++;
    await delay(300);
  }
  if (actions < 2) throw new Error("Journey combat ended before two player actions");
  await phase("combat");
  await delay(1200);
}

async function rewardRoute(page: Page, phase: Phase, recordAction: RecordAction): Promise<void> {
  await phase("reward");
  await record("claim-reward", () => new RewardPage(page).claimFirstReward(), recordAction);
  await phase("destination");
  const destination = new DestinationPage(page);
  await destination.expectVisible(15_000);
  const choice = page
    .getByRole("button", {
      name: /^(Combat|Elite Combat|Campfire|Card Shop|Trinket Shop|Gear Shop|Mystery|Corruption)$/,
    })
    .first();
  const label = (await choice.getAttribute("aria-label")) ?? (await choice.textContent()) ?? "destination";
  await record(`choose:${label.trim()}`, () => choice.click(), recordAction);
  await delay(800);
}

async function shopRoute(page: Page, phase: Phase, recordAction: RecordAction): Promise<void> {
  const shop = new ShopPage(page);
  await expect(shop.heading).toBeVisible();
  await phase("shop");
  const item = shop.buyBtn.filter({ visible: true }).first();
  await expect(item).toBeEnabled();
  await record(`buy:${(await item.getAttribute("aria-label")) ?? "card"}`, () => item.click(), recordAction);
  await delay(450);
  await phase("destination");
  await record("leave-shop", () => page.getByRole("button", { name: "Leave", exact: true }).click(), recordAction);
  await new DestinationPage(page).expectVisible(15_000);
  await delay(700);
}

async function labyrinthRoute(
  page: Page,
  phase: Phase,
  recordAction: RecordAction,
  journeyCase: JourneyCase,
): Promise<void> {
  await expect(page.getByRole("region", { name: "Labyrinth map" })).toBeVisible();
  await phase("explore");
  const room = page.getByRole("button", { name: /Combat chamber, reachable/ }).first();
  await record("inspect-chamber", () => room.click(), recordAction);
  await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeVisible();
  await record("fight-chamber", () => page.getByRole("button", { name: "Fight", exact: true }).click(), recordAction);
  await waitForBattleReady(page);
  await playRealCombat(page, phase, recordAction, journeyCase, 2);
}

async function wildwoodRoute(
  page: Page,
  phase: Phase,
  recordAction: RecordAction,
  journeyCase: JourneyCase,
): Promise<void> {
  await phase("draft");
  await expect(page.getByRole("heading", { name: "Draft a Deck" })).toBeVisible();
  for (let index = 0; index < 6; index++) {
    const choice = page.getByRole("button", { name: /^Select / }).first();
    await expect(choice).toBeVisible();
    await record(`draft:${(await choice.getAttribute("aria-label")) ?? index}`, () => choice.click(), recordAction);
  }
  await expect(page.getByRole("heading", { name: "Draft Complete" })).toBeVisible();
  await phase("boss-entry");
  await record("begin-boss", () => page.getByRole("button", { name: "Continue" }).click(), recordAction);
  await waitForBattleReady(page);
  await playRealCombat(page, phase, recordAction, journeyCase, 2);
}

async function metaRoute(page: Page, phase: Phase, recordAction: RecordAction): Promise<void> {
  const gameMenu = page.getByRole("button", { name: "Open game menu" });
  await gameMenu.click();
  await page.getByTestId("game-menu").getByRole("button", { name: "Main Menu", exact: true }).click();
  await new MenuPage(page).expectMainMenu(15_000);
  await phase("armory");
  await record("open-armory", () => page.getByRole("button", { name: "Armory", exact: true }).click(), recordAction);
  await expect(page.getByRole("heading", { name: "Armory" })).toBeVisible();
  const inventory = page.getByTestId("armory-inventory-item").first();
  if (await inventory.isVisible().catch(() => false))
    await record("inspect-gear", () => inventory.hover(), recordAction);
  await phase("homestead");
  await gameMenu.click();
  await record(
    "open-homestead",
    () => page.getByRole("button", { name: "Homestead", exact: true }).click(),
    recordAction,
  );
  const homestead = new HomesteadPage(page);
  await expect(homestead.heading).toBeVisible();
  await record("companions-tab", () => homestead.switchTab("Companions"), recordAction);
  await record("research-tab", () => homestead.switchTab("Research"), recordAction);
  await phase("talents");
  await gameMenu.click();
  await record("open-talents", () => page.getByRole("button", { name: "Talents", exact: true }).click(), recordAction);
  await expect(page.getByRole("heading", { name: "Talents" })).toBeVisible();
  await record(
    "physical-talents",
    () => page.getByRole("button", { name: "Select Physical Talents" }).click(),
    recordAction,
  );
  const talent = page.locator(".talent-node").first();
  await record("inspect-talent", () => talent.hover(), recordAction);
  await phase("collection");
  await gameMenu.click();
  await record(
    "open-collection",
    () => page.getByRole("button", { name: "Collection", exact: true }).click(),
    recordAction,
  );
  await expect(page.getByRole("heading", { name: "Collection" })).toBeVisible();
  await record("cards-tab", () => page.getByRole("button", { name: "Cards", exact: true }).click(), recordAction);
  const card = page.getByRole("button", { name: /Inspect/ }).first();
  await record("inspect-card", () => card.hover(), recordAction);
  await record("bestiary-tab", () => page.getByRole("button", { name: "Bestiary", exact: true }).click(), recordAction);
  await phase("options");
  await gameMenu.click();
  await record("open-options", () => page.getByRole("button", { name: "Options", exact: true }).click(), recordAction);
  await expect(page.getByRole("heading", { name: "Options" })).toBeVisible();
  await record("display-tab", () => page.getByRole("button", { name: "Display", exact: true }).click(), recordAction);
  await record("brightness", () => page.locator('input[type="range"]').first().fill("125"), recordAction);
  await delay(750);
}

async function resumeRoute(page: Page, phase: Phase, recordAction: RecordAction): Promise<void> {
  await phase("resume");
  await record(
    "continue-run",
    () => page.getByRole("button", { name: "Continue", exact: true }).first().click(),
    recordAction,
  );
  await waitForBattleReady(page);
  await delay(800);
}

async function uniqueArmoryRoute(page: Page, phase: Phase, recordAction: RecordAction): Promise<void> {
  await phase("unique-armory");
  await page.getByRole("button", { name: "Open game menu" }).click();
  await record(
    "open-armory",
    () => page.getByTestId("game-menu").getByRole("button", { name: "Armory", exact: true }).click(),
    recordAction,
  );
  await expect(page.getByRole("heading", { name: "Armory" })).toBeVisible();
  await record("main-hand-slot", () => selectArmorySlot(page, "main-hand"), recordAction);
  const unique = gearItemLocator(page, "Oathkeeper");
  await expect(unique).toBeVisible();
  await record("inspect-oathkeeper", () => unique.hover(), recordAction);
  await delay(500);
}

const SEGMENTS: Record<string, SegmentRequirement[]> = {
  "campaign-early": [
    { name: "combat", minActions: 1, minFrames: 45 },
    { name: "enemy-turn", minActions: 1, minFrames: 20 },
  ],
  "campaign-developed": [
    { name: "combat", minActions: 1, minFrames: 45 },
    { name: "enemy-turn", minActions: 1, minFrames: 20 },
  ],
  "trinket-journey": [
    { name: "combat", minActions: 1, minFrames: 45 },
    { name: "enemy-turn", minActions: 1, minFrames: 20 },
    { name: "unique-armory", minActions: 3, minFrames: 20 },
  ],
  "seeded-discovery": [
    { name: "combat", minActions: 1, minFrames: 45 },
    { name: "enemy-turn", minActions: 1, minFrames: 20 },
  ],
  "labyrinth-journey": [
    { name: "explore", minActions: 2, minFrames: 8 },
    { name: "combat", minActions: 1, minFrames: 45 },
  ],
  "wildwood-journey": [
    { name: "draft", minActions: 6, minFrames: 30 },
    { name: "boss-entry", minActions: 1, minFrames: 8 },
    { name: "combat", minActions: 1, minFrames: 45 },
  ],
  "reward-route": [
    { name: "reward", minActions: 1, minFrames: 8 },
    { name: "destination", minActions: 1, minFrames: 8 },
  ],
  "shop-journey": [
    { name: "shop", minActions: 1, minFrames: 8 },
    { name: "destination", minActions: 1, minFrames: 8 },
  ],
  "meta-journey": ["armory", "homestead", "talents", "collection", "options"].map((name) => ({
    name,
    minActions: name === "armory" ? 1 : 2,
    minFrames: 8,
  })),
  "resume-journey": [{ name: "resume", minActions: 1, minFrames: 30 }],
};

for (const scenario of Object.keys(SEGMENTS)) {
  test.describe(scenario, () => {
    test(`realistic ${scenario}`, async ({ measureScenario }) => {
      const journeyCase = readCase(scenario);
      await measureScenario({
        scenario: scenario as ScenarioId,
        profile: ["campaign-early", "campaign-developed", "trinket-journey", "seeded-discovery"].includes(scenario)
          ? "continuous"
          : "transition",
        minFrames: 45,
        journeyCase,
        segments: SEGMENTS[scenario],
        setup: async (page) => {
          await loadSave(page, journeyCase);
          if (scenario === "meta-journey") return;
          if (scenario === "resume-journey") {
            await page.getByRole("button", { name: "Open game menu" }).click();
            await page.getByRole("button", { name: "Main Menu", exact: true }).click();
            await new MenuPage(page).expectMainMenu();
            return;
          }
          if (["campaign-early", "campaign-developed", "trinket-journey", "seeded-discovery"].includes(scenario)) {
            await waitForBattleReady(page);
          }
        },
        interact: async (page, phase, recordAction) => {
          if (scenario === "labyrinth-journey") await labyrinthRoute(page, phase, recordAction, journeyCase);
          else if (scenario === "wildwood-journey") await wildwoodRoute(page, phase, recordAction, journeyCase);
          else if (scenario === "reward-route") await rewardRoute(page, phase, recordAction);
          else if (scenario === "shop-journey") await shopRoute(page, phase, recordAction);
          else if (scenario === "meta-journey") await metaRoute(page, phase, recordAction);
          else if (scenario === "resume-journey") await resumeRoute(page, phase, recordAction);
          else if (scenario === "trinket-journey") {
            await playRealCombat(page, phase, recordAction, journeyCase);
            await uniqueArmoryRoute(page, phase, recordAction);
          } else await playRealCombat(page, phase, recordAction, journeyCase);
        },
      });
    });
  });
}
