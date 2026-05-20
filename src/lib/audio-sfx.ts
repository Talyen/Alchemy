// Short sound-effect playback for cards, combat events, UI, and stingers.
// Depends on Web Audio buffer cache, sound registries, and shared audio state.
// Used by controllers/screens through the public lib/audio facade.
import { battleEventSounds, cardSounds, enemyAttackSounds, stingerSounds, uiSounds } from "./sound-registry";
import { audioState } from "./audio-state";
import { getAudioContext, getCachedBuffer, loadSoundBuffer, resumeAudioContext } from "./audio-buffer-cache";
import { pickRandom } from "./utils";
import { SFX_COOLDOWN_MS, SFX_DEFEAT_VOLUME, SFX_UI_VOLUME, SFX_VICTORY_VOLUME } from "./game-constants";

type PlaySoundOptions = {
  volume?: number;
  delay?: number;
  cooldownMs?: number;
};

// Shared source-node setup so both sync and async paths don't duplicate code.
function playDecodedBuffer(buffer: AudioBuffer, volume: number, delay = 0) {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volume * audioState.sfxVolume;
  source.connect(gain);
  if (!audioState.masterGain) return;
  gain.connect(audioState.masterGain);
  source.start(ctx.currentTime + delay);
}

// Checks the sound cache synchronously first, so cached sounds play in the
// same event-handler tick without any microtask delay from `loadSoundBuffer`.
function playBuffer(name: string, { volume = 1, delay = 0, cooldownMs = SFX_COOLDOWN_MS }: PlaySoundOptions = {}) {
  if (audioState.muted) return;
  const scheduledAt = performance.now() + delay * 1000;
  const last = audioState.lastPlayedAt.get(name) ?? 0;
  if (scheduledAt - last < cooldownMs) return;
  audioState.lastPlayedAt.set(name, scheduledAt);
  resumeAudioContext();

  const cached = getCachedBuffer(name);
  if (cached) {
    playDecodedBuffer(cached, volume, delay);
    return;
  }

  loadSoundBuffer(name).then((buffer) => {
    if (buffer) playDecodedBuffer(buffer, volume, delay);
  });
}

// Plays a card-specific sound variant when the registry has one.
export function playCardSound(cardId: string) {
  const sound = pickRandom(cardSounds[cardId] ?? []);
  if (!sound) return;
  playBuffer(sound);
}

// Reuses Steal's coin flourish for generic gold gains.
export function playGoldGain() {
  const sound = pickRandom(cardSounds.steal ?? []);
  if (!sound) return;
  playBuffer(sound);
}

// Reuses Steal's coin flourish for generic gold spending.
export function playGoldSpend() {
  const sound = pickRandom(cardSounds.steal ?? []);
  if (!sound) return;
  playBuffer(sound);
}

// Plays an enemy-specific attack sound when one is registered.
export function playEnemyAttack(enemyId: string) {
  const sound = pickRandom(enemyAttackSounds[enemyId] ?? []);
  if (!sound) return;
  playBuffer(sound);
}

// Plays a named battle feedback event.
export function playBattleEvent(event: keyof typeof battleEventSounds, options: PlaySoundOptions = {}) {
  playBuffer(battleEventSounds[event], options);
}

// Plays quieter UI feedback so menus do not compete with combat sounds.
export function playUISound(event: keyof typeof uiSounds) {
  playBuffer(uiSounds[event], { volume: SFX_UI_VOLUME });
}

// Plays the victory stinger at a controlled volume.
export function playVictory() {
  playBuffer(stingerSounds.victory, { volume: SFX_VICTORY_VOLUME });
}

// Plays the defeat stinger at a controlled volume.
export function playDefeat() {
  playBuffer(stingerSounds.defeat, { volume: SFX_DEFEAT_VOLUME });
}
