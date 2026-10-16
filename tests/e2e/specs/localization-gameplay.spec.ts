import { expect, test } from "../../fixtures/e2e";
import type { BattleCard } from "../../../src/lib/game-data/types";
import type { Page } from "@playwright/test";
import {
  injectLabyrinthRun,
  readSavedGame,
  startAtDestination,
  makeCard,
  enterPrimaryRewardScreen,
  openArmory,
  failOnRuntimeErrors,
  injectHomestead,
  injectSaveState,
  injectActiveBattle,
  injectBossState,
  makeGoblinBattleState,
  makeHighDamageCard,
  waitForLayoutSettled,
} from "../../browser-helpers";
import { savedActivityFixture } from "../../fixtures/run-activity";
import { controllerInput } from "../controller-input";
import { gridLabyrinthMapFixture } from "../../fixtures/labyrinth-map";
import { HomesteadPage } from "../../pages/homestead-page";
import { DEVICE_DISPLAY_RANGES } from "../../../src/lib/settings-values";
import {
  acceptanceLocales,
  type AcceptanceLocale,
  layoutReview,
  mechanics,
  reviewLayout,
  translatedLabel,
  localizedCheckpoint,
} from "../localization";

// Distinct renderer risks: generated/modified card presentation, movable keyword
// slots, localized transaction targets, and separately booted cross-language saves.
test.use({ viewport: layoutReview ? { width: 1280, height: 720 } : { width: 1920, height: 1080 } });

test.beforeEach(async ({ page }) => {
  if (layoutReview)
    await page.addInitScript((ranges) => {
      localStorage.setItem(
        "alchemy-device-display-v1",
        JSON.stringify({
          version: 1,
          gameSizePercent: ranges.gameSizePercent.max,
          tooltipSizePercent: ranges.tooltipSizePercent.max,
        }),
      );
    }, DEVICE_DISPLAY_RANGES);
});

const extraSeedPages: Array<{ page: Page; errors: string[] }> = [];

test.afterEach(async () => {
  for (const { page, errors } of extraSeedPages.splice(0)) {
    await page.close();
    expect(errors).toEqual([]);
  }
});

async function nextSeedPage(previous: Page): Promise<Page> {
  const page = await previous.context().newPage();
  extraSeedPages.push({ page, errors: failOnRuntimeErrors(page) });
  await page.addInitScript(() => localStorage.setItem("alchemy-language-v1", "en"));
  return page;
}

async function crossLanguageResume(page: Page, locale: AcceptanceLocale, ready: string) {
  const before = await readSavedGame(page);
  const next = acceptanceLocales[(acceptanceLocales.indexOf(locale) + 1) % acceptanceLocales.length]!;
  await localizedCheckpoint(page, next, async (fresh) => {
    await expect(fresh.getByRole("heading", { name: translatedLabel(next, ready), exact: true })).toBeVisible();
    const after = await readSavedGame(fresh);
    expect(mechanics(after)).toEqual(mechanics(before));
    // Description provenance and marks must survive too, not only effect amounts.
    expect(after.activeRun?.runDeck).toEqual(before.activeRun?.runDeck);
  });
}

