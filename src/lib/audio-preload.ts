import { allRegisteredSoundFiles, battleEventSounds, cardSounds, enemyAttackSounds, uiSounds } from "./sound-registry";
import { batchedPreload, scheduleIdle } from "./preload/batched";
import { audioUrl } from "./audio-url";
import { SOUNDS_BASE_PATH } from "./game-constants";

const SOUND_PRELOAD_CONFIG = {
  IDLE_CALLBACK_TIMEOUT_MS: 5000,
  PRELOAD_BATCH_SIZE: 4,
} as const;

const htmlPreloadStarted = new Set<string>();
let cachedOggSupport: boolean | null = null;

function playableSoundFileName(name: string): string {
  if (!name.endsWith(".ogg") || browserCanPlayOggVorbis()) return name;
  return `${name.slice(0, -4)}.mp3`;
}

function browserCanPlayOggVorbis(): boolean {
  if (cachedOggSupport !== null) return cachedOggSupport;
  if (typeof Audio === "undefined") {
    cachedOggSupport = true;
    return cachedOggSupport;
  }
  try {
    cachedOggSupport = new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== "";
  } catch {
    cachedOggSupport = true;
  }
  return cachedOggSupport;
}

export function getSoundUrl(name: string): string {
  return audioUrl(`${SOUNDS_BASE_PATH}${playableSoundFileName(name)}`);
}

export function resetSoundPreloadCache() {
  htmlPreloadStarted.clear();
  cachedOggSupport = null;
}

export function preloadSounds(names: string[]) {
  if (typeof Audio === "undefined") return;
  for (const name of names) {
    if (htmlPreloadStarted.has(name)) continue;
    htmlPreloadStarted.add(name);
    const el = new Audio();
    el.preload = "auto";
    el.onerror = () => {
      htmlPreloadStarted.delete(name);
    };
    el.src = getSoundUrl(name);
  }
}

export function preloadBattleSounds(cardIds: readonly string[], enemyId: string) {
  const names = new Set<string>([
    battleEventSounds.drawTransfer,
    battleEventSounds.enemyHit,
    battleEventSounds.playerHit,
    battleEventSounds.blockAbsorb,
    battleEventSounds.critHit,
    battleEventSounds.endTurn,
  ]);
  for (const cardId of cardIds) {
    for (const name of cardSounds[cardId] ?? []) names.add(name);
  }
  for (const name of enemyAttackSounds[enemyId] ?? []) names.add(name);
  preloadSounds([...names]);
}

export function preloadAllSounds() {
  const names = allRegisteredSoundFiles();
  preloadSounds([...Object.values(uiSounds), battleEventSounds.drawTransfer]);
  scheduleIdle(() => {
    void batchedPreload(names, (name) => preloadSounds([name]), {
      batchSize: SOUND_PRELOAD_CONFIG.PRELOAD_BATCH_SIZE,
      yieldBetweenBatches: () =>
        new Promise<void>((resolve) => {
          scheduleIdle(resolve, SOUND_PRELOAD_CONFIG.IDLE_CALLBACK_TIMEOUT_MS);
        }),
    });
  }, SOUND_PRELOAD_CONFIG.IDLE_CALLBACK_TIMEOUT_MS);
}
