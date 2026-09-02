import { allRegisteredSoundFiles, battleEventSounds, cardSounds, enemyAttackSounds, uiSounds } from "./sound-registry";
import { scheduleIdle } from "./preload/batched";
import { SOUNDS_BASE_PATH } from "./game-constants";

const SOUND_PRELOAD_CONFIG = {
  IDLE_CALLBACK_TIMEOUT_MS: 5000,
  PRELOAD_BATCH_SIZE: 4,
} as const;

const htmlPreloadStarted = new Set<string>();

function playableSoundFileName(name: string): string {
  if (!name.endsWith(".ogg") || browserCanPlayOggVorbis()) return name;
  return `${name.slice(0, -4)}.mp3`;
}

function browserCanPlayOggVorbis(): boolean {
  if (typeof Audio === "undefined") return true;
  try {
    return new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== "";
  } catch {
    return true;
  }
}

export function getSoundUrl(name: string): string {
  const baseUrl = import.meta.env.BASE_URL ?? "/";
  const prefix = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${prefix}${SOUNDS_BASE_PATH}${playableSoundFileName(name)}`;
}

export function resetSoundPreloadCache() {
  htmlPreloadStarted.clear();
}

export function preloadSounds(names: string[]) {
  if (typeof Audio === "undefined") return;
  for (const name of names) {
    if (htmlPreloadStarted.has(name)) continue;
    htmlPreloadStarted.add(name);
    const el = new Audio();
    el.preload = "auto";
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
  preloadSoundsWhenIdle(names);
}

function preloadSoundsWhenIdle(names: string[]) {
  let index = 0;

  function preloadNextBatch() {
    if (index >= names.length) return;
    preloadSounds(names.slice(index, index + SOUND_PRELOAD_CONFIG.PRELOAD_BATCH_SIZE));
    index += SOUND_PRELOAD_CONFIG.PRELOAD_BATCH_SIZE;
    if (index < names.length) scheduleIdle(preloadNextBatch, SOUND_PRELOAD_CONFIG.IDLE_CALLBACK_TIMEOUT_MS);
  }

  scheduleIdle(preloadNextBatch, SOUND_PRELOAD_CONFIG.IDLE_CALLBACK_TIMEOUT_MS);
}
