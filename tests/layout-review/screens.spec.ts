import { savedActivityFixture } from "../fixtures/run-activity";
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { launchElectronApp, getElectronMainWindow } from "../electron/electron-helpers";
import { MenuPage } from "../pages/menu-page";
import { DestinationPage } from "../pages/destination-page";
import { CorruptionPage } from "../pages/corruption-page";
import { captureMatrix, frontmostApp, output, type CaptureOptions } from "./capture";
import fs from "node:fs";
import path from "node:path";
import {
  injectHomestead,
  injectActiveBattle,
  injectSaveState,
  injectLabyrinthRun,
  injectBossState,
  injectMysterySummaryVisit,
  enterPrimaryRewardScreen,
  makeCard,
  makeGoblinBattleState,
  makeStartingDeck,
  startAtDestination,
  winBattleAndClaimReward,
  waitForLayoutSettled,
  failOnRuntimeErrors,
} from "../browser-helpers";
import { openArmory, bodyGear, selectArmorySlot, gearItemLocator } from "../e2e/armory";

let application: ElectronApplication;
let page: Page;
let foreground: string | null;
let runtimeErrors: string[];
const shot = (name: string, options?: CaptureOptions) => captureMatrix(page, application, name, options);
const click = (name: string) => page.getByRole("button", { name, exact: true }).click();
const deck = Array.from({ length: 24 }, (_, index) =>
  makeCard({ id: ["slash", "block", "bash", "apple", "meteor", "anvil"][index % 6], uid: index + 100 }),
);

test.beforeEach(async () => {
  foreground = frontmostApp();
  process.env.PLAYWRIGHT_ELECTRON_PREVIEW_PORT ??= "4277";
  application = await launchElectronApp({ background: true });
  page = await getElectronMainWindow(application);
  runtimeErrors = failOnRuntimeErrors(page);
  await page.addInitScript((loading) => {
    if (loading) localStorage.removeItem("alchemy-skip-loading-screen");
    else localStorage.setItem("alchemy-skip-loading-screen", "true");
    localStorage.setItem("alchemy-disable-animations", "true");
  }, test.info().title === "loading screen");
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1470, 738));
  await page.setViewportSize({ width: 1470, height: 738 });
  await page.reload();
  await new MenuPage(page).expectMainMenuAfterColdStart(60_000);
});

test.afterEach(async () => {
  const current = frontmostApp();
  await application?.close();
  const afterClose = frontmostApp();
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(
    path.join(output, `foreground-${test.info().title.replaceAll(/\W/g, "-")}.json`),
    JSON.stringify({ before: foreground, during: current, afterClose }),
  );
  // User switching apps is allowed; the game must never be the foreground app.
  expect(current).not.toBe("com.github.Electron");
  expect(afterClose).not.toBe("com.github.Electron");
  expect(runtimeErrors).toEqual([]);
});

test("menus and meta screens", async () => {
  await injectHomestead(page, {
    discoveredCardIds: ["slash", "block", "bash", "apple", "meteor", "anvil", "plate-mail", "blessed-aegis"],
    encounteredEnemyIds: ["goblin", "forge-golem", "frostwarden", "blight-treant"],
    discoveredTrinketIds: ["tattered-pages", "companions-collar", "brass-censer"],
    ownedTrinketIds: ["tattered-pages", "companions-collar", "brass-censer"],
    talentXP: { physical: 100, fire: 100, holy: 100 },
  });
  await new MenuPage(page).expectMainMenu();
  await shot("menu");
  await click("Collection");
  for (const tab of ["Cards", "Heroes", "Bestiary", "Trinkets", "Uniques"]) {
    const button = page.getByRole("button", { name: tab, exact: true });
    await expect(button).toBeVisible();
    await button.click();
    await waitForLayoutSettled(page);
    await shot(`collection-${tab.toLowerCase().replaceAll(" ", "-")}`);
  }
  await click("Back");
  await click("Homestead");
  for (const tab of ["Buildings", "Farm", "Research", "Companions"]) {
    await click(tab);
    await waitForLayoutSettled(page);
    await shot(`homestead-${tab.toLowerCase()}`);
  }
  await click("Back");
  await click("Talents");
  await shot("talents-overview");
  await page
    .getByRole("button", { name: /Physical/ })
    .first()
    .click();
  await shot("talents-physical-tree");
});

