import { expect, type Page } from "@playwright/test";
import { buildActiveRunSave, injectExactSave, readSavedGame } from "../e2e/save-injection";
import { navigateToGame, resumeInjectedRun } from "../e2e/navigation";
import { seedRandom } from "../e2e/rng";
import { MenuPage } from "../pages/menu-page";
import { pretendPlayerHost } from "../pages/audio-harness";
import { DestinationPage } from "../pages/destination-page";
import { waitForBattleReady } from "../../performance/battle-setup";
import { getStartingDeck, menuLogo } from "@/lib/game-data";
import type { CharacterId } from "@/lib/game-data";
import { MUSIC_CATALOG, getBossMusicKey } from "@/lib/audio/music-catalog";
import { savedActivityFixture, savedActivityData } from "../fixtures/run-activity";

interface Scene {
  scene: string;
  boss?: string;
  hero: CharacterId;
  seed: number;
  lyrics?: boolean;
}

export function trailerAssets(boss: string) {
  const key = getBossMusicKey(boss);
  const file = key && MUSIC_CATALOG[key]?.files[0];
  if (!file) throw new Error(`No soundtrack for ${boss}`);
  return { music: `public/Music/${file}`, logo: menuLogo };
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
  } else if (clip.scene === "boss") {
    // A production boss destination constructs the battle and its opening draw.
    // No test cards, stat overrides, fast mode, or forced damage are used.
    const deck = getStartingDeck(clip.hero).map((card, index) => ({ ...card, uid: index + 1 }));
    const act = ["frostwarden", "blood-countess"].includes(clip.boss ?? "")
      ? 2
      : ["blight-treant", "seraph", "stone-titan", "iron-bear"].includes(clip.boss ?? "")
        ? 3
        : 1;
    const save = buildActiveRunSave({
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
    });
    await menu.expectMainMenuAfterColdStart();
    if (clip.scene === "heroes") await menu.goToCharacterSelectUnlocked();
    else if (clip.scene === "collection") await menu.openCollection();
    else if (clip.scene === "homestead") await menu.openHomestead();
    else if (clip.scene === "options") await menu.openOptions();
    else if (clip.scene === "armory") await page.getByRole("button", { name: "Armory", exact: true }).click();
  }
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
