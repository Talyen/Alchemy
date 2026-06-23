// Short sound-effect playback for cards, combat events, UI, and stingers.
// Depends on Web Audio buffer cache, sound registries, and shared audio state.
// Used by controllers/screens through the public lib/audio facade.
import { battleEventSounds, cardSounds, enemyAttackSounds, stingerSounds, uiSounds } from "./sound-registry";
import { audioState } from "./audio-state";
import { getAudioContext, getCachedBuffer, loadSoundBuffer, resumeAudioContext } from "./audio-buffer-cache";
import { pickRandom } from "./utils";
import { SFX_COOLDOWN_MS, SFX_DEFEAT_VOLUME, SFX_UI_VOLUME, SFX_VICTORY_VOLUME } from "./game-constants";

interface PlaySoundOptions {
  volume?: number;
  delay?: number;
  cooldownMs?: number;
  /** When false, sound plays through screen transitions (UI feedback, stingers). Default true for combat SFX. */
  trackForCleanup?: boolean;
}

// Grouped local constants and settings for SFX playback.
const SFX_CONFIG = {
  MS_PER_SECOND: 1000,
  GOLD_GAIN_CARD_KEY: "steal",
  VOLUME_DEFAULT: 1.0,
  DELAY_DEFAULT: 0.0,
} as const;

// Battle-tracked sources stopped by stopAllSfx so combat audio cannot leak across rooms.
const activeSfxSources = new Set<AudioBufferSourceNode>();

// Monotonically increasing token to cancel scheduled/in-flight sounds when all SFX are stopped.
let sfxStopToken = 0;

// Shared source-node setup so both sync and async paths don't duplicate code.
// Sets up the gain nodes and links them to the master audio context.
function playDecodedBuffer(
  buffer: AudioBuffer,
  volume: number,
  delay: number = SFX_CONFIG.DELAY_DEFAULT,
  trackForCleanup: boolean = true,
) {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  // Local Gain node controls specific sound instance volume multiplied by the user's SFX volume slider.
  const gain = ctx.createGain();
  gain.gain.value = volume * audioState.sfxVolume;
  source.connect(gain);

  if (!audioState.masterGain) return;
  // Cascading Gain Staging:
  // [Source Node] -> [Local Gain (volume * sfxVolume)] -> [Master Gain (MASTER_GAIN * masterVolume)] -> [Speakers]
  gain.connect(audioState.masterGain);

  if (trackForCleanup) {
    activeSfxSources.add(source);
    source.onended = () => activeSfxSources.delete(source);
  }
  source.start(ctx.currentTime + delay);
}

// Stops battle-tracked SFX (cards, combat events, gold) so combat cleanup cannot leak into the next screen.
// UI feedback and stingers are not tracked and play through screen transitions.
export function stopAllSfx() {
  sfxStopToken += 1;
  for (const source of activeSfxSources) {
    try {
      source.stop();
    } catch {
      // Already-ended sources can throw; they will be caught here and removed below.
    }
  }
  activeSfxSources.clear();
}

// Plays a sound by name. Tries synchronous cache lookup first to bypass the Promise/microtask
// delay of loadSoundBuffer, preventing any delay between user interaction and audio response.
function playBuffer(
  name: string,
  {
    volume = SFX_CONFIG.VOLUME_DEFAULT,
    delay = SFX_CONFIG.DELAY_DEFAULT,
    cooldownMs = SFX_COOLDOWN_MS,
    trackForCleanup = true,
  }: PlaySoundOptions = {},
) {
  if (audioState.muted) return;
  if (!audioState.audioUnlocked) return;

  const playToken = sfxStopToken;
  const scheduledAt = performance.now() + delay * SFX_CONFIG.MS_PER_SECOND;
  const last = audioState.lastPlayedAt.get(name) ?? 0;

  // Rate-limiting check to prevent loud, rapid-fire overlapping plays of the exact same sound.
  if (scheduledAt - last < cooldownMs) return;
  audioState.lastPlayedAt.set(name, scheduledAt);
  resumeAudioContext();

  // Try the synchronous cache path first to play immediately in the current event-loop tick.
  const cached = getCachedBuffer(name);
  if (cached) {
    playDecodedBuffer(cached, volume, delay, trackForCleanup);
    return;
  }

  // Fall back to async fetching and decoding. Checks playToken to prevent playing if stopped in the meantime.
  void loadSoundBuffer(name).then((buffer) => {
    if (playToken !== sfxStopToken) return;
    if (buffer) playDecodedBuffer(buffer, volume, delay, trackForCleanup);
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
  const sound = pickRandom(cardSounds[SFX_CONFIG.GOLD_GAIN_CARD_KEY] ?? []);
  if (!sound) return;
  playBuffer(sound);
}

// Reuses Steal's coin flourish for generic gold spending.
export function playGoldSpend() {
  const sound = pickRandom(cardSounds[SFX_CONFIG.GOLD_GAIN_CARD_KEY] ?? []);
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
  playBuffer(uiSounds[event], { volume: SFX_UI_VOLUME, trackForCleanup: false });
}

// Plays the victory stinger at a controlled volume.
export function playVictory() {
  playBuffer(stingerSounds.victory, { volume: SFX_VICTORY_VOLUME, trackForCleanup: false });
}

// Plays the defeat stinger at a controlled volume.
export function playDefeat() {
  playBuffer(stingerSounds.defeat, { volume: SFX_DEFEAT_VOLUME, trackForCleanup: false });
}
