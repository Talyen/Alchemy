import {
  battleEventSounds,
  getCardSounds,
  enemyAttackSounds,
  stingerSounds,
  uiSounds,
  type UISound,
} from "./sound-registry";
import { audioState } from "./state";
import { getSoundUrl } from "./url";
import { createSfxPlayer, type PlaySoundOptions } from "./sfx-player";
import { pickRandomUnsafe } from "@/lib/rng";
import { SFX_DEFEAT_VOLUME, SFX_SLICE_DEATH_VOLUME, SFX_UI_VOLUME, SFX_VICTORY_VOLUME } from "../game-constants";

const player = createSfxPlayer({
  createElement: (name) => (typeof Audio === "undefined" ? undefined : new Audio(getSoundUrl(name))),
  readSettings: () => audioState,
  now: () => performance.now(),
  schedule: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  cancel: (timer) => clearTimeout(timer),
});

export function syncActiveHtmlSfxPlayback() {
  player.syncSettings();
}

export function resetHtmlSfxRuntime() {
  player.reset();
}

export function stopAllSfx() {
  player.stopBattleSounds();
}

export function playCardSound(cardId: string) {
  const sound = pickRandomUnsafe(getCardSounds(cardId));
  if (!sound) return;
  player.play(sound);
}

export function playGoldGain() {
  playBattleEvent("gainGold");
}

export function playGoldSpend() {
  playUISound("shopBuy");
}

export function playEnemyAttack(enemyId: string) {
  const sound = pickRandomUnsafe(enemyAttackSounds[enemyId] ?? []);
  if (!sound) return;
  player.play(sound);
}

export function playBattleEvent(event: keyof typeof battleEventSounds, options: PlaySoundOptions = {}) {
  const sound = battleEventSounds[event];
  if (sound) player.play(sound, options);
}

export function playSliceDeath() {
  playBattleEvent("sliceDeath", { volume: SFX_SLICE_DEATH_VOLUME, trackForCleanup: false });
}

export function playUISound(event: UISound) {
  const sound = uiSounds[event];
  if (sound) player.play(sound, { volume: SFX_UI_VOLUME, trackForCleanup: false });
}

export function playVictory() {
  player.play(stingerSounds.victory, { volume: SFX_VICTORY_VOLUME, trackForCleanup: false });
}

export function playDefeat() {
  player.play(stingerSounds.defeat, { volume: SFX_DEFEAT_VOLUME, trackForCleanup: false });
}

export function playRunVictory() {
  player.play(stingerSounds.runVictory, { volume: SFX_VICTORY_VOLUME, trackForCleanup: false });
}
