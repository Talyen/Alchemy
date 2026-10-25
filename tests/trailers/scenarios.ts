import { expect, type Page } from "@playwright/test";
import { buildActiveRunSave, injectExactSave, readSavedGame } from "../e2e/save-injection";
import { navigateToGame, resumeInjectedRun, selectGameMode } from "../e2e/navigation";
import { seedRandom } from "../e2e/rng";
import { MenuPage } from "../pages/menu-page";
import { pretendPlayerHost } from "../pages/audio-harness";
import { DestinationPage } from "../pages/destination-page";
import { waitForBattleReady } from "../../performance/battle-setup";
import { enemyById, trinketById, getStartingDeck, menuLogo } from "@/lib/game-data";
import { uniqueItemList } from "@/lib/gear";
import type { CharacterId } from "@/lib/game-data";
import { MUSIC_CATALOG, getBossMusicKey } from "@/lib/audio/music-catalog";
import { gridLabyrinthMapFixture } from "../fixtures/labyrinth-map";
import { savedActivityFixture, savedActivityData } from "../fixtures/run-activity";

interface Scene {
  scene: string;
  boss?: string;
  hero: CharacterId;
  seed: number;
  lyrics?: boolean;
  prepare?: Array<{
    role?: "button" | "tab" | "heading";
    name?: string;
    testId?: string;
    selector?: string;
    index?: number;
  }>;
}

export function trailerAssets(boss: string) {
  const key = getBossMusicKey(boss);
  const file = key && MUSIC_CATALOG[key]?.files[0];
  if (!file) throw new Error(`No soundtrack for ${boss}`);
  return { music: `public/Music/${file}`, logo: menuLogo };
}

const trailerMaterials = { wood: 24, stone: 14, iron: 18, food: 16, herbs: 12, hide: 9, gems: 4 };
const trailerHeroes: CharacterId[] = ["knight", "rogue", "ranger", "wizard", "alchemist", "warlock", "druid"];

function trailerRunSave(overrides: Record<string, unknown>) {
  return { ...buildActiveRunSave(overrides), materialInventory: trailerMaterials };
}

