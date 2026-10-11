import { MUSIC_BOSS_VOLUME_BOOST, MUSIC_KEYS, MUSIC_MASTER_GAIN } from "../game-constants";
import { clamp01 } from "../math";

interface MusicCatalogEntry {
  files: readonly string[];
  bossId?: string;
  skipSeconds?: number;
}

/**
 * Single catalog for every playable track. Menu/battle entries list rotation
 * files; boss entries list one file each. `getBossMusicKey()` derives from the
 * same table so boss id, files, and volume treatment cannot drift apart.
 */
export const MUSIC_CATALOG: Readonly<Record<string, Readonly<MusicCatalogEntry>>> = {
  [MUSIC_KEYS.MENU]: { files: ["Menu 1.mp3", "Menu 2.mp3", "Menu 3.mp3", "Menu 4.mp3"] },
  [MUSIC_KEYS.BATTLE]: {
    files: ["Battle 1.mp3", "Battle 2.mp3", "Battle 3.mp3", "Battle 4.mp3", "Battle 5.mp3"],
  },
  [MUSIC_KEYS.BOSS_FORGE_GOLEM]: { files: ["The Forge Golem.mp3"], bossId: "forge-golem" },
  [MUSIC_KEYS.BOSS_FROSTWARDEN]: { files: ["The Frostwarden.mp3"], bossId: "frostwarden" },
  [MUSIC_KEYS.BOSS_BLIGHT_TREANT]: { files: ["The Blight Treant.mp3"], bossId: "blight-treant" },
  [MUSIC_KEYS.BOSS_IRON_BEAR]: {
    files: ["The Iron Bear.mp3"],
    bossId: "iron-bear",
    skipSeconds: 6,
  },
};

export function allRegisteredMusicFiles(): string[] {
  return Object.values(MUSIC_CATALOG).flatMap((entry) => entry.files);
}

export function getBossMusicKey(bossId: string): string | undefined {
  return Object.entries(MUSIC_CATALOG).find(([, entry]) => entry.bossId === bossId)?.[0];
}

/**
 * Pure volume curve. Boss tracks get the shared boost before the clamp, so at
 * full volume both menu and boss saturate at 1.0 and the boost only separates
 * them at lower settings. Kept as-is for compatibility; covered by tests.
 */
export function computeMusicVolume({
  musicVolume,
  masterVolume,
  fadeGain = 1,
  isBoss = false,
}: {
  musicVolume: number;
  masterVolume: number;
  fadeGain?: number;
  isBoss?: boolean;
}): number {
  const boost = isBoss ? MUSIC_BOSS_VOLUME_BOOST : 1;
  return clamp01(musicVolume * masterVolume * MUSIC_MASTER_GAIN * clamp01(fadeGain) * boost);
}