test("options and confirmations", async () => {
  await click("Options");
  for (const tab of ["Display", "Sound", "Gameplay", "Other"]) {
    await click(tab);
    await shot(`options-${tab.toLowerCase()}`);
  }
  await click("Clear Save Data");
  await expect(page.getByRole("dialog")).toBeVisible();
  await shot("confirmation-clear-save");
  await click("Cancel");
  await click("Display");
  for (const name of ["Aspect Ratio", "Display Mode"]) {
    await shot(`options-${name.toLowerCase().replaceAll(" ", "-")}-dropdown`, {
      prepare: async () => {
        await page.getByRole("combobox", { name, exact: true }).click();
        await expect(page.getByRole("listbox")).toBeVisible();
      },
      cleanup: () => page.keyboard.press("Escape"),
    });
  }
});

test("run setup and draft", async () => {
  await injectHomestead(page, { completedDifficulties: { knight: ["difficulty-1"] } });
  await new MenuPage(page).openGameModeSelect();
  await shot("game-mode-select");
  await click("The Campaign");
  await shot("character-select");
  await click("Select Knight");
  await expect(page.getByRole("heading", { name: "A Knight's Journey" })).toBeVisible();
  await shot("difficulty-select");
  await injectSaveState(page, {
    contentSystemType: "wildwood",
    selectedDifficulty: null,
    runDeck: makeStartingDeck().slice(0, 5),
    wildwoodDraft: {
      phase: "draft",
      draftChoices: [makeCard(), makeCard({ id: "block" }), makeCard({ id: "bash" })],
      remainingBossIds: [],
      previousBossId: null,
      currentBossId: null,
      currentCombatTraitIds: [],
      currentRewardTraitIds: [],
    },
    activity: savedActivityFixture("draft-deck"),
  });
  await expect(page.getByRole("heading", { name: "Draft a Deck" })).toBeVisible();
  await shot("draft-deck");
  await page
    .getByRole("button", { name: /^Select / })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Draft Complete" })).toBeVisible();
  await shot("draft-complete");
});

test("battle and inspection overlays", async () => {
  await injectActiveBattle(
    page,
    makeGoblinBattleState({
      hand: deck.slice(0, 12),
      deck: deck.slice(12),
      discard: [makeCard()],
      exhausted: [makeCard({ id: "apple" })],
    }),
    { runDeck: deck, runBoons: ["brass-censer", "tattered-pages"] },
  );
  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await shot("battle-large-hand");
  await shot("battle-card-hover", {
    prepare: () =>
      page
        .getByRole("button", { name: /^Play / })
        .last()
        .hover(),
  });
  for (const [pattern, name] of [
    [/^View Deck/, "deck-inspection"],
    [/^Inspect Draw Pile/, "draw-pile-inspection"],
    [/^Inspect Discard Pile/, "discard-pile-inspection"],
    [/^Inspect Boons/, "boon-inspection"],
  ] as const) {
    await page.getByRole("button", { name: pattern }).click();
    await shot(name);
    await page.keyboard.press("Escape");
  }
  await click("Open game menu");
  await shot("game-menu");
  await page.keyboard.press("Escape");
  await shot("game-menu-anchored", {
    prepare: async () => {
      await click("Open game menu");
      await expect(page.getByTestId("game-menu")).toBeVisible();
    },
    cleanup: () => page.keyboard.press("Escape"),
  });
  await click("Open game menu");
  await click("End Run");
  await expect(page.getByRole("heading", { name: "Journey’s End" })).toBeVisible();
  await shot("run-end");
});

