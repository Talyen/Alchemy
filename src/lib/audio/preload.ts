import {
  allRegisteredSoundFiles,
  battleEventSounds,
  getCardSounds,
  enemyAttackSounds,
  uiSounds,
} from "./sound-registry";
import { scheduleIdle } from "../preload";
import { getSoundUrl, resetSoundUrlCache } from "./url";
import { releaseAudioElement } from "./element";

const IDLE_PRELOAD_TIMEOUT_MS = 5000;
const STALLED_PRELOAD_TIMEOUT_MS = 30_000;

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
  el.oncanplaythrough = null;
  el.onerror = null;
  // Shared with `stopAllSfx`: releasing the source plus load() frees the
  // element for collection instead of leaving a stalled fetch attached.
  releaseAudioElement(el);
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
    // Marked before warming so a failed name never retry-storms; a missed
    // warmup only costs a cold first play, never correctness.
    htmlPreloadStarted.add(name);
    const el = new Audio();
    el.preload = "auto";
    const stallTimer = setTimeout(() => abortPreloadElement(el), STALLED_PRELOAD_TIMEOUT_MS);
    htmlPreloadTimers.set(el, stallTimer);
    el.oncanplaythrough = () => {
      clearStallTimer(el);
    };
    el.onerror = () => {
      abortPreloadElement(el);
    };
    el.src = getSoundUrl(name);
  }
}

export function preloadBattleSounds(
  handCardIds: readonly string[],
  enemyId: string,
  abilityIds: readonly string[] = [],
) {
  // The full battle event set is small (~14 files) and opening combat text can
  // trigger stun/freeze/heal cues, so warm everything rather than a subset.
  // Enemy abilities play through playCardSound(ability.id), so their card
  // sounds are warmed alongside the visible hand.
  const names = new Set<string>(Object.values(battleEventSounds));
  for (const cardId of [...handCardIds, ...abilityIds]) {
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

  // Warming only assigns element sources; the browser fetches asynchronously,
  // so one idle callback with a plain loop replaces the previous fake-batched
  // schedule (which awaited synchronous work and throttled nothing).
  scheduleIdle(() => {
    preloadSounds(pendingNames);
  }, IDLE_PRELOAD_TIMEOUT_MS);
}