/** Only staging uses fixtures. Recorded inputs run through the unmodified UI and game rules. */
export async function openTrailerScene(page: Page, clip: Scene, checkpoint?: Record<string, unknown>) {
  await seedRandom(page, clip.seed);
  await pretendPlayerHost(page);
  await page.addInitScript(() => {
    localStorage.setItem("alchemy-language-v1", "en");
    localStorage.removeItem("alchemy-disable-animations");
  });
  if (checkpoint) {
    await injectExactSave(page, {
      ...checkpoint,
      bossLyricsEnabled: clip.lyrics ?? false,
      musicVolume: 70,
      muteInBackground: false,
      sfxVolume: 70,
      masterVolume: 100,
    });
    await navigateToGame(page);
    if (checkpoint.activeRun) await resumeInjectedRun(page);
    if (clip.boss) await waitForBattleReady(page);
  } else if (clip.scene === "labyrinth") {
    await injectExactSave(
      page,
      trailerRunSave({
        characterId: clip.hero,
        runDeck: getStartingDeck(clip.hero).map((card, index) => ({ ...card, uid: index + 1 })),
        contentSystemType: "labyrinth",
        selectedDifficulty: null,
        gold: 42,
        autoEndTurn: false,
        labyrinthMap: gridLabyrinthMapFixture(),
        activity: savedActivityFixture("labyrinth-map"),
      }),
    );
    await navigateToGame(page);
    await resumeInjectedRun(page);
    await expect(page.getByLabel("Labyrinth map", { exact: true })).toBeVisible();
  } else if (["destination", "shop", "alchemist", "campfire", "corruption", "combat"].includes(clip.scene)) {
    const destinations = {
      shop: "Card Shop",
      alchemist: "Alchemist's Shop",
      campfire: "Campfire",
      corruption: "Corruption",
      combat: "Normal Combat",
    } as const;
    const destination = destinations[clip.scene as keyof typeof destinations];
    await injectExactSave(
      page,
      trailerRunSave({
        characterId: clip.hero,
        runDeck: getStartingDeck(clip.hero).map((card, index) => ({ ...card, uid: index + 1 })),
        selectedDifficulty: "difficulty-1",
        gold: 85,
        roomsEncountered: 4,
        destinationIndexInAct: 4,
        completedDestinations: Array.from({ length: 4 }, () => "Normal Combat"),
        autoEndTurn: false,
        activity: savedActivityFixture("destination", {
          destinations: destination ? [destination] : ["Normal Combat", "Card Shop", "Alchemist's Shop"],
          selectedBossId: null,
          lastVictoryEnemyType: null,
          lastVictoryContentSystem: null,
        }),
      }),
    );
    await navigateToGame(page);
    await resumeInjectedRun(page);
    if (destination) await new DestinationPage(page).pick(destination);
    if (clip.scene === "combat") await waitForBattleReady(page);
  } else if (clip.scene === "boss") {
    // A production boss destination constructs the battle and its opening draw.
    // No test cards, stat overrides, fast mode, or forced damage are used.
    const deck = getStartingDeck(clip.hero).map((card, index) => ({ ...card, uid: index + 1 }));
    const act = ["frostwarden", "blood-countess"].includes(clip.boss ?? "")
      ? 2
      : ["blight-treant", "seraph", "stone-titan", "iron-bear"].includes(clip.boss ?? "")
        ? 3
        : 1;
    const save = trailerRunSave({
      characterId: clip.hero,
      runDeck: deck,
      autoEndTurn: false,
      selectedDifficulty: "difficulty-1",
      currentAct: act,
      roomsEncountered: 7,
      destinationIndexInAct: 7,
      completedDestinations: Array.from({ length: 7 }, () => "Normal Combat"),
      activity: savedActivityFixture("destination", {
        destinations: ["Boss Combat"],
        selectedBossId: clip.boss,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      }),
    });
    await injectExactSave(page, {
      ...save,
      bossLyricsEnabled: clip.lyrics ?? false,
      musicVolume: 70,
      sfxVolume: 70,
      masterVolume: 100,
      muteInBackground: false,
    });
    await navigateToGame(page);
    await resumeInjectedRun(page);
    await new DestinationPage(page).enterCombat("Boss Combat");
    await waitForBattleReady(page);
    const current = await readSavedGame(page);
    if (savedActivityData(current.activeRun, "battle")?.battleState.currentEnemy.id !== clip.boss)
      throw new Error(`Staged boss differs from directed boss ${clip.boss}`);
  } else {
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta({
      bossLyricsEnabled: clip.lyrics ?? false,
      musicVolume: 70,
      sfxVolume: 70,
      masterVolume: 100,
      muteInBackground: false,
      gold: 95,
      materialInventory: trailerMaterials,
      constructedBuildings: { "hunters-lodge": 1, "alchemy-lab": 1, "companion-sanctuary": 1 },
      plantedFarms: { "wheat-field": 1, "herb-garden": 1 },
      completedResearch: { "leyline-energy": 1 },
      bondedCompanions: { wolf: 1 },
      discoveredCardIds: [...new Set(trailerHeroes.flatMap((hero) => getStartingDeck(hero).map((card) => card.id)))],
      encounteredEnemyIds: [
        ...new Set([
          ...Object.keys(enemyById).slice(0, 12),
          "blood-countess",
          "blight-treant",
          "seraph",
          "stone-titan",
        ]),
      ],
      discoveredTrinketIds: Object.keys(trinketById).slice(0, 4),
      discoveredUniqueIds: uniqueItemList.slice(0, 2).map((item) => item.id),
      hasSeenArmory: true,
      finishedRunCharacters: trailerHeroes,
      completedDifficulties: Object.fromEntries(trailerHeroes.map((hero) => [hero, ["difficulty-1"]])),
      talentXP: { block: 55, burn: 35, physical: 50 },
      gearInventories: {
        knight: ["longsword-basic", "greatsword-basic", "leather-armor-basic"].map((definitionId, index) => ({
          instanceId: `trailer-gear-${index}`,
          definitionId,
          affixes: [],
        })),
      },
    });
    await menu.expectMainMenuAfterColdStart();
    if (clip.scene === "heroes") {
      await selectGameMode(page, "campaign");
      await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();
    } else if (clip.scene === "collection") await menu.openCollection();
    else if (clip.scene === "homestead") await menu.openHomestead();
    else if (clip.scene === "options") await menu.openOptions();
    else if (clip.scene === "armory") await page.getByRole("button", { name: "Armory", exact: true }).click();
    else if (clip.scene === "talents") await menu.openTalents();
    else if (clip.scene === "modes") await menu.openGameModeSelect();
    else if (clip.scene === "draft") {
      await selectGameMode(page, "wildwood");
      await page.getByRole("button", { name: "Select Knight", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Draft a Deck", exact: true })).toBeVisible();
    }
  }
  const readyHeadings: Record<string, string> = {
    destination: "Choose Destination",
    shop: "Card Shop",
    alchemist: "Alchemist's Shop",
    campfire: "Campfire",
    corruption: "Altar of Corruption",
    armory: "Armory",
  };
  const readyHeading = readyHeadings[clip.scene];
  if (readyHeading) await expect(page.getByRole("heading", { name: readyHeading, exact: true })).toBeVisible();
  for (const target of clip.prepare ?? []) {
    const locator = target.role
      ? page.getByRole(target.role, { name: target.name, exact: true })
      : target.testId
        ? page.getByTestId(target.testId)
        : page.locator(target.selector!);
    await locator.nth(target.index ?? 0).click();
  }
  // Start each take after the real route/tab reveal; this is staging, before
  // the offline clock or any directed gameplay inputs begin.
  await page.waitForTimeout(700);
  await expect(page.locator("#startup-splash")).toHaveCount(0, { timeout: 30000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].filter((img) => img.getBoundingClientRect().width > 0).map((img) => img.decode()),
    );
    if (document.querySelector("[inert] [data-testid='battle-scene']")) throw new Error("Battle is still loading");
  });
  await page.mouse.move(0, 0);
}