test("shops and destination encounters", async () => {
  for (const destination of [
    "Card Shop",
    "Gear Shop",
    "Trinket Shop",
    "Alchemist's Shop",
    "Campfire",
    "Mystery",
    "Corruption",
  ] as const) {
    await startAtDestination(
      page,
      { gold: 9999, runDeck: deck, runPlayerHealth: 15 },
      { forceDestination: destination },
    );
    await shot(`destination-${destination.toLowerCase().replaceAll(/\W+/g, "-")}`);
    await click(destination);
    const name = destination.toLowerCase().replaceAll(/\W+/g, "-");
    await shot(name);
    if (destination === "Card Shop") {
      await page.getByRole("button", { name: /^Remove Card/ }).click();
      await shot("card-shop-removal");
      await page
        .getByRole("button", { name: /^Select / })
        .first()
        .click();
      await shot("card-shop-removal-selected");
    }
    if (destination === "Corruption") {
      const corruption = new CorruptionPage(page);
      await corruption.corruptBtn.click();
      await shot("corruption-picker");
      await corruption.cardGrid
        .getByRole("button", { name: /^Select / })
        .first()
        .click();
      await corruption.confirmCorruptBtn.click();
      await expect(corruption.continueBtn).toBeVisible();
      await shot("corruption-result");
    }
  }
  await injectMysterySummaryVisit(page);
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
  await shot("mystery-summary");
  await injectLabyrinthRun(page, { deck });
  await shot("labyrinth-map");
});

test("reward variants and victory", async () => {
  for (const rewardType of ["card", "boon", "trinket", "gear"] as const) {
    await enterPrimaryRewardScreen(page, {
      rewardType,
      choiceIds:
        rewardType === "card" ? ["slash", "bash", "block"] : ["tattered-pages", "companions-collar", "brass-censer"],
      gearChoices: [{ instanceId: "review-gear", definitionId: "leather-armor-basic", affixes: [] }],
    });
    await expect(page.getByRole("heading", { name: "Victory", exact: true })).toBeVisible();
    await shot(`rewards-${rewardType}`);
  }
  await injectBossState(page, process.env.ALCHEMY_EDITION === "demo" ? 1 : 3);
  await new DestinationPage(page).enterCombat("Boss");
  await winBattleAndClaimReward(page);
  await expect(page.getByRole("heading", { name: "Victory", exact: true })).toBeVisible();
  await shot(process.env.ALCHEMY_EDITION === "demo" ? "demo-victory" : "run-victory");
  if (process.env.ALCHEMY_EDITION === "demo") {
    await click("Continue");
    await expect(page.getByRole("heading", { name: "The Journey Continues" })).toBeVisible();
    await shot("demo-completion");
  }
});

test("armory inventory and crafting", async () => {
  await openArmory(page, {
    inventory: Array.from({ length: 24 }, (_, i) => ({ ...bodyGear, instanceId: `review-${i}` })),
    craftingCurrencies: {
      "discordant-dice": 999,
      "sprig-of-growth": 999,
      voidstone: 999,
      "ascension-seal": 999,
      "severance-maw": 999,
      "smiths-whetstone": 999,
    },
  });
  await shot("armory");
  await selectArmorySlot(page, "body");
  await shot("armory-armor-picker");
  await page.getByRole("button", { name: "Leather Armor", exact: true }).first().click();
  await shot("armory-equipped");
});

