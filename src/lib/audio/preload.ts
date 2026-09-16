import {
  allRegisteredSoundFiles,
  battleEventSounds,
  getCardSounds,
  enemyAttackSounds,
  uiSounds,
} from "./sound-registry";
import { batchedPreload, scheduleIdle } from "../preload";
import { getSoundUrl, resetSoundUrlCache } from "./url";

export { getSoundUrl } from "./url";

const SOUND_PRELOAD_CONFIG = {
  IDLE_CALLBACK_TIMEOUT_MS: 5000,
  PRELOAD_BATCH_SIZE: 4,
  STALLED_PRELOAD_TIMEOUT_MS: 30_000,
} as const;

const htmlPreloadStarted = new Set<string>();
const htmlPreloadTimers = new Map<HTMLAudioElement, ReturnType<typeof setTimeout>>();
let preloadAllSoundsStarted = false;

function clearStallTimer(el: HTMLAudioElement): void {
  const timer = htmlPreloadTimers.get(el);
  if (timer !== undefined) {
    clearTimeout(timer);
    htmlPreloadTimers.delete(el);
  }
}

function abortPreloadElement(el: HTMLAudioElement) {
  clearStallTimer(el);
  try {
    el.oncanplaythrough = null;
    el.onerror = null;
    el.pause();
    el.removeAttribute("src");
  } catch {}
}

function dropFailedPreloadElement(el: HTMLAudioElement) {
  abortPreloadElement(el);
}

export function resetSoundPreloadCache() {
  for (const el of Array.from(htmlPreloadTimers.keys())) {
    abortPreloadElement(el);
  }
  htmlPreloadStarted.clear();
  htmlPreloadTimers.clear();
  preloadAllSoundsStarted = false;
  resetSoundUrlCache();
}

export function preloadSound(name: string): void {
  preloadSounds([name]);
}

export function preloadSounds(names: readonly string[] | string[]) {
  if (typeof Audio === "undefined") return;
  for (const name of names) {
    if (htmlPreloadStarted.has(name)) continue;
    htmlPreloadStarted.add(name);
    const el = new Audio();
    el.preload = "auto";
    const stallTimer = setTimeout(() => dropFailedPreloadElement(el), SOUND_PRELOAD_CONFIG.STALLED_PRELOAD_TIMEOUT_MS);
    htmlPreloadTimers.set(el, stallTimer);
    el.oncanplaythrough = () => {
      clearStallTimer(el);
    };
    el.onerror = () => {
      dropFailedPreloadElement(el);
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
    for (const name of getCardSounds(cardId)) names.add(name);
  }
  for (const name of enemyAttackSounds[enemyId] ?? []) names.add(name);
  preloadSounds([...names]);
}

export function preloadAllSounds() {
  if (preloadAllSoundsStarted) return;
  preloadAllSoundsStarted = true;

  const urgentSounds = [...Object.values(uiSounds), battleEventSounds.drawTransfer];
  preloadSounds(urgentSounds);

  const pendingNames = allRegisteredSoundFiles().filter((name) => !htmlPreloadStarted.has(name));
  if (pendingNames.length === 0) return;

  scheduleIdle(() => {
    void batchedPreload(pendingNames, (name) => preloadSound(name), {
      batchSize: SOUND_PRELOAD_CONFIG.PRELOAD_BATCH_SIZE,
      yieldBetweenBatches: () =>
        new Promise<void>((resolve) => {
          scheduleIdle(resolve, SOUND_PRELOAD_CONFIG.IDLE_CALLBACK_TIMEOUT_MS);
        }),
    });
  }, SOUND_PRELOAD_CONFIG.IDLE_CALLBACK_TIMEOUT_MS);
}
