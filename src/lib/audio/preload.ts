import { allRegisteredSoundFiles, battleEventSounds, getCardSounds, uiSounds } from "./sound-registry";
import { releaseAudioElement } from "./element";
import { scheduleIdle } from "../preload";
import { getSoundUrl, resetSoundUrlCache } from "./url";
import { SOUND_PRELOAD_TIMEOUT_MS } from "../game-constants";

const IDLE_PRELOAD_TIMEOUT_MS = 5000;

const battleSoundNames = Object.values(battleEventSounds).filter((name) => name !== null);
const urgentSoundNames = [...Object.values(uiSounds), battleEventSounds.drawTransfer].filter((name) => name !== null);

const warmedSounds = new Set<string>();
const pendingWarmups = new Set<() => void>();
let preloadAllSoundsStarted = false;
let preloadGeneration = 0;

export function resetSoundPreloadCache() {
  preloadGeneration += 1;
  for (const cancel of [...pendingWarmups]) cancel();
  warmedSounds.clear();
  preloadAllSoundsStarted = false;
  resetSoundUrlCache();
}

export function preloadSounds(names: readonly string[]) {
  if (typeof Audio === "undefined") return;
  for (const name of names) {
    if (warmedSounds.has(name)) continue;
    // Marked before warming so a failed name never retry-storms; a missed
    // warmup only costs a cold first play, never correctness.
    warmedSounds.add(name);
    let el: HTMLAudioElement | undefined;
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => finish(false);
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      if (timeout !== undefined) globalThis.clearTimeout(timeout);
      pendingWarmups.delete(cancel);
      if (!el) return;
      el.oncanplaythrough = null;
      el.onerror = null;
      if (!loaded) releaseAudioElement(el);
    };
    try {
      el = new Audio();
      pendingWarmups.add(cancel);
      el.preload = "auto";
      el.oncanplaythrough = () => finish(true);
      el.onerror = cancel;
      timeout = globalThis.setTimeout(cancel, SOUND_PRELOAD_TIMEOUT_MS);
      el.src = getSoundUrl(name);
    } catch {
      finish(false);
      // Warmup is optional; one failed element must not abort app/battle startup.
    }
  }
}

export function preloadBattleSounds(handCardIds: readonly string[], abilityIds: readonly string[] = []) {
  // Opening combat text can
  // trigger stun/freeze/heal cues, so warm everything rather than a subset.
  // Enemy abilities play through playCardSound(ability.id), so their card
  // sounds are warmed alongside the visible hand.
  const names = new Set<string>(battleSoundNames);
  for (const cardId of handCardIds) for (const name of getCardSounds(cardId)) names.add(name);
  for (const cardId of abilityIds) for (const name of getCardSounds(cardId)) names.add(name);
  preloadSounds([...names]);
}

export function preloadAllSounds() {
  if (preloadAllSoundsStarted) return;
  if (typeof Audio === "undefined") return;
  preloadAllSoundsStarted = true;

  preloadSounds(urgentSoundNames);

  const pendingNames = allRegisteredSoundFiles().filter((name) => !warmedSounds.has(name));
  if (pendingNames.length === 0) return;

  // Warming only assigns element sources; the browser fetches asynchronously,
  // so one idle callback with a plain loop replaces the previous fake-batched
  // schedule (which awaited synchronous work and throttled nothing).
  const generation = preloadGeneration;
  scheduleIdle(() => {
    if (generation === preloadGeneration) preloadSounds(pendingNames);
  }, IDLE_PRELOAD_TIMEOUT_MS);
}