test("additional pickers tooltips and end states", async () => {
  await injectHomestead(page, {
    talentXP: { physical: 100 },
    unlockedTalents: { physical: ["physical-expert-blacksmith"] },
  });
  await click("Talents");
  await expect(page.getByRole("button", { name: "Select Physical Talents" })).toBeVisible();
  const trees = await page.getByRole("button", { name: /^Select .* Talents$/ }).allTextContents();
  const labels = await page
    .getByRole("button", { name: /^Select .* Talents$/ })
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")!));
  expect(trees.length).toBeGreaterThan(0);
  for (const label of labels) {
    await click(label);
    await shot(
      `talents-tree-${label
        .replace(/^Select | Talents$/g, "")
        .toLowerCase()
        .replaceAll(/\W+/g, "-")}`,
    );
    await click("Back");
    await expect(page.getByRole("button", { name: "Select Physical Talents" })).toBeVisible();
  }
  await click("Reset talents");
  await expect(page.getByRole("dialog")).toBeVisible();
  await shot("confirmation-reset-talents");
  await click("Cancel");
  await injectSaveState(page, {
    contentSystemType: "wildwood",
    selectedDifficulty: null,
    runDeck: deck,
    wildwoodDraft: {
      phase: "removal",
      draftChoices: [],
      remainingBossIds: ["iron-bear"],
      previousBossId: "forge-golem",
      currentBossId: null,
      currentCombatTraitIds: [],
      currentRewardTraitIds: [],
    },
    activity: savedActivityFixture("wildwood-removal"),
  });
  await expect(page.getByRole("heading", { name: "Refine Your Deck" })).toBeVisible();
  await shot("wildwood-removal");
  const choice = { label: "Take the Scroll", effects: [{ kind: "chooseCard" }] };
  await injectSaveState(page, {
    runDeck: deck,
    activity: savedActivityFixture("mystery", {
      event: {
        id: "review-scroll",
        title: "Forgotten Scrolls",
        art: "",
        narrative: "Choose a scroll from a forgotten library.",
        choices: [choice],
      },
      chosenChoice: choice,
      cardChoices: [makeCard(), makeCard({ id: "meteor" }), makeCard({ id: "blessed-aegis" })],
      grantedTrinketIds: [],
      grantedGear: [],
      chosenCardId: null,
    }),
  });
  await expect(page.getByRole("heading", { name: "Choose a Card" })).toBeVisible();
  await shot("mystery-card-picker");
  await injectActiveBattle(page, makeGoblinBattleState({ hand: [makeCard()], deck: deck }), { runDeck: deck });
  await page.getByTestId("battle-enemy-art-panel").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await shot("enemy-inspection");
  await page.keyboard.press("Escape");
  await shot("enemy-tooltip", { prepare: () => page.getByTestId("battle-enemy-art-panel").hover() });
  await shot("battle-high-dpi", {
    dpr: 2,
    viewports: [
      [1470, 956],
      [1920, 1080],
    ],
  });
});

test("size and aspect ratio stress", async () => {
  // oxlint-disable-next-line playwright/no-skipped-test -- Explicit opt-in keeps the baseline matrix at default settings.
  test.skip(process.env.LAYOUT_REVIEW_STRESS !== "1", "Run separately into the stress report directory");
  const viewports = [
    [1280, 720],
    [1920, 1200],
    [3440, 1440],
  ] as const;
  for (const gameSizePercent of [80, 120]) {
    for (const selectedAspectRatio of ["auto", "16:9", "16:10", "21:9"]) {
      await page.evaluate(
        (gameSizePercent) =>
          localStorage.setItem(
            "alchemy-device-display-v1",
            JSON.stringify({ version: 1, gameSizePercent, tooltipSizePercent: 125 }),
          ),
        gameSizePercent,
      );
      await injectActiveBattle(page, makeGoblinBattleState({ hand: deck.slice(0, 12), deck: deck.slice(12) }), {
        runDeck: deck,
        selectedAspectRatio,
      });
      await expect(page.getByTestId("battle-scene")).toBeVisible();
      const suffix = `${gameSizePercent}-${selectedAspectRatio.replace(":", "-")}`;
      await shot(`battle-stress-${suffix}`, {
        viewports,
        prepare: () =>
          page
            .getByRole("button", { name: /^Play / })
            .last()
            .hover(),
      });
      await page.mouse.move(0, 0);
      await page.getByRole("button", { name: /^View Deck/ }).click();
      await shot(`deck-stress-${suffix}`, { viewports });
      await page.keyboard.press("Escape");
    }
  }
});

test("loading screen", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\.(webp|png|jpg)(\?|$)/, async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("progressbar", { name: "Loading Alchemy" })).toBeVisible();
    await shot("loading", { loading: true });
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("hidden rendering matches offscreen composition", async () => {
  const viewport = { width: 1470, height: 738 };
  await waitForLayoutSettled(page);
  const original = await page.getByRole("button", { name: "Play", exact: true }).boundingBox();
  const normal = await launchElectronApp({ background: true, offscreen: true });
  try {
    const ordinary = await getElectronMainWindow(normal);
    await normal.evaluate(
      ({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height),
      viewport,
    );
    await ordinary.setViewportSize(viewport);
    await new MenuPage(ordinary).expectMainMenuAfterColdStart(60_000);
    await waitForLayoutSettled(ordinary);
    const matching = await ordinary.getByRole("button", { name: "Play", exact: true }).boundingBox();
    expect(matching!.width).toBeCloseTo(original!.width, 0);
    expect(matching!.height).toBeCloseTo(original!.height, 0);
    expect(matching!.x).toBeCloseTo(original!.x, 0);
    await ordinary.screenshot({
      path: path.join(output, "ordinary-hidden-menu.png"),
      animations: "disabled",
      scale: "css",
    });
    const status = await normal.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      return { shown: w.isVisible(), offscreen: w.webContents.isOffscreen() };
    });
    expect(status).toEqual({ shown: false, offscreen: true });
  } finally {
    await normal.close();
  }
});