for (const locale of acceptanceLocales) {
  test.describe(locale, () => {
    test.beforeEach(() => {
      // oxlint-disable-next-line playwright/no-skipped-test -- Pseudotext is deliberately developer-only.
      test.skip(locale === "en-XA" && process.env.PLAYWRIGHT_VITE_MODE !== "dev", "QA locale");
    });

    const label = (english: string) => translatedLabel(locale, english);

    test("localized setup chooses a difficulty and completes a saved draft", async ({ page, fastBattle }) => {
      void fastBattle;
      await injectHomestead(page, { completedDifficulties: { knight: ["difficulty-1"] } });
      await page.goto("/");
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh.getByRole("button", { name: label("Play"), exact: true }).click();
        await reviewLayout(fresh, `${locale} mode selection`);
        await fresh.getByRole("button", { name: label("The Campaign"), exact: true }).click();
        await reviewLayout(fresh, `${locale} hero selection`);
        await fresh
          .getByRole("button", {
            name: label("Select {{value0}}").replace("{{value0}}", label("Knight")),
            exact: true,
          })
          .click();
        await expect(fresh.getByRole("heading", { name: label("A Knight's Journey"), exact: true })).toBeVisible();
        const novice = fresh.getByRole("button", { name: label("Novice"), exact: true });
        await controllerInput(fresh).activate(novice);
        await expect(novice).toHaveAttribute("aria-pressed", "true");
        await reviewLayout(fresh, `${locale} difficulty selection`);
        await fresh.getByRole("button", { name: locale === "en-XA" ? /Plááy\]$/ : label("Play"), exact: true }).click();
        await expect(fresh.getByRole("button", { name: label("End Turn"), exact: true })).toBeVisible();
        await expect.poll(async () => (await readSavedGame(fresh)).activeRun?.selectedDifficulty).toBe("difficulty-1");
      });
      page = await nextSeedPage(page);
      await injectSaveState(page, {
        contentSystemType: "wildwood",
        selectedDifficulty: null,
        runDeck: Array.from({ length: 5 }, () => makeCard()),
        activity: savedActivityFixture("draft-deck"),
        wildwoodDraft: {
          phase: "draft",
          draftChoices: [makeCard({ id: "bash", title: "Bash" })],
          remainingBossIds: [],
          previousBossId: null,
          currentBossId: null,
          currentCombatTraitIds: [],
          currentRewardTraitIds: [],
        },
      });
      await page.goto("/");
      await localizedCheckpoint(page, locale, async (fresh) => {
        await expect(fresh.getByRole("heading", { name: label("Draft a Deck"), exact: true })).toBeVisible();
        await reviewLayout(fresh, `${locale} draft choices`);
        await controllerInput(fresh).activate(
          fresh.getByRole("button", {
            name: label("Select {{value0}}").replace("{{value0}}", label("Bash")),
            exact: true,
          }),
        );
        await expect(fresh.getByRole("heading", { name: label("Draft Complete"), exact: true })).toBeVisible();
        await reviewLayout(fresh, `${locale} completed draft`);
        await crossLanguageResume(fresh, locale, "Draft Complete");
      });
    });

    test("Talents and Collection keep localized keyboard targets and saved allocation", async ({ page }) => {
      test.setTimeout(60_000);
      await injectHomestead(page, { talentXP: { dodge: 550 }, unlockedTalents: {}, discoveredCardIds: ["anvil"] });
      await page.goto("/");
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh.getByRole("button", { name: label("Talents"), exact: true }).click();
        await fresh
          .getByRole("button", {
            name: label("Select {{value0}} Talents").replace("{{value0}}", label("Dodge")),
            exact: true,
          })
          .click();
        const node = fresh.getByRole("button").filter({ has: fresh.getByText(label("Lightfoot"), { exact: true }) });
        await controllerInput(fresh).activate(node, 50);
        await expect(node).toHaveAttribute("aria-disabled", "true");
        await expect.poll(async () => (await readSavedGame(fresh)).unlockedTalents.dodge).toEqual(["dodge-lightfoot"]);
        await reviewLayout(fresh, `${locale} talent allocation`);
        await fresh.getByRole("button", { name: label("Open game menu"), exact: true }).click();
        await fresh
          .getByTestId("game-menu")
          .getByRole("button", { name: label("Collection"), exact: true })
          .click();
        await fresh.getByRole("button", { name: label("Cards"), exact: true }).click();
        await waitForLayoutSettled(fresh);
        const inspect = fresh.getByRole("button", {
          name: label("Inspect {{value0}}").replace("{{value0}}", label("Anvil")),
          exact: true,
        });
        // Catalog ordering follows the selected language, so inspect the same
        // discovered card through real pagination rather than assuming page one.
        await expect(async () => {
          if (await inspect.isVisible()) return;
          await fresh.getByRole("button", { name: label("Next page"), exact: true }).click();
          await waitForLayoutSettled(fresh);
          await expect(inspect).toBeVisible({ timeout: 300 });
        }).toPass({ timeout: 20_000, intervals: [0] });
        await controllerInput(fresh).reach(inspect, 50);
        await expect(fresh.getByRole("tooltip").last()).toContainText(label("Anvil"));
        await reviewLayout(fresh, `${locale} Collection inspection`);
        await localizedCheckpoint(fresh, locale === "ru" ? "zh-Hans" : "ru", async (resumed) => {
          expect((await readSavedGame(resumed)).unlockedTalents.dodge).toEqual(["dodge-lightfoot"]);
        });
      });
    });

    test("Mystery choice remains translated and settles once across a language change", async ({ page }) => {
      const event = {
        id: "ancient-altar",
        title: "Ancient Altar",
        art: "",
        narrative: "A sunlit stone altar holds a bowl of gold and a gleaming topaz relic.",
        choices: [
          {
            label: "Take the Offering",
            effects: [
              { kind: "gainXP", keyword: "holy", amount: 8 },
              { kind: "gainGold", amount: 20 },
            ],
          },
        ],
      };
      await injectSaveState(page, {
        activity: savedActivityFixture("mystery", {
          event,
          chosenChoice: null,
          cardChoices: null,
          grantedTrinketIds: [],
          grantedGear: [],
          chosenCardId: null,
        }),
      });
      await page.goto("/");
      await localizedCheckpoint(page, locale, async (fresh) => {
        await expect(fresh.getByRole("heading", { name: label(event.title), exact: true })).toBeVisible();
        const choice = fresh.getByRole("button", { name: label("Take the Offering"), exact: true });
        await controllerInput(fresh).reach(choice);
        await expect(fresh.getByRole("tooltip").last()).toBeVisible();
        await reviewLayout(fresh, `${locale} Mystery choice`);
        const before = await readSavedGame(fresh);
        await fresh.keyboard.press("Enter");
        await expect(fresh.getByRole("heading", { name: label("Reward"), exact: true })).toBeVisible();
        await expect.poll(async () => (await readSavedGame(fresh)).gold).toBe((before.gold ?? 0) + 20);
        await reviewLayout(fresh, `${locale} Mystery reward`);
        await crossLanguageResume(fresh, locale, "Reward");
      });
    });

    test("defeat and final victory keep localized recap controls and settle progress", async ({ page, fastBattle }) => {
      void fastBattle;
      await injectActiveBattle(
        page,
        makeGoblinBattleState({
          hand: [],
          mana: 0,
          playerHealth: 1,
          deathsDoorUsed: true,
          deathsDoorActive: false,
          playerStatuses: { poison: 50 },
          gearEffects: { dodgeChance: 0 },
          talentEffects: { dodgeChanceBelowHalfHealth: 0 },
          currentEnemy: { id: "goblin", abilityIds: ["slash", "sunder", "burning-blade"] },
        }),
        { runPlayerHealth: 1, runGoldEarned: 42, runBoons: ["bone-charm"] },
      );
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh.getByRole("button", { name: label("End Turn"), exact: true }).click();
        await fresh
          .getByRole("dialog")
          .getByRole("button", { name: label("End Turn"), exact: true })
          .click();
        await expect(fresh.getByRole("heading", { name: label("Journey’s End"), exact: true })).toBeVisible();
        await expect(fresh.getByText("+42", { exact: true })).toBeVisible();
        await reviewLayout(fresh, `${locale} defeat recap`);
        await fresh.getByRole("button", { name: label("Inspect Boons"), exact: true }).click();
        await expect(fresh.getByRole("heading", { name: label("Boons"), exact: true })).toBeVisible();
        await reviewLayout(fresh, `${locale} recap Boons`);
        await fresh
          .getByTestId("battle-boon-inspect-overlay")
          .getByRole("button", { name: label("Close boons"), exact: true })
          .click();
        await fresh.getByRole("button", { name: label("Main Menu"), exact: true }).click();
        await expect.poll(async () => (await readSavedGame(fresh)).activeRun).toBeNull();
      });
      page = await nextSeedPage(page);
      const card = makeHighDamageCard();
      await injectBossState(page, 3, {
        activity: savedActivityFixture("battle", {
          battleState: makeGoblinBattleState({
            currentEnemy: { id: "blight-treant" },
            hand: [card],
            enemyHealth: 1,
            enemyMaxHealth: 1,
            contentSystemType: "campaign",
          }),
          activeLabyrinthModifiers: [],
          activeLabyrinthRewardModifiers: [],
        }),
      });
      await page.goto("/");
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh.locator('[data-hand-card="true"] button').first().click();
        await fresh.locator(".reward-choice button").first().click();
        await expect(fresh.getByRole("heading", { name: label("Victory"), exact: true })).toBeVisible();
        await expect(
          fresh.getByText(label("The primordial evils have been vanquished. Alchemy is saved."), { exact: true }),
        ).toBeVisible();
        await reviewLayout(fresh, `${locale} victory recap`);
        await fresh.getByRole("button", { name: label("Main Menu"), exact: true }).click();
        await expect.poll(async () => (await readSavedGame(fresh)).activeRun).toBeNull();
      });
    });

    test("mixed and distilled Potions retain their modifications across languages", async ({ page }) => {
      let brewed: BattleCard | undefined;
      const potions = [
        makeCard({
          id: "health-potion",
          title: "Health Potion",
          consume: true,
          descriptionLines: ["Restore 9 Health", "Consume"],
          effects: [{ kind: "heal", amount: 9 }],
        }),
        makeCard({
          id: "mana-potion",
          title: "Mana Potion",
          consume: true,
          descriptionLines: ["Restore 3 Mana", "Consume"],
          effects: [{ kind: "restore-mana", amount: 3 }],
        }),
      ];
      await startAtDestination(page, { runDeck: potions }, { forceDestination: "Campfire" });
      await page.getByRole("button", { name: "Campfire", exact: true }).click();
      await expect.poll(async () => (await readSavedGame(page)).activeRun?.activity.kind).toBe("campfire");
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh.getByRole("button", { name: label("Brew Potion"), exact: true }).click();
        const choices = fresh.getByTestId("card-selection-grid").getByRole("button");
        await choices.nth(0).click();
        await choices.nth(1).click();
        await reviewLayout(fresh, `${locale} mix preview`);
        await fresh.getByRole("button", { name: label("Mix"), exact: true }).click();
        await expect.poll(async () => (await readSavedGame(fresh)).activeRun?.runDeck.length).toBe(1);
        const mixed = (await readSavedGame(fresh)).activeRun!.runDeck[0]!;
        brewed = mixed;
        expect(mixed.effects).toEqual([
          { kind: "heal", amount: 9 },
          { kind: "restore-mana", amount: 3 },
        ]);
        const result = fresh.getByTestId("card-selection-grid");
        await expect(result).toHaveCount(0);
        await reviewLayout(fresh, `${locale} mixed Potion`);
        await crossLanguageResume(fresh, locale, "Campfire");
      });
      expect(brewed).toBeDefined();
      page = await nextSeedPage(page);
      await startAtDestination(page, { runDeck: [brewed], runGold: 999 }, { forceDestination: "Alchemist's Shop" });
      await page.getByRole("button", { name: "Alchemist's Shop", exact: true }).click();
      await expect.poll(async () => (await readSavedGame(page)).activeRun?.activity.kind).toBe("alchemist");
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh
          .getByRole("button")
          .filter({ has: fresh.getByText(label("Distill"), { exact: true }) })
          .click();
        await fresh.getByTestId("card-selection-grid").getByRole("button").first().click();
        await reviewLayout(fresh, `${locale} distillation comparison`);
        await fresh
          .getByRole("button")
          .filter({ hasText: label("Distill") })
          .last()
          .click();
        await expect
          .poll(async () => (await readSavedGame(fresh)).activeRun?.runDeck[0]?.effects)
          .not.toEqual(brewed!.effects);
        const distilled = (await readSavedGame(fresh)).activeRun!.runDeck[0]!;
        expect(distilled.effects).toHaveLength(2);
        expect(
          distilled.effects.every(
            (effect, index) =>
              "amount" in effect &&
              typeof effect.amount === "number" &&
              effect.amount > (brewed!.effects[index] as { amount: number }).amount,
          ),
        ).toBe(true);
        await reviewLayout(fresh, `${locale} distilled Potion`);
        await crossLanguageResume(fresh, locale, "Alchemist's Shop");
      });
    });

    test("transmutation previews and saved generated names remain localized", async ({ page }) => {
      await startAtDestination(page, { runDeck: [makeCard()] }, { forceDestination: "Transmutation" });
      await page.getByRole("button", { name: "Transmutation", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Transmutation", exact: true })).toBeVisible();
      await expect.poll(async () => (await readSavedGame(page)).activeRun?.activity.kind).toBe("transmutation");
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh.getByTestId("card-selection-grid").getByRole("button").first().click();
        const alterations = fresh.getByRole("group", { name: label("Alterations"), exact: true });
        await alterations
          .getByRole("button")
          .and(fresh.locator(':not([aria-disabled="true"]):not([disabled])'))
          .first()
          .click();
        await expect(fresh.getByRole("button", { name: label("Transmute"), exact: true })).toBeEnabled();
        await reviewLayout(fresh, `${locale} transmutation preview`);
        await fresh.getByRole("button", { name: label("Transmute"), exact: true }).click();
        await expect.poll(async () => !!(await readSavedGame(fresh)).activeRun?.runDeck[0]?.transmuted).toBe(true);
        await expect(fresh.getByRole("button", { name: label("Continue"), exact: true })).toBeEnabled();
        await reviewLayout(fresh, `${locale} transmutation result`);
        await crossLanguageResume(fresh, locale, "Transmutation");
      });
    });

    test("corruption keeps its magnitude marks through cross-language resume", async ({ page }) => {
      await startAtDestination(page, { runDeck: [makeCard()] }, { forceDestination: "Corruption" });
      await page.getByRole("button", { name: "Corruption", exact: true }).click();
      await expect.poll(async () => (await readSavedGame(page)).activeRun?.activity.kind).toBe("corruption");
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh.getByRole("button", { name: label("Corrupt a Card"), exact: true }).click();
        await fresh.getByTestId("card-selection-grid").getByRole("button").first().click();
        await fresh.getByRole("button", { name: label("Corrupt"), exact: true }).click();
        await expect.poll(async () => (await readSavedGame(fresh)).activeRun?.runDeck[0]?.corrupted).toBe(true);
        await reviewLayout(fresh, `${locale} corruption result`);
        await crossLanguageResume(fresh, locale, "Altar of Corruption");
      });
    });

    test("Homestead and crafting spend once with localized targets", async ({ page }) => {
      await new HomesteadPage(page).goto({
        gold: 1234567,
        materialInventory: { stone: 16, iron: 33, wood: 123456789 },
        constructedBuildings: {},
      });
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh.getByRole("button", { name: label("Homestead"), exact: true }).click();
        const amounts = new Intl.NumberFormat(locale === "en-XA" ? "en" : locale, {
          notation: "compact",
          maximumFractionDigits: 1,
        });
        const wallet = fresh.locator("dl[aria-label]");
        await expect(wallet).toContainText(amounts.format(1234567));
        await expect(wallet).toContainText(amounts.format(123456789));
        const tile = fresh
          .getByRole("button")
          .filter({ has: fresh.getByRole("img", { name: label("Blacksmith"), exact: true }) });
        await tile.click();
        await expect.poll(async () => (await readSavedGame(fresh)).constructedBuildings["blacksmiths-forge"]).toBe(1);
        expect((await readSavedGame(fresh)).materialInventory).toMatchObject({ stone: 12, iron: 22, wood: 123456789 });
        expect((await readSavedGame(fresh)).gold).toBe(1234567);
        await tile.hover();
        const expectedBenefit = label(
          "Physical damage is increased by 1\nBurn damage is increased by 10% of your Forge",
        ).split("\n")[0]!;
        await expect(
          fresh.getByRole("tooltip").filter({ has: fresh.getByText(label("Blacksmith"), { exact: true }) }),
        ).toContainText(expectedBenefit);
        await reviewLayout(fresh, `${locale} Homestead purchase`);
      });
      page = await nextSeedPage(page);
      await openArmory(page, { craftingCurrencies: { "sprig-of-growth": 2 } });
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh
          .getByRole("button", { name: locale === "en-XA" ? /ÁÁrmôôry\]$/ : label("Armory"), exact: true })
          .click();
        const currency = fresh.getByRole("button", {
          name: label("{{name}}, {{count}} available")
            .replace("{{name}}", label("Use {{value0}}").replace("{{value0}}", label("Sprig of Growth")))
            .replace("{{count}}", "2"),
          exact: true,
        });
        await currency.click();
        await fresh.getByTestId("armory-inventory-item").first().click();
        await expect(fresh.getByTestId("armory-crafting-result")).toBeVisible();
        await expect.poll(async () => (await readSavedGame(fresh)).craftingCurrencies?.["sprig-of-growth"]).toBe(1);
        const before = await readSavedGame(fresh);
        expect(
          Object.values(before.gearInventories)
            .flat()
            .some((item) => item.affixes.length === 1),
        ).toBe(true);
        await reviewLayout(fresh, `${locale} crafting result`);
        await localizedCheckpoint(fresh, locale === "ru" ? "zh-Hans" : "ru", async (resumed) => {
          await expect(
            resumed.getByRole("button", {
              name: translatedLabel(locale === "ru" ? "zh-Hans" : "ru", "Armory"),
              exact: true,
            }),
          ).toBeVisible();
          const after = await readSavedGame(resumed);
          expect(after.gearInventories).toEqual(before.gearInventories);
          expect(after.craftingCurrencies).toEqual(before.craftingCurrencies);
        });
      });
    });

    test("Labyrinth discovery and reward claims survive a different language", async ({ page }) => {
      const map = gridLabyrinthMapFixture();
      map.nodes["labyrinth-floor-1-n0"]!.type = "rest";
      delete map.nodes["labyrinth-floor-1-n0"]!.enemyId;
      await injectLabyrinthRun(page, { labyrinthMap: map });
      await localizedCheckpoint(page, locale, async (fresh) => {
        await fresh.locator('[data-labyrinth-node="labyrinth-floor-1-n0"] button').click();
        await reviewLayout(fresh, `${locale} Labyrinth chamber`);
        await fresh.getByRole("button", { name: label("Enter"), exact: true }).click();
        await fresh.getByRole("button", { name: label("Rest"), exact: true }).click();
        await fresh.getByRole("button", { name: label("Continue"), exact: true }).click();
        await expect
          .poll(async () => (await readSavedGame(fresh)).activeRun?.labyrinthMap?.currentNodeId)
          .toBe("labyrinth-floor-1-n0");
        await crossLanguageResume(fresh, locale, "Labyrinth");
      });
      page = await nextSeedPage(page);
      await enterPrimaryRewardScreen(page, { rewardType: "card", choiceIds: ["slash", "bash"] });
      await expect(page.getByRole("button", { name: "Select Bash", exact: true })).toBeVisible();
      await localizedCheckpoint(page, locale, async (fresh) => {
        await reviewLayout(fresh, `${locale} reward choices`);
        const before = (await readSavedGame(fresh)).activeRun!.runDeck.length;
        await fresh
          .getByRole("button", { name: label("Select {{value0}}").replace("{{value0}}", label("Bash")), exact: true })
          .click();
        await expect.poll(async () => (await readSavedGame(fresh)).activeRun?.runDeck.length).toBe(before + 1);
        await crossLanguageResume(fresh, locale, "Choose Destination");
      });
    });
  });
}
