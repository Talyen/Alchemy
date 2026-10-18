import { allRegisteredSoundFiles, battleEventSounds, getCardSounds, uiSounds } from "./sound-registry";
import { scheduleIdle } from "../preload";
import { getSoundUrl, resetSoundUrlCache } from "./url";

const IDLE_PRELOAD_TIMEOUT_MS = 5000;

const warmedSounds = new Set<string>();
let preloadAllSoundsStarted = false;
let preloadGeneration = 0;

export function resetSoundPreloadCache() {
  preloadGeneration += 1;
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
    try {
      const el = new Audio();
      el.preload = "auto";
      el.oncanplaythrough = () => {
        el.oncanplaythrough = null;
        el.onerror = null;
      };
      el.onerror = () => {
        el.oncanplaythrough = null;
        el.onerror = null;
      };
      el.src = getSoundUrl(name);
    } catch {
      // Warmup is optional; one failed element must not abort app/battle startup.
    }
  }
}

export function preloadBattleSounds(handCardIds: readonly string[], abilityIds: readonly string[] = []) {
  // Opening combat text can
  // trigger stun/freeze/heal cues, so warm everything rather than a subset.
  // Enemy abilities play through playCardSound(ability.id), so their card
  // sounds are warmed alongside the visible hand.
  const names = new Set<string>(Object.values(battleEventSounds).filter((name) => name !== null));
  for (const cardId of [...handCardIds, ...abilityIds]) {
    for (const name of getCardSounds(cardId)) names.add(name);
  }
  preloadSounds([...names]);
}

export function preloadAllSounds() {
  if (preloadAllSoundsStarted) return;
  if (typeof Audio === "undefined") return;
  preloadAllSoundsStarted = true;

  const urgentSounds = [...Object.values(uiSounds), battleEventSounds.drawTransfer];
  preloadSounds(urgentSounds.filter((name) => name !== null));

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