test("remaining encounter states", async () => {
  await startAtDestination(page, { runDeck: deck }, { forceDestination: "Corruption" });
  await click("Corruption");
  const corruption = new CorruptionPage(page);
  await corruption.corruptBtn.click();
  await shot("corruption-picker");
  await corruption.cardGrid
    .getByRole("button", { name: /^Select / })
    .first()
    .click();
  await corruption.confirmCorruptBtn.click();
  await expect(corruption.continueBtn).toBeVisible();
  await shot("corruption-result");
  await injectMysterySummaryVisit(page);
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
  await shot("mystery-summary");
  await injectLabyrinthRun(page, { deck });
  await shot("labyrinth-map");
  await page.getByTestId("labyrinth-viewport").getByRole("button").first().hover();
  await shot("labyrinth-node-tooltip", {
    prepare: () => page.getByTestId("labyrinth-viewport").getByRole("button").first().hover(),
  });
});

test("services crafting and dense recap", async () => {
  const potions = Array.from({ length: 18 }, (_, i) =>
    makeCard({ id: ["health-potion", "mana-potion", "panacea-potion"][i % 3], uid: 300 + i }),
  );
  await startAtDestination(page, { gold: 9999, runDeck: potions }, { forceDestination: "Alchemist's Shop" });
  await click("Alchemist's Shop");
  await page.getByRole("button", { name: /^Mix Potion/ }).click();
  await shot("alchemist-mix-picker");
  const picks = page.getByRole("button", { name: /^Select / });
  await picks.nth(0).click();
  await picks.nth(1).click();
  await shot("alchemist-mix-selected");
  await page.getByRole("button", { name: /^Mix(?: ·.*)?$/ }).click();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
  await shot("alchemist-mix-result");
  await injectHomestead(page, { ownedTrinketIds: ["tattered-pages", "brass-censer", "companions-collar"] });
  await click("Armory");
  await click("Trinket equipment slot");
  await shot("armory-trinket-picker");
  await click("Filters");
  await expect(page.getByRole("dialog", { name: "Inventory filters" })).toBeVisible();
  await shot("armory-inventory-filters");
  await click("Close inventory filters");
  await shot("armory-sort-dropdown", {
    prepare: async () => {
      await page.getByRole("button", { name: "Sort inventory" }).click();
      await expect(page.getByRole("dialog", { name: "Sort inventory" })).toBeVisible();
    },
    cleanup: () => page.keyboard.press("Escape"),
  });
  await openArmory(page, {
    craftingCurrencies: { "discordant-dice": 9 },
    inventory: [{ ...bodyGear, affixes: [{ id: "flat-physical", value: 1 }] }],
  });
  await selectArmorySlot(page, "body");
  await page.getByRole("button", { name: /^Use Discordant Dice,/ }).click();
  await shot("armory-crafting-target", {
    prepare: () => gearItemLocator(page, "Leather Armor").getByRole("button").first().hover(),
  });
  await gearItemLocator(page, "Leather Armor").getByRole("button").first().click();
  await expect(page.getByRole("button", { name: /^Use Discordant Dice,/ })).toHaveAccessibleName(
    "Use Discordant Dice, 8 available",
  );
  await shot("armory-crafting-result");
  await click("Salvage");
  await shot("armory-salvage-target");
  await gearItemLocator(page, "Leather Armor").getByRole("button").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await shot("confirmation-salvage");
  await click("Cancel");
  await injectActiveBattle(
    page,
    makeGoblinBattleState({
      wishOptions: [makeCard({ id: "meteor" }), makeCard({ id: "blessed-aegis" }), makeCard({ id: "anvil" })],
    }),
    { runDeck: deck },
  );
  await expect(page.getByRole("heading", { name: "Wish", exact: true })).toBeVisible();
  await shot("wish-choice");
  await injectSaveState(page, {
    runDeck: deck,
    activity: savedActivityFixture("rewards", {
      rewardType: "card",
      choiceIds: ["slash"],
      companionChoiceIds: ["wolf-companion", "bear-companion"],
      selectedId: null,
      gold: 0,
      materials: {},
      destinations: ["Campfire"],
      selectedBossId: null,
      lastVictoryEnemyType: "normal",
      lastVictoryContentSystem: "campaign",
    }),
  });
  await expect(page.getByRole("heading", { name: "Victory", exact: true })).toBeVisible();
  await shot("rewards-companion");
  const battleState = makeGoblinBattleState({
    hand: [],
    playerHealth: 1,
    deathsDoorUsed: true,
    deathsDoorActive: false,
    playerStatuses: { poison: 50 },
    gearEffects: { dodgeChance: 0 },
    talentEffects: { dodgeChanceBelowHalfHealth: 0 },
  });
  battleState.currentEnemy = { ...battleState.currentEnemy, abilityIds: ["slash", "sunder", "burning-blade"] };
  await injectActiveBattle(page, battleState, {
    runDeck: deck,
    runPlayerHealth: 1,
    runGoldEarned: 1234,
    runTalentXP: { physical: 100, fire: 90, bleed: 80, holy: 60, poison: 50, mana: 40, health: 30 },
    runMaterialsEarned: { wood: 12, stone: 10, iron: 15, food: 8, herbs: 10, hide: 12, gems: 7 },
    runCurrenciesEarned: { "discordant-dice": 3, voidstone: 2 },
    runObtainedItems: [
      { kind: "trinket", trinketId: "brass-censer" },
      { kind: "trinket", trinketId: "tattered-pages" },
    ],
  });
  await page.getByRole("button", { name: "End Turn", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Journey’s End" })).toBeVisible();
  await shot("defeat-dense-recap");
});

test("long descriptions and boss inspection", async () => {
  const menu = new MenuPage(page);
  await menu.gotoCollection({
    encounteredEnemyIds: ["bandit", "forge-golem"],
    discoveredCardIds: ["slash", "blessed-aegis", "meteor"],
  });
  await click("Heroes");
  await shot("collection-hero-tooltip", {
    prepare: () => page.getByRole("button", { name: "Inspect Warlock", exact: true }).hover(),
  });
  await page.mouse.move(0, 0);
  await click("Bestiary");
  await page.getByRole("button", { name: "Inspect Bandit", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await shot("collection-enemy-inspection");
  await page.keyboard.press("Escape");
  await injectBossState(page, 1);
  await new DestinationPage(page).enterCombat("Boss");
  await expect(page.getByRole("button", { name: "End Turn", exact: true })).toBeVisible();
  await shot("boss-battle");
  await shot("boss-tooltip", { prepare: () => page.getByTestId("battle-enemy-art-panel").hover() });
  await page.mouse.move(0, 0);
  await page.getByTestId("battle-enemy-art-panel").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await shot("boss-inspection");
});

test("armory sizing stress", async () => {
  // oxlint-disable-next-line playwright/no-skipped-test -- Size extremes are captured separately from baseline settings.
  test.skip(process.env.LAYOUT_REVIEW_STRESS !== "1", "Stress capture only");
  for (const gameSizePercent of [80, 120]) {
    await page.evaluate(
      (percent) =>
        localStorage.setItem(
          "alchemy-device-display-v1",
          JSON.stringify({ version: 1, gameSizePercent: percent, tooltipSizePercent: 125 }),
        ),
      gameSizePercent,
    );
    await openArmory(page);
    await selectArmorySlot(page, "body");
    await shot(`armory-stress-${gameSizePercent}`, {
      viewports: [
        [1280, 720],
        [1920, 1200],
        [3440, 1440],
      ],
    });
  }
});
