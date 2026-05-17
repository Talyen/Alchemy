// Short sound-effect playback for cards, combat events, UI, and stingers.
// Depends on Web Audio buffer cache, sound registries, and shared audio state.
// Used by controllers/screens through the public lib/audio facade.
import { battleEventSounds, cardSounds, enemyAttackSounds, stingerSounds, uiSounds } from "./sound-registry";
import { audioState } from "./audio-state";
import { getAudioContext, loadSoundBuffer, resumeAudioContext } from "./audio-buffer-cache";
import { pickRandom } from "./utils";
import { SFX_DEFEAT_VOLUME, SFX_UI_VOLUME, SFX_VICTORY_VOLUME } from "./game-constants";

// Creates a one-shot source with per-play gain so cached buffers remain immutable.
function playBuffer(name: string, volume = 1) {
  if (audioState.muted) return;
  resumeAudioContext();

  loadSoundBuffer(name).then((buffer) => {
    if (!buffer) return;
    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume * audioState.sfxVolume;
    source.connect(gain);
    if (!audioState.masterGain) return;
    gain.connect(audioState.masterGain);
    source.start();
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
export function playBattleEvent(event: keyof typeof battleEventSounds) {
  playBuffer(battleEventSounds[event]);
}

// Plays quieter UI feedback so menus do not compete with combat sounds.
export function playUISound(event: keyof typeof uiSounds) {
  playBuffer(uiSounds[event], SFX_UI_VOLUME);
}

// Plays the victory stinger at a controlled volume.
export function playVictory() {
  playBuffer(stingerSounds.victory, SFX_VICTORY_VOLUME);
}

// Plays the defeat stinger at a controlled volume.
export function playDefeat() {
  playBuffer(stingerSounds.defeat, SFX_DEFEAT_VOLUME);
}
